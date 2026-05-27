import "server-only";

import { and, asc, count, desc, eq, gt, gte, lte, sql, type SQL } from "drizzle-orm";

import { AUDIT_ACTIONS } from "@/constants/auth";
import type { TransferStatus } from "@/constants/inventory";
import {
  products,
  stockBatches,
  stockMovements,
  stockTransferItems,
  stockTransfers,
  users,
  warehouses,
} from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import {
  InsufficientStockError,
  NotFoundAppError,
  TransferSameWarehouseError,
  ValidationAppError,
} from "@/lib/errors";
import { getFilters } from "@/utils/getFilters";

import { AuditLogs } from "../audit-logs";
import { consumeStockLots, getWeightedUnitCost, type StockLot } from "../inventory/stock-ledger";
import { getPagination, parseUuid } from "../inventory/shared";
import { Notifications } from "../notifications";
import type { AuditContext } from "../types";

type TransferItem = {
  productId: string;
  quantity: number;
};

type CreateTransferInput = {
  destinationWarehouseId: string;
  items: TransferItem[];
  notes?: string | null;
  sourceWarehouseId: string;
};

type ValidateTransferInput = {
  items: TransferItem[];
  sourceWarehouseId: string;
};

/**
 * Generate a unique transfer number with format TRF-YYYYMMDD-XXXXXX.
 */
function generateTransferNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `TRF-${date}-${random}`;
}

/**
 * Business logic for warehouse-to-warehouse stock transfers.
 * All stock mutations happen inside a single database transaction.
 */
export class Transfer {
  /**
   * Validate stock availability for a proposed transfer without executing it.
   */
  static async validateTransferStock(input: ValidateTransferInput) {
    const sourceWarehouseId = parseUuid(input.sourceWarehouseId, "ID gudang asal tidak valid.");
    const results = [];

    for (const item of input.items) {
      const productId = parseUuid(item.productId, "ID produk tidak valid.");
      const [stockRow] = await dbRead
        .select({
          availableStock: sql<number>`coalesce(sum(${stockBatches.quantityRemaining}), 0)::int`,
        })
        .from(stockBatches)
        .where(
          and(
            eq(stockBatches.productId, productId),
            eq(stockBatches.warehouseId, sourceWarehouseId),
            gt(stockBatches.quantityRemaining, 0),
          ),
        );

      const available = Number(stockRow?.availableStock ?? 0);
      results.push({
        available,
        isValid: available >= item.quantity,
        productId: item.productId,
        quantity: item.quantity,
      });
    }

    return results;
  }

  /**
   * Execute a complete transfer atomically.
   * Validates stock, runs FIFO batch consumption, creates movements, commits.
   * Post-commit side effects (sync job, low-stock check, notifications) run after.
   */
  static async createAndComplete(input: CreateTransferInput, context: AuditContext) {
    const sourceId = parseUuid(input.sourceWarehouseId, "ID gudang asal tidak valid.");
    const destId = parseUuid(input.destinationWarehouseId, "ID gudang tujuan tidak valid.");

    if (sourceId === destId) {
      throw new TransferSameWarehouseError();
    }

    const [sourceWarehouse] = await dbRead
      .select()
      .from(warehouses)
      .where(eq(warehouses.id, sourceId))
      .limit(1);

    if (!sourceWarehouse) throw new NotFoundAppError("Gudang asal tidak ditemukan.");
    if (!sourceWarehouse.isActive) throw new ValidationAppError("Gudang asal tidak aktif.");

    const [destWarehouse] = await dbRead
      .select()
      .from(warehouses)
      .where(eq(warehouses.id, destId))
      .limit(1);

    if (!destWarehouse) throw new NotFoundAppError("Gudang tujuan tidak ditemukan.");
    if (!destWarehouse.isActive) throw new ValidationAppError("Gudang tujuan tidak aktif.");

    const validatedProducts = await Promise.all(
      input.items.map(async (item) => {
        const productId = parseUuid(item.productId, "ID produk tidak valid.");
        const [product] = await dbRead
          .select()
          .from(products)
          .where(eq(products.id, productId))
          .limit(1);

        if (!product) throw new NotFoundAppError(`Produk tidak ditemukan: ${item.productId}`);
        if (!product.isActive) throw new ValidationAppError(`Produk tidak aktif: ${product.sku}`);
        if (item.quantity <= 0) throw new ValidationAppError(`Jumlah harus lebih dari 0 untuk produk ${product.sku}.`);

        return { product, quantity: item.quantity };
      }),
    );

    const transferNumber = generateTransferNumber();

    const result = await db.transaction(async (tx) => {
      const [transfer] = await tx
        .insert(stockTransfers)
        .values({
          destinationWarehouseId: destId,
          notes: input.notes ?? null,
          requestedBy: context.actorUserId!,
          sourceWarehouseId: sourceId,
          status: "PROCESSING",
          transferNumber,
        })
        .returning();

      const createdItems = [];
      const outMovements = [];
      const inMovements = [];

      for (const { product, quantity } of validatedProducts) {
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
              eq(stockBatches.warehouseId, sourceId),
              gt(stockBatches.quantityRemaining, 0),
            ),
          )
          .orderBy(asc(stockBatches.receivedAt))
          .for("update");

        const lots: StockLot[] = batches;
        const consumedLots = consumeStockLots(lots, quantity, "FIFO");

        for (const consumed of consumedLots) {
          await tx
            .update(stockBatches)
            .set({
              quantityRemaining: consumed.nextQuantityRemaining,
              updatedAt: new Date(),
            })
            .where(eq(stockBatches.id, consumed.id));
        }

        const weightedCost = getWeightedUnitCost(consumedLots);

        const [outMovement] = await tx
          .insert(stockMovements)
          .values({
            createdBy: context.actorUserId ?? null,
            notes: input.notes ?? null,
            productId: product.id,
            quantity,
            referenceId: transfer.id,
            referenceType: "TRANSFER",
            type: "TRANSFER_OUT",
            unitCost: weightedCost,
            warehouseId: sourceId,
          })
          .returning();

        const [destBatch] = await tx
          .insert(stockBatches)
          .values({
            productId: product.id,
            quantityInitial: quantity,
            quantityRemaining: quantity,
            receivedAt: new Date(),
            sourceMovementId: outMovement.id,
            unitCost: weightedCost,
            warehouseId: destId,
          })
          .returning();

        const [inMovement] = await tx
          .insert(stockMovements)
          .values({
            createdBy: context.actorUserId ?? null,
            notes: input.notes ?? null,
            productId: product.id,
            quantity,
            referenceId: transfer.id,
            referenceType: "TRANSFER",
            type: "TRANSFER_IN",
            unitCost: weightedCost,
            warehouseId: destId,
          })
          .returning();

        await tx
          .update(stockBatches)
          .set({
            sourceMovementId: inMovement.id,
            updatedAt: new Date(),
          })
          .where(eq(stockBatches.id, destBatch.id));

        const [item] = await tx
          .insert(stockTransferItems)
          .values({
            productId: product.id,
            quantity,
            transferId: transfer.id,
          })
          .returning();

        createdItems.push(item);
        outMovements.push(outMovement);
        inMovements.push(inMovement);
      }

      const [completedTransfer] = await tx
        .update(stockTransfers)
        .set({
          completedAt: new Date(),
          status: "COMPLETED",
          updatedAt: new Date(),
        })
        .where(eq(stockTransfers.id, transfer.id))
        .returning();

      return { completedTransfer, createdItems, inMovements, outMovements };
    });

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.TRANSFER_COMPLETED,
        description: `Transfer ${transferNumber} dari ${sourceWarehouse.name} ke ${destWarehouse.name} selesai.`,
        entityId: result.completedTransfer.id,
        entityType: "stock_transfer",
        metadata: {
          destinationWarehouseId: destId,
          itemCount: validatedProducts.length,
          sourceWarehouseId: sourceId,
          transferNumber,
        },
      },
      context,
    );

    await Notifications.createForRoles(["ADMIN", "WAREHOUSE_MANAGER"], {
      actionHref: `/transfers/${result.completedTransfer.id}`,
      message: `Transfer ${transferNumber} dari ${sourceWarehouse.name} ke ${destWarehouse.name} berhasil diselesaikan.`,
      severity: "success",
      title: "Transfer Selesai",
      type: "TRANSFER_COMPLETED",
    });

    return result;
  }

  /**
   * Cancel a transfer. Only PENDING or PROCESSING transfers can be cancelled.
   */
  static async cancel(transferId: string, context: AuditContext) {
    const id = parseUuid(transferId, "ID transfer tidak valid.");
    const [transfer] = await dbRead
      .select()
      .from(stockTransfers)
      .where(eq(stockTransfers.id, id))
      .limit(1);

    if (!transfer) throw new NotFoundAppError("Transfer tidak ditemukan.");
    if (transfer.status === "COMPLETED") throw new ValidationAppError("Transfer yang sudah selesai tidak dapat dibatalkan.");
    if (transfer.status === "CANCELLED") throw new ValidationAppError("Transfer sudah dibatalkan.");

    const [cancelled] = await db
      .update(stockTransfers)
      .set({
        cancelledAt: new Date(),
        status: "CANCELLED",
        updatedAt: new Date(),
      })
      .where(eq(stockTransfers.id, id))
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.TRANSFER_CANCELLED,
        description: `Transfer ${transfer.transferNumber} dibatalkan.`,
        entityId: transfer.id,
        entityType: "stock_transfer",
        metadata: { transferNumber: transfer.transferNumber },
      },
      context,
    );

    return cancelled;
  }

  /**
   * Get transfer detail with items, movements, and warehouse info.
   */
  static async getById(transferId: string) {
    const id = parseUuid(transferId, "ID transfer tidak valid.");
    const [transfer] = await dbRead
      .select({
        cancelledAt: stockTransfers.cancelledAt,
        completedAt: stockTransfers.completedAt,
        createdAt: stockTransfers.createdAt,
        destinationWarehouseCity: warehouses.city,
        destinationWarehouseId: stockTransfers.destinationWarehouseId,
        destinationWarehouseName: warehouses.name,
        errorMessage: stockTransfers.errorMessage,
        id: stockTransfers.id,
        notes: stockTransfers.notes,
        requestedBy: users.name,
        sourceWarehouseCity: sql<string>`src_wh.city`,
        sourceWarehouseId: stockTransfers.sourceWarehouseId,
        sourceWarehouseName: sql<string>`src_wh.name`,
        status: stockTransfers.status,
        transferNumber: stockTransfers.transferNumber,
        updatedAt: stockTransfers.updatedAt,
      })
      .from(stockTransfers)
      .innerJoin(warehouses, eq(stockTransfers.destinationWarehouseId, warehouses.id))
      .innerJoin(sql`warehouses src_wh`, sql`${stockTransfers.sourceWarehouseId} = src_wh.id`)
      .leftJoin(users, eq(stockTransfers.requestedBy, users.id))
      .where(eq(stockTransfers.id, id))
      .limit(1);

    if (!transfer) throw new NotFoundAppError("Transfer tidak ditemukan.");

    const items = await dbRead
      .select({
        id: stockTransferItems.id,
        productId: stockTransferItems.productId,
        productName: products.name,
        productSku: products.sku,
        quantity: stockTransferItems.quantity,
        unit: products.unit,
      })
      .from(stockTransferItems)
      .innerJoin(products, eq(stockTransferItems.productId, products.id))
      .where(eq(stockTransferItems.transferId, id));

    const movements = await dbRead
      .select({
        createdAt: stockMovements.createdAt,
        id: stockMovements.id,
        productName: products.name,
        productSku: products.sku,
        quantity: stockMovements.quantity,
        type: stockMovements.type,
        unitCost: stockMovements.unitCost,
        warehouseName: warehouses.name,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .innerJoin(warehouses, eq(stockMovements.warehouseId, warehouses.id))
      .where(
        and(
          eq(stockMovements.referenceId, id),
          eq(stockMovements.referenceType, "TRANSFER"),
        ),
      )
      .orderBy(asc(stockMovements.createdAt));

    return { ...transfer, items, movements };
  }

  /**
   * List transfers with pagination and filtering.
   */
  static async list(searchParams: Record<string, unknown>) {
    const filters = getFilters(searchParams);
    const where = filters.where;
    const conditions: SQL[] = [];

    if (typeof where.status === "string" && where.status) {
      conditions.push(eq(stockTransfers.status, where.status as TransferStatus));
    }

    if (typeof where.sourceWarehouseId === "string" && where.sourceWarehouseId) {
      conditions.push(eq(stockTransfers.sourceWarehouseId, where.sourceWarehouseId));
    }

    if (typeof where.destinationWarehouseId === "string" && where.destinationWarehouseId) {
      conditions.push(eq(stockTransfers.destinationWarehouseId, where.destinationWarehouseId));
    }

    if (typeof where.requestedBy === "string" && where.requestedBy) {
      conditions.push(eq(stockTransfers.requestedBy, where.requestedBy));
    }

    if (typeof where.dateFrom === "string" && where.dateFrom) {
      conditions.push(gte(stockTransfers.createdAt, new Date(where.dateFrom)));
    }

    if (typeof where.dateTo === "string" && where.dateTo) {
      conditions.push(lte(stockTransfers.createdAt, new Date(where.dateTo)));
    }

    if (typeof where.search === "string" && where.search) {
      conditions.push(sql`${stockTransfers.transferNumber} ilike ${"%" + where.search + "%"}`);
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ total }] = await dbRead
      .select({ total: count() })
      .from(stockTransfers)
      .where(whereCondition);
    const sortDirection = filters.sortDir === "asc" ? asc : desc;
    const data = await dbRead
      .select({
        cancelledAt: stockTransfers.cancelledAt,
        completedAt: stockTransfers.completedAt,
        createdAt: stockTransfers.createdAt,
        destinationWarehouseId: stockTransfers.destinationWarehouseId,
        destinationWarehouseName: warehouses.name,
        errorMessage: stockTransfers.errorMessage,
        id: stockTransfers.id,
        itemCount: sql<number>`(select count(*) from stock_transfer_items where transfer_id = ${stockTransfers.id})::int`,
        notes: stockTransfers.notes,
        requestedByName: users.name,
        sourceWarehouseId: stockTransfers.sourceWarehouseId,
        sourceWarehouseName: sql<string>`src_wh.name`,
        status: stockTransfers.status,
        transferNumber: stockTransfers.transferNumber,
      })
      .from(stockTransfers)
      .innerJoin(warehouses, eq(stockTransfers.destinationWarehouseId, warehouses.id))
      .innerJoin(sql`warehouses src_wh`, sql`${stockTransfers.sourceWarehouseId} = src_wh.id`)
      .leftJoin(users, eq(stockTransfers.requestedBy, users.id))
      .where(whereCondition)
      .orderBy(sortDirection(stockTransfers.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      data,
      pagination: getPagination(filters.page, filters.limit, Number(total)),
    };
  }
}
