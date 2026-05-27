import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { ROUTES } from "@/constants/routes";

import {
  DASHBOARD_ALERT_LIMIT,
  DASHBOARD_DEFAULT_RANGE_DAYS,
  DASHBOARD_EXPORT_FILE_PREFIX,
  DASHBOARD_RECENT_LIMIT,
} from "@/constants/dashboard";
import type {
  HealthCheckStatus,
  JobStatus,
  StockMovementType,
} from "@/constants/inventory";
import {
  categories,
  errorLogs,
  jobs,
  products,
  stockBatches,
  stockMovements,
  stockTransfers,
  systemHealthChecks,
  users,
  warehouses,
  apiResponseTimeLogs,
} from "@/drizzle-schema";
import { dbRead } from "@/lib/db";
import { ReportGenerationError } from "@/lib/errors";
import { getFilters } from "@/utils/getFilters";

import { getProductStockStatus, parseUuid } from "../inventory/shared";

type DashboardFilter = {
  categoryId: string | null;
  dateFrom: Date;
  dateTo: Date;
  limit: number;
  warehouseId: string | null;
};

type DashboardAlert = {
  actionHref: string;
  createdAt: Date;
  id: string;
  message: string;
  severity: "critical" | "info" | "warning";
  title: string;
  type: string;
};

type DashboardExportInput = Record<string, unknown> & {
  includeCharts?: boolean;
  includeLowStock?: boolean;
  includeMovements?: boolean;
};

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function endOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);

  return nextDate;
}

function getDateValue(value: unknown, fallback: Date, end = false) {
  if (typeof value !== "string" || !value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return end ? endOfDay(date) : startOfDay(date);
}

function getOptionalUuid(value: unknown, message: string) {
  if (typeof value !== "string" || !value) {
    return null;
  }

  return parseUuid(value, message);
}

function getDashboardFilter(searchParams: Record<string, unknown>): DashboardFilter {
  const filters = getFilters(searchParams);
  const where = filters.where;
  const today = new Date();
  const fallbackDateTo = endOfDay(today);
  const fallbackDateFrom = startOfDay(
    new Date(
      today.getTime() -
        (DASHBOARD_DEFAULT_RANGE_DAYS - 1) * 24 * 60 * 60 * 1000,
    ),
  );

  return {
    categoryId:
      getOptionalUuid(where.categoryId, "ID kategori tidak valid.") ??
      getOptionalUuid(where.category_id, "ID kategori tidak valid."),
    dateFrom: getDateValue(
      where.dateFrom ?? where.date_from,
      fallbackDateFrom,
    ),
    dateTo: getDateValue(where.dateTo ?? where.date_to, fallbackDateTo, true),
    limit: filters.limit || DASHBOARD_RECENT_LIMIT,
    warehouseId:
      getOptionalUuid(where.warehouseId, "ID gudang tidak valid.") ??
      getOptionalUuid(where.warehouse_id, "ID gudang tidak valid."),
  };
}

function getStockBatchConditions(filter: DashboardFilter) {
  const conditions: SQL[] = [];

  if (filter.warehouseId) {
    conditions.push(eq(stockBatches.warehouseId, filter.warehouseId));
  }

  return conditions;
}

function getProductConditions(filter: DashboardFilter) {
  const conditions: SQL[] = [eq(products.isActive, true)];

  if (filter.categoryId) {
    conditions.push(eq(products.categoryId, filter.categoryId));
  }

  return conditions;
}

function getMovementConditions(filter: DashboardFilter) {
  const conditions: SQL[] = [
    gte(stockMovements.createdAt, filter.dateFrom),
    lte(stockMovements.createdAt, filter.dateTo),
  ];

  if (filter.warehouseId) {
    conditions.push(eq(stockMovements.warehouseId, filter.warehouseId));
  }

  if (filter.categoryId) {
    conditions.push(eq(products.categoryId, filter.categoryId));
  }

  return conditions;
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDateBuckets(filter: DashboardFilter) {
  const buckets = new Map<
    string,
    Record<StockMovementType | "date", number | string>
  >();
  const current = startOfDay(filter.dateFrom);
  const end = startOfDay(filter.dateTo);

  while (current <= end) {
    const key = formatDateKey(current);
    buckets.set(key, {
      ADJUSTMENT: 0,
      IMPORT: 0,
      IN: 0,
      OUT: 0,
      TRANSFER_IN: 0,
      TRANSFER_OUT: 0,
      date: key,
    });
    current.setDate(current.getDate() + 1);
  }

  return buckets;
}

function toAlertDate(value: Date | null) {
  return value ?? new Date();
}

/**
 * Business logic for dashboard aggregation, alerts, map summaries, and PDF export.
 */
export class Dashboard {
  /**
   * Get KPI summary for the dashboard.
   */
  static async getDashboardSummary(searchParams: Record<string, unknown>) {
    const filter = getDashboardFilter(searchParams);
    const batchConditions = getStockBatchConditions(filter);
    const batchWhere =
      batchConditions.length > 0 ? and(...batchConditions) : undefined;
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
      .where(batchWhere)
      .groupBy(stockBatches.productId)
      .as("dashboard_stock_summary");
    const productConditions = getProductConditions(filter);
    const [summary] = await dbRead
      .select({
        criticalStockCount:
          sql<number>`count(*) filter (where coalesce(${stockSummary.totalStock}, 0) > 0 and ${products.minimumStock} > 0 and coalesce(${stockSummary.totalStock}, 0) <= greatest(1, floor(${products.minimumStock} / 2)))::int`,
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
      .leftJoin(stockSummary, eq(products.id, stockSummary.productId))
      .where(and(...productConditions));
    const warehouseConditions: SQL[] = [eq(warehouses.isActive, true)];

    if (filter.warehouseId) {
      warehouseConditions.push(eq(warehouses.id, filter.warehouseId));
    }

    const [{ totalWarehouses }] = await dbRead
      .select({ totalWarehouses: count() })
      .from(warehouses)
      .where(and(...warehouseConditions));
    const [{ pendingTransfers }] = await dbRead
      .select({ pendingTransfers: count() })
      .from(stockTransfers)
      .where(
        or(
          eq(stockTransfers.status, "PENDING"),
          eq(stockTransfers.status, "PROCESSING"),
        ),
      );
    const [{ runningJobs }] = await dbRead
      .select({ runningJobs: count() })
      .from(jobs)
      .where(or(eq(jobs.status, "PENDING"), eq(jobs.status, "PROCESSING")));
    const [{ criticalErrors }] = await dbRead
      .select({ criticalErrors: count() })
      .from(errorLogs)
      .where(
        and(eq(errorLogs.severity, "critical"), isNull(errorLogs.resolvedAt)),
      );
    const [latestApiResponse] = await dbRead
      .select()
      .from(apiResponseTimeLogs)
      .orderBy(desc(apiResponseTimeLogs.createdAt))
      .limit(1);
    const [latestApiMetric] = await dbRead
      .select()
      .from(systemHealthChecks)
      .where(eq(systemHealthChecks.serviceName, "api"))
      .orderBy(desc(systemHealthChecks.checkedAt))
      .limit(1);

    return {
      criticalErrors: Number(criticalErrors),
      criticalStockCount: Number(summary?.criticalStockCount ?? 0),
      inventoryValue: Number(summary?.inventoryValue ?? 0),
      lowStockCount: Number(summary?.lowStockCount ?? 0),
      outOfStockCount: Number(summary?.outOfStockCount ?? 0),
      pendingTransfers: Number(pendingTransfers),
      runningJobs: Number(runningJobs),
      totalProducts: Number(summary?.totalProducts ?? 0),
      totalStock: Number(summary?.totalStock ?? 0),
      totalWarehouses: Number(totalWarehouses),
      responseTimeMs: latestApiResponse?.durationMs ?? null,
      apiStatus: latestApiMetric?.status ?? "healthy",
    };
  }

  /**
   * Get stock movement trend grouped by date and type.
   */
  static async getStockMovementTrend(searchParams: Record<string, unknown>) {
    const filter = getDashboardFilter(searchParams);
    const dateExpression =
      sql<string>`to_char(date_trunc('day', ${stockMovements.createdAt}), 'YYYY-MM-DD')`;
    const rows = await dbRead
      .select({
        date: dateExpression,
        quantity: sql<number>`coalesce(sum(${stockMovements.quantity}), 0)::int`,
        type: stockMovements.type,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .where(and(...getMovementConditions(filter)))
      .groupBy(dateExpression, stockMovements.type)
      .orderBy(asc(dateExpression));
    const buckets = buildDateBuckets(filter);

    for (const row of rows) {
      const bucket = buckets.get(row.date);

      if (bucket) {
        bucket[row.type] = Number(row.quantity ?? 0);
      }
    }

    return [...buckets.values()];
  }

  /**
   * Get inventory value per warehouse.
   */
  static async getInventoryValueSummary(searchParams: Record<string, unknown>) {
    const filter = getDashboardFilter(searchParams);
    const conditions: SQL[] = [eq(products.isActive, true)];

    if (filter.warehouseId) {
      conditions.push(eq(stockBatches.warehouseId, filter.warehouseId));
    }

    if (filter.categoryId) {
      conditions.push(eq(products.categoryId, filter.categoryId));
    }

    return dbRead
      .select({
        city: warehouses.city,
        inventoryValue:
          sql<number>`coalesce(sum(${stockBatches.quantityRemaining} * ${stockBatches.unitCost}), 0)::int`,
        totalStock:
          sql<number>`coalesce(sum(${stockBatches.quantityRemaining}), 0)::int`,
        warehouseId: warehouses.id,
        warehouseName: warehouses.name,
      })
      .from(stockBatches)
      .innerJoin(products, eq(stockBatches.productId, products.id))
      .innerJoin(warehouses, eq(stockBatches.warehouseId, warehouses.id))
      .where(and(...conditions))
      .groupBy(warehouses.id)
      .orderBy(
        desc(
          sql<number>`coalesce(sum(${stockBatches.quantityRemaining} * ${stockBatches.unitCost}), 0)`,
        ),
      );
  }

  /**
   * Get stock distribution per warehouse.
   */
  static async getStockByWarehouse(searchParams: Record<string, unknown>) {
    const filter = getDashboardFilter(searchParams);
    const productWarehouseStock = dbRead
      .select({
        currentStock:
          sql<number>`coalesce(sum(${stockBatches.quantityRemaining}), 0)::int`.as(
            "current_stock",
          ),
        inventoryValue:
          sql<number>`coalesce(sum(${stockBatches.quantityRemaining} * ${stockBatches.unitCost}), 0)::int`.as(
            "inventory_value",
          ),
        productId: stockBatches.productId,
        warehouseId: stockBatches.warehouseId,
      })
      .from(stockBatches)
      .groupBy(stockBatches.productId, stockBatches.warehouseId)
      .as("product_warehouse_stock");
    const conditions: SQL[] = [eq(warehouses.isActive, true)];

    if (filter.warehouseId) {
      conditions.push(eq(warehouses.id, filter.warehouseId));
    }

    if (filter.categoryId) {
      conditions.push(eq(products.categoryId, filter.categoryId));
    }

    return dbRead
      .select({
        city: warehouses.city,
        criticalStockCount:
          sql<number>`count(distinct ${products.id}) filter (where coalesce(${productWarehouseStock.currentStock}, 0) > 0 and ${products.minimumStock} > 0 and coalesce(${productWarehouseStock.currentStock}, 0) <= greatest(1, floor(${products.minimumStock} / 2)))::int`,
        inventoryValue:
          sql<number>`coalesce(sum(${productWarehouseStock.inventoryValue}), 0)::int`,
        lowStockCount:
          sql<number>`count(distinct ${products.id}) filter (where ${products.minimumStock} > 0 and coalesce(${productWarehouseStock.currentStock}, 0) <= ${products.minimumStock})::int`,
        totalProducts:
          sql<number>`count(distinct ${productWarehouseStock.productId})::int`,
        totalStock:
          sql<number>`coalesce(sum(${productWarehouseStock.currentStock}), 0)::int`,
        warehouseCode: warehouses.code,
        warehouseId: warehouses.id,
        warehouseName: warehouses.name,
      })
      .from(warehouses)
      .leftJoin(
        productWarehouseStock,
        eq(warehouses.id, productWarehouseStock.warehouseId),
      )
      .leftJoin(products, eq(productWarehouseStock.productId, products.id))
      .where(and(...conditions))
      .groupBy(warehouses.id)
      .orderBy(asc(warehouses.name));
  }

  /**
   * Get low-stock products per warehouse.
   */
  static async getLowStockProducts(searchParams: Record<string, unknown>) {
    const filter = getDashboardFilter(searchParams);
    const rows = await this.getStockStatusProducts(searchParams, false);

    return rows.slice(0, filter.limit);
  }

  /**
   * Get critical-stock products per warehouse.
   */
  static async getCriticalStockProducts(searchParams: Record<string, unknown>) {
    const filter = getDashboardFilter(searchParams);
    const rows = await this.getStockStatusProducts(searchParams, true);

    return rows.slice(0, filter.limit);
  }

  /**
   * Get recent stock movements.
   */
  static async getRecentStockMovements(searchParams: Record<string, unknown>) {
    const filter = getDashboardFilter(searchParams);

    return dbRead
      .select({
        createdAt: stockMovements.createdAt,
        createdBy: users.name,
        id: stockMovements.id,
        productId: products.id,
        productName: products.name,
        productSku: products.sku,
        quantity: stockMovements.quantity,
        type: stockMovements.type,
        unit: products.unit,
        warehouseId: warehouses.id,
        warehouseName: warehouses.name,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .innerJoin(warehouses, eq(stockMovements.warehouseId, warehouses.id))
      .leftJoin(users, eq(stockMovements.createdBy, users.id))
      .where(and(...getMovementConditions(filter)))
      .orderBy(desc(stockMovements.createdAt))
      .limit(Math.min(filter.limit, DASHBOARD_RECENT_LIMIT));
  }

  /**
   * Get recent warehouse transfers.
   */
  static async getRecentTransfers(searchParams: Record<string, unknown>) {
    const filter = getDashboardFilter(searchParams);
    const conditions: SQL[] = [
      gte(stockTransfers.createdAt, filter.dateFrom),
      lte(stockTransfers.createdAt, filter.dateTo),
    ];

    if (filter.warehouseId) {
      conditions.push(
        or(
          eq(stockTransfers.sourceWarehouseId, filter.warehouseId),
          eq(stockTransfers.destinationWarehouseId, filter.warehouseId),
        )!,
      );
    }

    return dbRead
      .select({
        createdAt: stockTransfers.createdAt,
        destinationWarehouseName: warehouses.name,
        id: stockTransfers.id,
        sourceWarehouseName: sql<string>`source_warehouses.name`,
        status: stockTransfers.status,
        transferNumber: stockTransfers.transferNumber,
      })
      .from(stockTransfers)
      .innerJoin(warehouses, eq(stockTransfers.destinationWarehouseId, warehouses.id))
      .innerJoin(
        sql`warehouses source_warehouses`,
        sql`${stockTransfers.sourceWarehouseId} = source_warehouses.id`,
      )
      .where(and(...conditions))
      .orderBy(desc(stockTransfers.createdAt))
      .limit(Math.min(filter.limit, DASHBOARD_RECENT_LIMIT));
  }

  /**
   * Get critical dashboard alerts from stock, monitoring, errors, jobs, and transfers.
   */
  static async getDashboardAlerts(searchParams: Record<string, unknown>) {
    const filter = getDashboardFilter(searchParams);
    const alerts: DashboardAlert[] = [];
    const criticalProducts = await this.getCriticalStockProducts({
      ...searchParams,
      limit: "3",
    });

    for (const product of criticalProducts) {
      alerts.push({
        actionHref: ROUTES.PRODUCTS.DETAIL(product.productId),
        createdAt: new Date(),
        id: `stock-${product.productId}-${product.warehouseId}`,
        message: `${product.productName} di ${product.warehouseName} tersisa ${product.currentStock} ${product.unit}.`,
        severity: product.currentStock <= 0 ? "critical" : "warning",
        title: product.currentStock <= 0 ? "Stok habis" : "Stok kritis",
        type: "stock",
      });
    }

    const recentErrors = await dbRead
      .select()
      .from(errorLogs)
      .where(
        and(
          or(
            eq(errorLogs.severity, "critical"),
            eq(errorLogs.severity, "warning"),
          ),
          isNull(errorLogs.resolvedAt),
        ),
      )
      .orderBy(desc(errorLogs.createdAt))
      .limit(2);

    for (const errorLog of recentErrors) {
      alerts.push({
        actionHref: ROUTES.ERROR_LOGS,
        createdAt: errorLog.createdAt,
        id: `error-${errorLog.id}`,
        message: errorLog.message,
        severity: errorLog.severity === "critical" ? "critical" : "warning",
        title: errorLog.severity === "critical" ? "Error critical" : "Error warning",
        type: "error",
      });
    }

    const healthRows = await this.getLatestHealthRows();

    for (const health of healthRows.filter((row) => row.status !== "healthy")) {
      alerts.push({
        actionHref: ROUTES.MONITORING,
        createdAt: health.checkedAt,
        id: `health-${health.id}`,
        message: `${health.serviceName} berstatus ${health.status}. Response time ${health.responseTimeMs} ms.`,
        severity: health.status === "down" ? "critical" : "warning",
        title: "Monitoring perlu perhatian",
        type: "health",
      });
    }

    const failedJobs = await dbRead
      .select()
      .from(jobs)
      .where(eq(jobs.status, "FAILED"))
      .orderBy(desc(jobs.createdAt))
      .limit(2);

    for (const job of failedJobs) {
      alerts.push({
        actionHref: ROUTES.MONITORING,
        createdAt: toAlertDate(job.failedAt),
        id: `job-${job.id}`,
        message: job.errorMessage ?? `Job ${job.type} gagal diproses.`,
        severity: "warning",
        title: "Job gagal",
        type: "job",
      });
    }

    return alerts
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, Math.min(filter.limit, DASHBOARD_ALERT_LIMIT));
  }

  /**
   * Get all data needed by dashboard PDF export.
   */
  static async getDashboardExportData(searchParams: Record<string, unknown>) {
    const [
      summary,
      stockTrend,
      inventoryValue,
      stockByWarehouse,
      lowStock,
      criticalStock,
      recentMovements,
      recentTransfers,
      alerts,
      health,
    ] = await Promise.all([
      this.getDashboardSummary(searchParams),
      this.getStockMovementTrend(searchParams),
      this.getInventoryValueSummary(searchParams),
      this.getStockByWarehouse(searchParams),
      this.getLowStockProducts(searchParams),
      this.getCriticalStockProducts(searchParams),
      this.getRecentStockMovements(searchParams),
      this.getRecentTransfers(searchParams),
      this.getDashboardAlerts(searchParams),
      this.getLatestHealthRows(),
    ]);

    return {
      alerts,
      criticalStock,
      health,
      inventoryValue,
      lowStock,
      recentMovements,
      recentTransfers,
      stockByWarehouse,
      stockTrend,
      summary,
    };
  }

  /**
   * Generate dashboard PDF buffer.
   */
  static async generateDashboardPdf(
    input: DashboardExportInput,
    generatedBy: string,
  ): Promise<Buffer> {
    // Use pdfmake's Node.js printer API - not the browser build.
    // The browser build uses `this.pdfMake` which is undefined in ESM strict mode.
    // @ts-expect-error - pdfmake/src/printer has no TypeScript declaration file
    const printerModule = await import("pdfmake/src/printer");
    const PdfPrinter = (printerModule as any).default ?? printerModule;

    const vfsModule = await import("pdfmake/build/vfs_fonts");
    // vfs_fonts exports the font map directly: { "Roboto-Regular.ttf": "base64...", ... }
    const vfs: Record<string, string> =
      (vfsModule as any).default ??
      (vfsModule as any) ??
      {};

    const toFontBuffer = (key: string) => {
      const raw = vfs[key];
      return raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
    };

    const printer = new PdfPrinter({
      Roboto: {
        normal: toFontBuffer("Roboto-Regular.ttf"),
        bold: toFontBuffer("Roboto-Medium.ttf"),
        italics: toFontBuffer("Roboto-Italic.ttf"),
        bolditalics: toFontBuffer("Roboto-MediumItalic.ttf"),
      },
    });

    const data = await this.getDashboardExportData(input);
    const filter = getDashboardFilter(input);
    const now = new Date();
    const summaryRows = [
      ["Total Produk", data.summary.totalProducts],
      ["Total Gudang", data.summary.totalWarehouses],
      ["Total Stok", data.summary.totalStock],
      ["Nilai Inventaris", `Rp${data.summary.inventoryValue.toLocaleString("id-ID")}`],
      ["Stok Rendah", data.summary.lowStockCount],
      ["Transfer Pending", data.summary.pendingTransfers],
    ];
    const filterRows = [
      ["Tanggal Mulai", filter.dateFrom.toLocaleDateString("id-ID")],
      ["Tanggal Akhir", filter.dateTo.toLocaleDateString("id-ID")],
      ["Gudang", filter.warehouseId ?? "Semua Gudang"],
      ["Kategori", filter.categoryId ?? "Semua Kategori"],
    ];
    const lowStockRows = data.lowStock.slice(0, 10).map((row) => [
      row.productSku,
      row.productName,
      row.warehouseName,
      `${row.currentStock} ${row.unit}`,
      `${row.minimumStock} ${row.unit}`,
      row.stockStatus,
    ]);
    const criticalStockRows = data.criticalStock.slice(0, 10).map((row) => [
      row.productSku,
      row.productName,
      row.warehouseName,
      `${row.currentStock} ${row.unit}`,
      `${row.minimumStock} ${row.unit}`,
      row.stockStatus,
    ]);
    const warehouseRows = data.stockByWarehouse.map((row) => [
      row.warehouseName,
      row.city,
      String(row.totalProducts),
      String(row.totalStock),
      `Rp${Number(row.inventoryValue).toLocaleString("id-ID")}`,
      row.lowStockCount > 0 ? "Perlu perhatian" : "Sehat",
    ]);
    const movementRows = data.recentMovements.slice(0, 10).map((row) => [
      new Date(row.createdAt).toLocaleDateString("id-ID"),
      row.productName,
      row.warehouseName,
      row.type,
      `${row.quantity} ${row.unit}`,
      row.createdBy ?? "-",
    ]);
    const chartRows = data.stockByWarehouse.map((row) => [
      row.warehouseName,
      {
        canvas: [
          {
            color: "#2563EB",
            h: 8,
            type: "rect",
            w: Math.max(12, Math.min(160, Number(row.totalStock) / 2)),
            x: 0,
            y: 0,
          },
        ],
      },
      String(row.totalStock),
    ]);
    const docDefinition = {
      content: [
        { style: "title", text: "SmartStock Pro" },
        { style: "subtitle", text: "Dashboard Inventaris PT Maju Bersama Digital" },
        {
          style: "meta",
          text: `Dibuat: ${now.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}`,
        },
        { style: "meta", text: `Dibuat oleh: ${generatedBy}` },
        { margin: [0, 12, 0, 8], style: "section", text: "Filter" },
        {
          table: {
            body: filterRows.map(([label, value]) => [
              { bold: true, fillColor: "#E0F2FE", text: label },
              String(value),
            ]),
            widths: ["*", "*"],
          },
        },
        { margin: [0, 12, 0, 8], style: "section", text: "Ringkasan" },
        {
          table: {
            body: summaryRows.map(([label, value]) => [
              { bold: true, fillColor: "#F1F5F9", text: label },
              String(value),
            ]),
            widths: ["*", "*"],
          },
        },
        { margin: [0, 14, 0, 8], style: "section", text: "Visual Stok per Gudang" },
        {
          table: {
            body: [["Gudang", "Distribusi", "Total Stok"], ...chartRows],
            headerRows: 1,
            widths: ["*", 180, "auto"],
          },
        },
        { margin: [0, 14, 0, 8], style: "section", text: "Stok Rendah" },
        {
          table: {
            body: [
              ["SKU", "Produk", "Gudang", "Stok", "Minimum", "Status"],
              ...(lowStockRows.length > 0
                ? lowStockRows
                : [["-", "Tidak ada stok rendah", "-", "-", "-", "-"]]),
            ],
            headerRows: 1,
            widths: ["auto", "*", "*", "auto", "auto", "auto"],
          },
        },
        { margin: [0, 14, 0, 8], style: "section", text: "Stok Kritis" },
        {
          table: {
            body: [
              ["SKU", "Produk", "Gudang", "Stok", "Minimum", "Status"],
              ...(criticalStockRows.length > 0
                ? criticalStockRows
                : [["-", "Tidak ada stok kritis", "-", "-", "-", "-"]]),
            ],
            headerRows: 1,
            widths: ["auto", "*", "*", "auto", "auto", "auto"],
          },
        },
        { margin: [0, 14, 0, 8], style: "section", text: "Stok per Gudang" },
        {
          table: {
            body: [
              ["Gudang", "Kota", "Produk", "Stok", "Nilai", "Status"],
              ...warehouseRows,
            ],
            headerRows: 1,
            widths: ["*", "*", "auto", "auto", "auto", "*"],
          },
        },
        { margin: [0, 14, 0, 8], style: "section", text: "Movement Terbaru" },
        {
          table: {
            body: [
              ["Tanggal", "Produk", "Gudang", "Tipe", "Jumlah", "User"],
              ...(movementRows.length > 0
                ? movementRows
                : [["-", "Belum ada movement", "-", "-", "-", "-"]]),
            ],
            headerRows: 1,
            widths: ["auto", "*", "*", "auto", "auto", "*"],
          },
        },
      ],
      defaultStyle: {
        fontSize: 9,
      },
      footer: (currentPage: number, pageCount: number) => ({
        alignment: "center",
        color: "#64748B",
        fontSize: 8,
        text: `SmartStock Pro - ${currentPage} dari ${pageCount}`,
      }),
      styles: {
        meta: { color: "#64748B", fontSize: 9, margin: [0, 2, 0, 0] },
        section: { bold: true, color: "#0F172A", fontSize: 12 },
        subtitle: { color: "#334155", fontSize: 11, margin: [0, 2, 0, 0] },
        title: { bold: true, color: "#0F172A", fontSize: 18 },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", (err: Error) =>
        reject(new ReportGenerationError(err.message ?? "PDF dashboard gagal dibuat.")),
      );
      pdfDoc.end();
    });
  }

  /**
   * Build dashboard PDF filename.
   */
  static getDashboardPdfFileName() {
    return `${DASHBOARD_EXPORT_FILE_PREFIX}-${formatDateKey(new Date())}.pdf`;
  }

  private static async getStockStatusProducts(
    searchParams: Record<string, unknown>,
    criticalOnly: boolean,
  ) {
    const filter = getDashboardFilter(searchParams);
    const conditions: SQL[] = [eq(products.isActive, true)];

    if (filter.warehouseId) {
      conditions.push(eq(stockBatches.warehouseId, filter.warehouseId));
    }

    if (filter.categoryId) {
      conditions.push(eq(products.categoryId, filter.categoryId));
    }

    const currentStock =
      sql<number>`coalesce(sum(${stockBatches.quantityRemaining}), 0)::int`;
    const statusCondition = criticalOnly
      ? sql`${currentStock} <= 0 or (${products.minimumStock} > 0 and ${currentStock} <= greatest(1, floor(${products.minimumStock} / 2)))`
      : sql`${products.minimumStock} > 0 and ${currentStock} <= ${products.minimumStock}`;
    const rows = await dbRead
      .select({
        categoryName: categories.name,
        currentStock,
        minimumStock: products.minimumStock,
        productId: products.id,
        productName: products.name,
        productSku: products.sku,
        unit: products.unit,
        warehouseId: warehouses.id,
        warehouseName: warehouses.name,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(stockBatches, eq(products.id, stockBatches.productId))
      .innerJoin(warehouses, eq(stockBatches.warehouseId, warehouses.id))
      .where(and(...conditions))
      .groupBy(products.id, categories.id, warehouses.id)
      .having(statusCondition)
      .orderBy(asc(currentStock), asc(products.name))
      .limit(Math.max(filter.limit, DASHBOARD_RECENT_LIMIT));

    return rows.map((row) => ({
      ...row,
      currentStock: Number(row.currentStock ?? 0),
      stockStatus: getProductStockStatus(
        Number(row.currentStock ?? 0),
        row.minimumStock,
      ),
    }));
  }

  private static async getLatestHealthRows() {
    const latestAt = dbRead
      .select({
        checkedAt: sql<Date>`max(${systemHealthChecks.checkedAt})`.as(
          "latest_checked_at",
        ),
        serviceName: systemHealthChecks.serviceName,
      })
      .from(systemHealthChecks)
      .groupBy(systemHealthChecks.serviceName)
      .as("latest_health");

    return dbRead
      .select({
        checkedAt: systemHealthChecks.checkedAt,
        cpuUsage: systemHealthChecks.cpuUsage,
        id: systemHealthChecks.id,
        memoryUsage: systemHealthChecks.memoryUsage,
        metadata: systemHealthChecks.metadata,
        responseTimeMs: systemHealthChecks.responseTimeMs,
        serviceName: systemHealthChecks.serviceName,
        status: systemHealthChecks.status,
        uptimeSeconds: systemHealthChecks.uptimeSeconds,
      })
      .from(systemHealthChecks)
      .innerJoin(
        latestAt,
        and(
          eq(systemHealthChecks.serviceName, latestAt.serviceName),
          eq(systemHealthChecks.checkedAt, latestAt.checkedAt),
        ),
      )
      .orderBy(asc(systemHealthChecks.serviceName));
  }
}
