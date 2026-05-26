import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { AUDIT_ACTIONS } from "@/constants/auth";
import {
  products,
  stockBatches,
  stockMovements,
  warehouses,
} from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import { ConflictAppError, NotFoundAppError } from "@/lib/errors";
import { getFilters } from "@/utils/getFilters";

import { AuditLogs } from "../audit-logs";
import type { AuditContext } from "../types";
import {
  getPagination,
  parseUuid,
} from "./shared";

type WarehouseCreateInput = {
  address?: string | null;
  city: string;
  code: string;
  isActive?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  name: string;
};

type WarehouseUpdateInput = Partial<WarehouseCreateInput>;

function getWarehouseSortColumn(sortBy?: string): AnyPgColumn {
  if (sortBy === "code") return warehouses.code;
  if (sortBy === "name") return warehouses.name;
  if (sortBy === "city") return warehouses.city;
  if (sortBy === "updatedAt" || sortBy === "updated_at") {
    return warehouses.updatedAt;
  }

  return warehouses.createdAt;
}

/**
 * Business logic for warehouses.
 */
export class Warehouses {
  /**
   * List warehouses with pagination, sorting, and filtering.
   */
  static async list(searchParams: Record<string, unknown>) {
    const filters = getFilters(searchParams);
    const where = filters.where;
    const conditions: SQL[] = [];

    if (filters.search) {
      conditions.push(
        or(
          ilike(warehouses.code, `%${filters.search}%`),
          ilike(warehouses.name, `%${filters.search}%`),
          ilike(warehouses.city, `%${filters.search}%`),
        )!,
      );
    }

    if (typeof where.city === "string" && where.city) {
      conditions.push(ilike(warehouses.city, `%${where.city}%`));
    }

    if (typeof where.isActive === "string" && where.isActive) {
      conditions.push(eq(warehouses.isActive, where.isActive === "true"));
    }

    if (typeof where.is_active === "string" && where.is_active) {
      conditions.push(eq(warehouses.isActive, where.is_active === "true"));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ total }] = await dbRead
      .select({ total: count() })
      .from(warehouses)
      .where(whereCondition);
    const stockSummary = dbRead
      .select({
        totalProducts:
          sql<number>`count(distinct ${stockBatches.productId})::int`.as(
            "total_products",
          ),
        totalStock:
          sql<number>`coalesce(sum(${stockBatches.quantityRemaining}), 0)::int`.as(
            "total_stock",
          ),
        warehouseId: stockBatches.warehouseId,
      })
      .from(stockBatches)
      .groupBy(stockBatches.warehouseId)
      .as("warehouse_stock_summary");
    const sortDirection = filters.sortDir === "asc" ? asc : desc;
    const data = await dbRead
      .select({
        address: warehouses.address,
        city: warehouses.city,
        code: warehouses.code,
        createdAt: warehouses.createdAt,
        id: warehouses.id,
        isActive: warehouses.isActive,
        latitude: warehouses.latitude,
        longitude: warehouses.longitude,
        name: warehouses.name,
        totalProducts:
          sql<number>`coalesce(${stockSummary.totalProducts}, 0)::int`,
        totalStock: sql<number>`coalesce(${stockSummary.totalStock}, 0)::int`,
        updatedAt: warehouses.updatedAt,
      })
      .from(warehouses)
      .leftJoin(stockSummary, eq(warehouses.id, stockSummary.warehouseId))
      .where(whereCondition)
      .orderBy(sortDirection(getWarehouseSortColumn(filters.sortBy)))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      data,
      pagination: getPagination(filters.page, filters.limit, Number(total)),
    };
  }

  /**
   * Get one warehouse by id.
   */
  static async getById(id: string) {
    const warehouseId = parseUuid(id, "ID gudang tidak valid.");
    const [warehouse] = await dbRead
      .select()
      .from(warehouses)
      .where(eq(warehouses.id, warehouseId))
      .limit(1);

    if (!warehouse) {
      throw new NotFoundAppError("Gudang tidak ditemukan.");
    }

    return warehouse;
  }

  /**
   * Create a warehouse.
   */
  static async create(input: WarehouseCreateInput, context: AuditContext) {
    await this.ensureCodeAvailable(input.code);

    const [warehouse] = await db
      .insert(warehouses)
      .values({
        address: input.address ?? null,
        city: input.city,
        code: input.code,
        isActive: input.isActive ?? true,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        name: input.name,
      })
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.WAREHOUSE_CREATED,
        description: `Gudang ${warehouse.name} dibuat.`,
        entityId: warehouse.id,
        entityType: "warehouse",
        metadata: { code: warehouse.code, city: warehouse.city },
      },
      context,
    );

    return warehouse;
  }

  /**
   * Update a warehouse.
   */
  static async update(
    id: string,
    input: WarehouseUpdateInput,
    context: AuditContext,
  ) {
    const warehouseId = parseUuid(id, "ID gudang tidak valid.");
    const current = await this.getById(warehouseId);

    if (input.code && input.code !== current.code) {
      await this.ensureCodeAvailable(input.code, warehouseId);
    }

    const [warehouse] = await db
      .update(warehouses)
      .set({
        address: "address" in input ? (input.address ?? null) : current.address,
        city: input.city ?? current.city,
        code: input.code ?? current.code,
        isActive: input.isActive ?? current.isActive,
        latitude:
          "latitude" in input ? (input.latitude ?? null) : current.latitude,
        longitude:
          "longitude" in input ? (input.longitude ?? null) : current.longitude,
        name: input.name ?? current.name,
        updatedAt: new Date(),
      })
      .where(eq(warehouses.id, warehouseId))
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.WAREHOUSE_UPDATED,
        description: `Gudang ${warehouse.name} diperbarui.`,
        entityId: warehouse.id,
        entityType: "warehouse",
        metadata: { code: warehouse.code, city: warehouse.city },
      },
      context,
    );

    return warehouse;
  }

  /**
   * Deactivate a warehouse.
   */
  static async deactivate(id: string, context: AuditContext) {
    const warehouseId = parseUuid(id, "ID gudang tidak valid.");
    const current = await this.getById(warehouseId);
    const [warehouse] = await db
      .update(warehouses)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(warehouses.id, warehouseId))
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.WAREHOUSE_DEACTIVATED,
        description: `Gudang ${current.name} dinonaktifkan.`,
        entityId: warehouse.id,
        entityType: "warehouse",
        metadata: { code: current.code, city: current.city },
      },
      context,
    );

    return warehouse;
  }

  /**
   * Get stock summary for one warehouse.
   */
  static async getStockSummary(id: string) {
    const warehouseId = parseUuid(id, "ID gudang tidak valid.");
    await this.getById(warehouseId);

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
      .where(eq(stockBatches.warehouseId, warehouseId))
      .groupBy(products.id)
      .orderBy(asc(products.name));
  }

  /**
   * Get recent stock movements for one warehouse.
   */
  static async getRecentMovements(id: string) {
    const warehouseId = parseUuid(id, "ID gudang tidak valid.");

    return dbRead
      .select({
        createdAt: stockMovements.createdAt,
        id: stockMovements.id,
        productName: products.name,
        productSku: products.sku,
        quantity: stockMovements.quantity,
        type: stockMovements.type,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .where(eq(stockMovements.warehouseId, warehouseId))
      .orderBy(desc(stockMovements.createdAt))
      .limit(20);
  }

  private static async ensureCodeAvailable(code: string, exceptWarehouseId?: string) {
    const [existing] = await dbRead
      .select()
      .from(warehouses)
      .where(eq(warehouses.code, code))
      .limit(1);

    if (!existing) {
      return;
    }

    if (exceptWarehouseId && existing.id === exceptWarehouseId) {
      return;
    }

    throw new ConflictAppError("Kode gudang sudah digunakan.");
  }
}
