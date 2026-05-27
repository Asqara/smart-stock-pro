import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { AUDIT_ACTIONS } from "@/constants/auth";
import type { StockValuationMethod } from "@/constants/inventory";
import {
  products,
  stockBatches,
  stockMovements,
  users,
  warehouses,
} from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import {
  InvalidQuantityError,
  NotFoundAppError,
  ValidationAppError,
} from "@/lib/errors";
import { getFilters } from "@/utils/getFilters";

import { AuditLogs } from "../audit-logs";
import { Jobs } from "../jobs";
import { Notifications } from "../notifications";
import type { AuditContext } from "../types";
import {
  consumeStockLots,
  getWeightedUnitCost,
  type StockLot,
} from "./stock-ledger";
import {
  getPagination,
  getProductStockStatus,
  parseUuid,
} from "./shared";

type StockInInput = {
  notes?: string | null;
  productId: string;
  quantity: number;
  receivedAt: Date;
  unitCost: number;
  warehouseId: string;
};

type StockOutInput = {
  notes?: string | null;
  productId: string;
  quantity: number;
  valuationMethod?: StockValuationMethod;
  warehouseId: string;
};

function getMovementSortColumn(sortBy?: string): AnyPgColumn {
  if (sortBy === "quantity") return stockMovements.quantity;
  if (sortBy === "type") return stockMovements.type;

  return stockMovements.createdAt;
}

/**
 * Business logic for stock batches and movement ledger.
 */
export class Stock {
  /**
   * Create stock in movement and new stock batch.
   */
  static async createStockIn(input: StockInInput, context: AuditContext) {
    if (input.quantity <= 0) {
      throw new InvalidQuantityError("Jumlah stock in harus lebih dari 0.");
    }

    if (input.unitCost < 0) {
      throw new ValidationAppError("Harga satuan tidak boleh negatif.");
    }

    const product = await this.getActiveProduct(input.productId);
    const warehouse = await this.getActiveWarehouse(input.warehouseId);

    const result = await db.transaction(async (tx) => {
      const [movement] = await tx
        .insert(stockMovements)
        .values({
          createdBy: context.actorUserId ?? null,
          notes: input.notes ?? null,
          productId: product.id,
          quantity: input.quantity,
          referenceType: "STOCK_IN",
          type: "IN",
          unitCost: input.unitCost,
          warehouseId: warehouse.id,
        })
        .returning();
      const [batch] = await tx
        .insert(stockBatches)
        .values({
          productId: product.id,
          quantityInitial: input.quantity,
          quantityRemaining: input.quantity,
          receivedAt: input.receivedAt,
          sourceMovementId: movement.id,
          unitCost: input.unitCost,
          warehouseId: warehouse.id,
        })
        .returning();

      return { batch, movement };
    });

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.STOCK_IN_CREATED,
        description: `Stock in ${product.sku} di ${warehouse.name} dibuat.`,
        entityId: result.movement.id,
        entityType: "stock_movement",
        metadata: {
          productId: product.id,
          quantity: input.quantity,
          warehouseId: warehouse.id,
        },
      },
      context,
    );

    const queuedAlert = await Jobs.enqueueLowStockAlert({
      ...context,
      productId: product.id,
      warehouseId: warehouse.id,
    });

    if (!queuedAlert.queued) {
      await Notifications.createLowStockNotification(product.id, warehouse.id, context);
    }

    return result;
  }

  /**
   * Create stock out movement and consume batches with FIFO or LIFO.
   */
  static async createStockOut(input: StockOutInput, context: AuditContext) {
    if (input.quantity <= 0) {
      throw new InvalidQuantityError("Jumlah stock out harus lebih dari 0.");
    }

    const product = await this.getActiveProduct(input.productId);
    const warehouse = await this.getActiveWarehouse(input.warehouseId);
    const valuationMethod = input.valuationMethod ?? "FIFO";
    const result = await db.transaction(async (tx) => {
      const batches = await tx
        .select({
          id: stockBatches.id,
          quantityRemaining: stockBatches.quantityRemaining,
          receivedAt: stockBatches.receivedAt,
          unitCost: stockBatches.unitCost,
        })
        .from(stockBatches)
        .where(
          and(
            eq(stockBatches.productId, product.id),
            eq(stockBatches.warehouseId, warehouse.id),
            gt(stockBatches.quantityRemaining, 0),
          ),
        )
        .orderBy(
          valuationMethod === "LIFO"
            ? desc(stockBatches.receivedAt)
            : asc(stockBatches.receivedAt),
        );
      const lots: StockLot[] = batches;
      const consumedLots = consumeStockLots(lots, input.quantity, valuationMethod);

      for (const consumedLot of consumedLots) {
        await tx
          .update(stockBatches)
          .set({
            quantityRemaining: consumedLot.nextQuantityRemaining,
            updatedAt: new Date(),
          })
          .where(eq(stockBatches.id, consumedLot.id));
      }

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          createdBy: context.actorUserId ?? null,
          notes: input.notes ?? null,
          productId: product.id,
          quantity: input.quantity,
          referenceType: "STOCK_OUT",
          type: "OUT",
          unitCost: getWeightedUnitCost(consumedLots),
          warehouseId: warehouse.id,
        })
        .returning();

      return { consumedLots, movement };
    });

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.STOCK_OUT_CREATED,
        description: `Stock out ${product.sku} di ${warehouse.name} dibuat.`,
        entityId: result.movement.id,
        entityType: "stock_movement",
        metadata: {
          productId: product.id,
          quantity: input.quantity,
          valuationMethod,
          warehouseId: warehouse.id,
        },
      },
      context,
    );

    const queuedAlert = await Jobs.enqueueLowStockAlert({
      ...context,
      productId: product.id,
      warehouseId: warehouse.id,
    });

    if (!queuedAlert.queued) {
      await Notifications.createLowStockNotification(product.id, warehouse.id, context);
    }

    return result;
  }

  /**
   * Calculate available stock for one product and optional warehouse.
   */
  static async calculateAvailableStock(productId: string, warehouseId?: string) {
    const conditions: SQL[] = [eq(stockBatches.productId, parseUuid(productId))];

    if (warehouseId) {
      conditions.push(eq(stockBatches.warehouseId, parseUuid(warehouseId)));
    }

    const [row] = await dbRead
      .select({
        availableStock:
          sql<number>`coalesce(sum(${stockBatches.quantityRemaining}), 0)::int`,
      })
      .from(stockBatches)
      .where(and(...conditions));

    return Number(row?.availableStock ?? 0);
  }

  /**
   * List stock movements with product, warehouse, and creator joins.
   */
  static async listMovements(searchParams: Record<string, unknown>) {
    const filters = getFilters(searchParams);
    const where = filters.where;
    const conditions: SQL[] = [];

    if (typeof where.productId === "string" && where.productId) {
      conditions.push(eq(stockMovements.productId, where.productId));
    }

    if (typeof where.product_id === "string" && where.product_id) {
      conditions.push(eq(stockMovements.productId, where.product_id));
    }

    if (typeof where.warehouseId === "string" && where.warehouseId) {
      conditions.push(eq(stockMovements.warehouseId, where.warehouseId));
    }

    if (typeof where.warehouse_id === "string" && where.warehouse_id) {
      conditions.push(eq(stockMovements.warehouseId, where.warehouse_id));
    }

    const validTypes = ["IN", "OUT", "TRANSFER_IN", "TRANSFER_OUT", "IMPORT", "ADJUSTMENT"];
    if (typeof where.type === "string" && validTypes.includes(where.type)) {
      conditions.push(eq(stockMovements.type, where.type as "IN" | "OUT" | "TRANSFER_IN" | "TRANSFER_OUT" | "IMPORT" | "ADJUSTMENT"));
    }

    if (typeof where.dateFrom === "string" && where.dateFrom) {
      conditions.push(gte(stockMovements.createdAt, new Date(where.dateFrom)));
    }

    if (typeof where.date_from === "string" && where.date_from) {
      conditions.push(gte(stockMovements.createdAt, new Date(where.date_from)));
    }

    if (typeof where.dateTo === "string" && where.dateTo) {
      conditions.push(lte(stockMovements.createdAt, new Date(where.dateTo)));
    }

    if (typeof where.date_to === "string" && where.date_to) {
      conditions.push(lte(stockMovements.createdAt, new Date(where.date_to)));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ total }] = await dbRead
      .select({ total: count() })
      .from(stockMovements)
      .where(whereCondition);
    const sortDirection = filters.sortDir === "asc" ? asc : desc;
    const data = await dbRead
      .select({
        createdAt: stockMovements.createdAt,
        createdBy: users.name,
        id: stockMovements.id,
        notes: stockMovements.notes,
        productId: products.id,
        productName: products.name,
        productSku: products.sku,
        quantity: stockMovements.quantity,
        referenceId: stockMovements.referenceId,
        referenceType: stockMovements.referenceType,
        type: stockMovements.type,
        unitCost: stockMovements.unitCost,
        warehouseCode: warehouses.code,
        warehouseId: warehouses.id,
        warehouseName: warehouses.name,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .innerJoin(warehouses, eq(stockMovements.warehouseId, warehouses.id))
      .leftJoin(users, eq(stockMovements.createdBy, users.id))
      .where(whereCondition)
      .orderBy(sortDirection(getMovementSortColumn(filters.sortBy)))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      data,
      pagination: getPagination(filters.page, filters.limit, Number(total)),
    };
  }

  /**
   * Get stock by product across warehouses.
   */
  static async calculateStockByProduct(productId: string) {
    const id = parseUuid(productId, "ID produk tidak valid.");

    return dbRead
      .select({
        currentStock:
          sql<number>`coalesce(sum(${stockBatches.quantityRemaining}), 0)::int`,
        warehouseCity: warehouses.city,
        warehouseCode: warehouses.code,
        warehouseId: warehouses.id,
        warehouseName: warehouses.name,
      })
      .from(stockBatches)
      .innerJoin(warehouses, eq(stockBatches.warehouseId, warehouses.id))
      .where(eq(stockBatches.productId, id))
      .groupBy(warehouses.id)
      .orderBy(asc(warehouses.name));
  }

  /**
   * Get stock by warehouse across products.
   */
  static async calculateStockByWarehouse(warehouseId: string) {
    const id = parseUuid(warehouseId, "ID gudang tidak valid.");

    return dbRead
      .select({
        currentStock:
          sql<number>`coalesce(sum(${stockBatches.quantityRemaining}), 0)::int`,
        minimumStock: products.minimumStock,
        productId: products.id,
        productName: products.name,
        productSku: products.sku,
        stockStatus:
          sql<string>`case
            when coalesce(sum(${stockBatches.quantityRemaining}), 0) <= 0 then 'out_of_stock'
            when ${products.minimumStock} > 0 and coalesce(sum(${stockBatches.quantityRemaining}), 0) <= greatest(1, floor(${products.minimumStock} / 2)) then 'critical'
            when ${products.minimumStock} > 0 and coalesce(sum(${stockBatches.quantityRemaining}), 0) <= ${products.minimumStock} then 'low_stock'
            else 'available'
          end`,
        unit: products.unit,
      })
      .from(stockBatches)
      .innerJoin(products, eq(stockBatches.productId, products.id))
      .where(eq(stockBatches.warehouseId, id))
      .groupBy(products.id)
      .orderBy(asc(products.name));
  }

  /**
   * Get dashboard stock summary and critical alert data.
   */
  static async getSummary() {
    const stockSummary = dbRead
      .select({
        productId: stockBatches.productId,
        totalStock:
          sql<number>`coalesce(sum(${stockBatches.quantityRemaining}), 0)::int`.as(
            "total_stock",
          ),
        totalValue:
          sql<number>`coalesce(sum(${stockBatches.quantityRemaining} * ${stockBatches.unitCost}), 0)::int`.as(
            "total_value",
          ),
      })
      .from(stockBatches)
      .groupBy(stockBatches.productId)
      .as("stock_summary");
    const [summary] = await dbRead
      .select({
        inventoryValue:
          sql<number>`coalesce(sum(${stockSummary.totalValue}), 0)::int`,
        lowStockCount:
          sql<number>`count(*) filter (where coalesce(${stockSummary.totalStock}, 0) <= ${products.minimumStock} and ${products.minimumStock} > 0)::int`,
        outOfStockCount:
          sql<number>`count(*) filter (where coalesce(${stockSummary.totalStock}, 0) <= 0)::int`,
        totalProducts: count(products.id),
        totalStock:
          sql<number>`coalesce(sum(${stockSummary.totalStock}), 0)::int`,
      })
      .from(products)
      .leftJoin(stockSummary, eq(products.id, stockSummary.productId));
    const [{ totalWarehouses }] = await dbRead
      .select({ totalWarehouses: count() })
      .from(warehouses);
    const recentMovements = await this.listMovements({
      limit: "6",
      page: "1",
      sortBy: "createdAt",
      sortDir: "desc",
    });
    const lowStockProducts = await dbRead
      .select({
        currentStock: sql<number>`coalesce(${stockSummary.totalStock}, 0)::int`,
        minimumStock: products.minimumStock,
        productId: products.id,
        productName: products.name,
        productSku: products.sku,
        unit: products.unit,
      })
      .from(products)
      .leftJoin(stockSummary, eq(products.id, stockSummary.productId))
      .where(
        sql`coalesce(${stockSummary.totalStock}, 0) <= ${products.minimumStock} and ${products.minimumStock} > 0`,
      )
      .orderBy(asc(sql`coalesce(${stockSummary.totalStock}, 0)`))
      .limit(8);

    return {
      inventoryValue: Number(summary?.inventoryValue ?? 0),
      lowStockCount: Number(summary?.lowStockCount ?? 0),
      lowStockProducts: lowStockProducts.map((row) => ({
        ...row,
        stockStatus: getProductStockStatus(
          Number(row.currentStock),
          row.minimumStock,
        ),
      })),
      outOfStockCount: Number(summary?.outOfStockCount ?? 0),
      recentMovements: recentMovements.data,
      totalProducts: Number(summary?.totalProducts ?? 0),
      totalStock: Number(summary?.totalStock ?? 0),
      totalWarehouses: Number(totalWarehouses),
    };
  }

  private static async getActiveProduct(id: string) {
    const productId = parseUuid(id, "ID produk tidak valid.");
    const [product] = await dbRead
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundAppError("Produk tidak ditemukan.");
    }

    if (!product.isActive) {
      throw new ValidationAppError("Produk tidak aktif.");
    }

    return product;
  }

  private static async getActiveWarehouse(id: string) {
    const warehouseId = parseUuid(id, "ID gudang tidak valid.");
    const [warehouse] = await dbRead
      .select()
      .from(warehouses)
      .where(eq(warehouses.id, warehouseId))
      .limit(1);

    if (!warehouse) {
      throw new NotFoundAppError("Gudang tidak ditemukan.");
    }

    if (!warehouse.isActive) {
      throw new ValidationAppError("Gudang tidak aktif.");
    }

    return warehouse;
  }
}
