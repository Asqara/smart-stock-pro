import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { AUDIT_ACTIONS } from "@/constants/auth";
import type { ProductStockStatus } from "@/constants/inventory";
import {
  categories,
  products,
  stockBatches,
  stockMovements,
  suppliers,
  users,
  warehouses,
} from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import {
  ConflictAppError,
  NotFoundAppError,
  ValidationAppError,
} from "@/lib/errors";
import { getFilters } from "@/utils/getFilters";

import { AuditLogs } from "../audit-logs";
import type { AuditContext } from "../types";
import {
  getPagination,
  getProductStockStatus,
  parseUuid,
} from "./shared";

type ProductCreateInput = {
  categoryId: string;
  description?: string | null;
  isActive?: boolean;
  minimumStock: number;
  name: string;
  price: number;
  sku: string;
  supplierId: string;
  unit: string;
};

type ProductUpdateInput = Partial<ProductCreateInput>;

type ProductListItem = {
  category: { id: string; name: string; slug: string };
  createdAt: Date;
  description: string | null;
  id: string;
  imageKey: string | null;
  imageUrl: string | null;
  isActive: boolean;
  minimumStock: number;
  name: string;
  price: number;
  sku: string;
  stockStatus: ProductStockStatus;
  supplier: { id: string; name: string };
  totalStock: number;
  unit: string;
  updatedAt: Date;
};

type ProductListResult = {
  data: ProductListItem[];
  pagination: {
    limit: number;
    page: number;
    pageCount: number;
    total: number;
  };
};

function getProductListSortColumn(sortBy?: string): AnyPgColumn | SQL {
  if (sortBy === "sku") return products.sku;
  if (sortBy === "name") return products.name;
  if (sortBy === "price") return products.price;
  if (sortBy === "minimumStock" || sortBy === "minimum_stock") {
    return products.minimumStock;
  }
  if (sortBy === "updatedAt" || sortBy === "updated_at") {
    return products.updatedAt;
  }
  if (sortBy === "stock" || sortBy === "total_stock") {
    return sql`total_stock`;
  }

  return products.createdAt;
}

function toProductListItem(row: {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  createdAt: Date;
  description: string | null;
  id: string;
  imageKey: string | null;
  imageUrl: string | null;
  isActive: boolean;
  minimumStock: number;
  name: string;
  price: number;
  sku: string;
  supplierId: string;
  supplierName: string;
  totalStock: number | null;
  unit: string;
  updatedAt: Date;
}): ProductListItem {
  const totalStock = Number(row.totalStock ?? 0);

  return {
    category: {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug,
    },
    createdAt: row.createdAt,
    description: row.description,
    id: row.id,
    imageKey: row.imageKey,
    imageUrl: row.imageUrl,
    isActive: row.isActive,
    minimumStock: row.minimumStock,
    name: row.name,
    price: row.price,
    sku: row.sku,
    stockStatus: getProductStockStatus(totalStock, row.minimumStock),
    supplier: {
      id: row.supplierId,
      name: row.supplierName,
    },
    totalStock,
    unit: row.unit,
    updatedAt: row.updatedAt,
  };
}

/**
 * Business logic for product master data and stock summaries.
 */
export class Products {
  /**
   * List products with joins, pagination, sorting, filtering, and stock summary.
   */
  static async list(
    searchParams: Record<string, unknown>,
  ): Promise<ProductListResult> {
    const filters = getFilters(searchParams);
    const where = filters.where;
    const conditions: SQL[] = [];
    const warehouseId =
      typeof where.warehouseId === "string"
        ? parseUuid(where.warehouseId, "ID gudang tidak valid.")
        : typeof where.warehouse_id === "string"
          ? parseUuid(where.warehouse_id, "ID gudang tidak valid.")
          : null;

    if (filters.search) {
      const keyword = filters.search.trim();
      conditions.push(
        or(
          sql`lower(${products.sku}) = lower(${keyword})`,
          ilike(products.sku, `${keyword}%`),
          ilike(products.name, `%${keyword}%`),
          ilike(categories.name, `%${keyword}%`),
          ilike(suppliers.name, `%${keyword}%`),
        )!,
      );
    }

    if (typeof where.categoryId === "string" && where.categoryId) {
      conditions.push(eq(products.categoryId, where.categoryId));
    }

    if (typeof where.category_id === "string" && where.category_id) {
      conditions.push(eq(products.categoryId, where.category_id));
    }

    if (typeof where.supplierId === "string" && where.supplierId) {
      conditions.push(eq(products.supplierId, where.supplierId));
    }

    if (typeof where.supplier_id === "string" && where.supplier_id) {
      conditions.push(eq(products.supplierId, where.supplier_id));
    }

    if (typeof where.isActive === "string" && where.isActive) {
      conditions.push(eq(products.isActive, where.isActive === "true"));
    }

    if (typeof where.is_active === "string" && where.is_active) {
      conditions.push(eq(products.isActive, where.is_active === "true"));
    }

    const batchConditions: SQL[] = [];

    if (warehouseId) {
      batchConditions.push(eq(stockBatches.warehouseId, warehouseId));
    }

    const batchWhere =
      batchConditions.length > 0 ? and(...batchConditions) : undefined;
    const stockSummary = dbRead
      .select({
        productId: stockBatches.productId,
        totalStock:
          sql<number>`coalesce(sum(${stockBatches.quantityRemaining}), 0)::int`.as(
            "total_stock",
          ),
      })
      .from(stockBatches)
      .where(batchWhere)
      .groupBy(stockBatches.productId)
      .as("stock_summary");
    const totalStockExpression =
      sql<number>`coalesce(${stockSummary.totalStock}, 0)`;

    const stockStatus =
      typeof where.stockStatus === "string"
        ? where.stockStatus
        : typeof where.stock_status === "string"
          ? where.stock_status
          : undefined;

    if (stockStatus === "available") {
      conditions.push(sql`${totalStockExpression} > ${products.minimumStock}`);
    }

    if (stockStatus === "out_of_stock") {
      conditions.push(sql`${totalStockExpression} <= 0`);
    }

    if (stockStatus === "critical") {
      conditions.push(
        sql`${totalStockExpression} > 0 and ${products.minimumStock} > 0 and ${totalStockExpression} <= greatest(1, floor(${products.minimumStock} / 2))`,
      );
    }

    if (stockStatus === "low_stock") {
      conditions.push(
        sql`${products.minimumStock} > 0 and ${totalStockExpression} > greatest(1, floor(${products.minimumStock} / 2)) and ${totalStockExpression} <= ${products.minimumStock}`,
      );
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    const baseQuery = dbRead
      .select({
        id: products.id,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(suppliers, eq(products.supplierId, suppliers.id))
      .leftJoin(stockSummary, eq(products.id, stockSummary.productId))
      .where(whereCondition);
    const [{ total }] = await dbRead
      .select({ total: count() })
      .from(baseQuery.as("product_count"));

    const sortDirection = filters.sortDir === "asc" ? asc : desc;
    const sortColumn = getProductListSortColumn(filters.sortBy);
    const orderBy = filters.search
      ? [
          sql`case
            when lower(${products.sku}) = lower(${filters.search}) then 1
            when ${products.sku} ilike ${`${filters.search}%`} then 2
            when ${products.name} ilike ${`%${filters.search}%`} then 3
            when ${categories.name} ilike ${`%${filters.search}%`} then 4
            when ${suppliers.name} ilike ${`%${filters.search}%`} then 4
            else 5
          end`,
          sortDirection(sortColumn),
        ]
      : [sortDirection(sortColumn)];
    const data = await dbRead
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        categorySlug: categories.slug,
        createdAt: products.createdAt,
        description: products.description,
        id: products.id,
        imageKey: products.imageKey,
        imageUrl: products.imageUrl,
        isActive: products.isActive,
        minimumStock: products.minimumStock,
        name: products.name,
        price: products.price,
        sku: products.sku,
        supplierId: suppliers.id,
        supplierName: suppliers.name,
        totalStock: totalStockExpression,
        unit: products.unit,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(suppliers, eq(products.supplierId, suppliers.id))
      .leftJoin(stockSummary, eq(products.id, stockSummary.productId))
      .where(whereCondition)
      .orderBy(...orderBy)
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      data: data.map(toProductListItem),
      pagination: getPagination(filters.page, filters.limit, Number(total)),
    };
  }

  /**
   * Search products by SKU, name, category, or supplier.
   */
  static search(searchParams: Record<string, unknown>) {
    return this.list({
      ...searchParams,
      isActive: "true",
      limit: searchParams.limit ?? "10",
    });
  }

  /**
   * Get product detail, stock by warehouse, batches, and movement history.
   */
  static async getById(id: string) {
    const productId = parseUuid(id, "ID produk tidak valid.");
    const [row] = await dbRead
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        categorySlug: categories.slug,
        createdAt: products.createdAt,
        description: products.description,
        id: products.id,
        imageKey: products.imageKey,
        imageUrl: products.imageUrl,
        isActive: products.isActive,
        minimumStock: products.minimumStock,
        name: products.name,
        price: products.price,
        sku: products.sku,
        supplierId: suppliers.id,
        supplierName: suppliers.name,
        totalStock:
          sql<number>`coalesce(sum(${stockBatches.quantityRemaining}), 0)::int`,
        unit: products.unit,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(suppliers, eq(products.supplierId, suppliers.id))
      .leftJoin(stockBatches, eq(products.id, stockBatches.productId))
      .where(eq(products.id, productId))
      .groupBy(products.id, categories.id, suppliers.id)
      .limit(1);

    if (!row) {
      throw new NotFoundAppError("Produk tidak ditemukan.");
    }

    const warehouseStock = await dbRead
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
      .where(eq(stockBatches.productId, productId))
      .groupBy(warehouses.id)
      .orderBy(asc(warehouses.name));
    const batches = await dbRead
      .select({
        id: stockBatches.id,
        quantityInitial: stockBatches.quantityInitial,
        quantityRemaining: stockBatches.quantityRemaining,
        receivedAt: stockBatches.receivedAt,
        unitCost: stockBatches.unitCost,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
      })
      .from(stockBatches)
      .innerJoin(warehouses, eq(stockBatches.warehouseId, warehouses.id))
      .where(eq(stockBatches.productId, productId))
      .orderBy(asc(stockBatches.receivedAt));
    const movements = await dbRead
      .select({
        createdAt: stockMovements.createdAt,
        createdByName: users.name,
        id: stockMovements.id,
        notes: stockMovements.notes,
        quantity: stockMovements.quantity,
        type: stockMovements.type,
        unitCost: stockMovements.unitCost,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
      })
      .from(stockMovements)
      .innerJoin(warehouses, eq(stockMovements.warehouseId, warehouses.id))
      .leftJoin(users, eq(stockMovements.createdBy, users.id))
      .where(eq(stockMovements.productId, productId))
      .orderBy(desc(stockMovements.createdAt))
      .limit(25);

    return {
      ...toProductListItem(row),
      batches,
      movements,
      warehouseStock,
    };
  }

  /**
   * Create product master data.
   */
  static async create(input: ProductCreateInput, context: AuditContext) {
    await this.ensureSkuAvailable(input.sku);
    await this.ensureCategoryActive(input.categoryId);
    await this.ensureSupplierActive(input.supplierId);

    const [product] = await db
      .insert(products)
      .values({
        categoryId: input.categoryId,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
        minimumStock: input.minimumStock,
        name: input.name,
        price: input.price,
        sku: input.sku,
        supplierId: input.supplierId,
        unit: input.unit,
      })
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.PRODUCT_CREATED,
        description: `Produk ${product.sku} dibuat.`,
        entityId: product.id,
        entityType: "product",
        metadata: { sku: product.sku },
      },
      context,
    );

    return this.getById(product.id);
  }

  /**
   * Update product master data.
   */
  static async update(
    id: string,
    input: ProductUpdateInput,
    context: AuditContext,
  ) {
    const productId = parseUuid(id, "ID produk tidak valid.");
    const current = await this.getExistingProduct(productId);

    if (input.sku && input.sku !== current.sku) {
      await this.ensureSkuAvailable(input.sku, productId);
    }

    if (input.categoryId) {
      await this.ensureCategoryActive(input.categoryId);
    }

    if (input.supplierId) {
      await this.ensureSupplierActive(input.supplierId);
    }

    const [product] = await db
      .update(products)
      .set({
        categoryId: input.categoryId ?? current.categoryId,
        description:
          "description" in input ? (input.description ?? null) : current.description,
        isActive: input.isActive ?? current.isActive,
        minimumStock: input.minimumStock ?? current.minimumStock,
        name: input.name ?? current.name,
        price: input.price ?? current.price,
        sku: input.sku ?? current.sku,
        supplierId: input.supplierId ?? current.supplierId,
        unit: input.unit ?? current.unit,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId))
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.PRODUCT_UPDATED,
        description: `Produk ${product.sku} diperbarui.`,
        entityId: product.id,
        entityType: "product",
        metadata: { sku: product.sku },
      },
      context,
    );

    return this.getById(product.id);
  }

  /**
   * Deactivate product master data.
   */
  static async deactivate(id: string, context: AuditContext) {
    const productId = parseUuid(id, "ID produk tidak valid.");
    const current = await this.getExistingProduct(productId);
    const [product] = await db
      .update(products)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId))
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.PRODUCT_DEACTIVATED,
        description: `Produk ${current.sku} dinonaktifkan.`,
        entityId: product.id,
        entityType: "product",
        metadata: { sku: current.sku },
      },
      context,
    );

    return this.getById(product.id);
  }

  /**
   * Get stock summary for one product.
   */
  static async getStockSummary(id: string) {
    const product = await this.getById(id);

    return {
      batches: product.batches,
      minimumStock: product.minimumStock,
      stockStatus: product.stockStatus,
      totalStock: product.totalStock,
      warehouseStock: product.warehouseStock,
    };
  }

  private static async ensureSkuAvailable(sku: string, exceptProductId?: string) {
    const [existing] = await dbRead
      .select()
      .from(products)
      .where(eq(products.sku, sku))
      .limit(1);

    if (!existing) {
      return;
    }

    if (exceptProductId && existing.id === exceptProductId) {
      return;
    }

    throw new ConflictAppError("SKU sudah digunakan.");
  }

  private static async ensureCategoryActive(categoryId: string) {
    const [category] = await dbRead
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (!category) {
      throw new NotFoundAppError("Kategori tidak ditemukan.");
    }

    if (!category.isActive) {
      throw new ValidationAppError("Kategori tidak aktif.");
    }
  }

  private static async ensureSupplierActive(supplierId: string) {
    const [supplier] = await dbRead
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, supplierId))
      .limit(1);

    if (!supplier) {
      throw new NotFoundAppError("Supplier tidak ditemukan.");
    }

    if (!supplier.isActive) {
      throw new ValidationAppError("Supplier tidak aktif.");
    }
  }

  private static async getExistingProduct(productId: string) {
    const [product] = await dbRead
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundAppError("Produk tidak ditemukan.");
    }

    return product;
  }
}
