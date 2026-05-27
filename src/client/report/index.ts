import "server-only";

import { and, asc, count, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { AUDIT_ACTIONS } from "@/constants/auth";
import type { ReportType } from "@/constants/inventory";
import {
  categories,
  products,
  reportExports,
  stockBatches,
  stockMovements,
  users,
  warehouses,
} from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import { NotFoundAppError, ReportGenerationError } from "@/lib/errors";
import { getFilters } from "@/utils/getFilters";

import { AuditLogs } from "../audit-logs";
import { getPagination, parseUuid } from "../inventory/shared";
import { Notifications } from "../notifications";
import type { AuditContext } from "../types";

type ReportFilter = {
  categoryId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  stockStatus?: string | null;
  warehouseId?: string | null;
};

type GenerateReportInput = {
  filters?: ReportFilter;
  outputFormat?: "PDF" | "CSV";
  reportType: ReportType;
};

/**
 * Business logic for report generation and export.
 */
export class Report {
  /**
   * Create a report export record linked to a job.
   */
  static async createExportRecord(
    input: GenerateReportInput,
    jobId: string,
    context: AuditContext,
  ) {
    const fileName = `${input.reportType.toLowerCase()}-${Date.now()}.${input.outputFormat === "CSV" ? "csv" : "pdf"}`;
    const [record] = await db
      .insert(reportExports)
      .values({
        fileName,
        filter: (input.filters ?? {}) as Record<string, unknown>,
        generatedBy: context.actorUserId!,
        jobId,
        status: "PENDING",
        type: input.reportType,
      })
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.REPORT_REQUESTED,
        description: `Laporan ${input.reportType} diminta.`,
        entityId: record.id,
        entityType: "report_export",
        metadata: { filters: input.filters, outputFormat: input.outputFormat, reportType: input.reportType },
      },
      context,
    );

    return record;
  }

  /**
   * Mark report as completed after generation.
   */
  static async markCompleted(reportId: string) {
    const [record] = await db
      .update(reportExports)
      .set({ completedAt: new Date(), status: "COMPLETED", updatedAt: new Date() })
      .where(eq(reportExports.id, reportId))
      .returning();

    return record;
  }

  /**
   * Mark report as failed.
   */
  static async markFailed(reportId: string) {
    const [record] = await db
      .update(reportExports)
      .set({ status: "FAILED", updatedAt: new Date() })
      .where(eq(reportExports.id, reportId))
      .returning();

    return record;
  }

  /**
   * Generate inventory summary data for PDF/CSV export.
   */
  static async generateInventorySummaryData(filter: ReportFilter) {
    const conditions: SQL[] = [];

    if (filter.warehouseId) {
      conditions.push(eq(stockBatches.warehouseId, filter.warehouseId));
    }

    if (filter.categoryId) {
      conditions.push(eq(products.categoryId, filter.categoryId));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await dbRead
      .select({
        categoryName: categories.name,
        currentStock: sql<number>`coalesce(sum(${stockBatches.quantityRemaining}), 0)::int`,
        inventoryValue: sql<number>`coalesce(sum(${stockBatches.quantityRemaining} * ${stockBatches.unitCost}), 0)::int`,
        minimumStock: products.minimumStock,
        productName: products.name,
        productSku: products.sku,
        unit: products.unit,
        warehouseName: warehouses.name,
      })
      .from(stockBatches)
      .innerJoin(products, eq(stockBatches.productId, products.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(warehouses, eq(stockBatches.warehouseId, warehouses.id))
      .where(whereCondition)
      .groupBy(products.id, categories.id, warehouses.id)
      .orderBy(asc(warehouses.name), asc(products.name));

    return rows.map((row) => ({
      ...row,
      stockStatus:
        Number(row.currentStock) <= 0
          ? "Stok Habis"
          : row.minimumStock > 0 &&
              Number(row.currentStock) <= Math.max(1, Math.floor(row.minimumStock / 2))
            ? "Stok Kritis"
            : row.minimumStock > 0 && Number(row.currentStock) <= row.minimumStock
              ? "Stok Rendah"
              : "Tersedia",
    }));
  }

  /**
   * Generate stock movement data for PDF/CSV export.
   */
  static async generateMovementData(filter: ReportFilter) {
    const conditions: SQL[] = [];

    if (filter.warehouseId) {
      conditions.push(eq(stockMovements.warehouseId, filter.warehouseId));
    }

    if (filter.dateFrom) {
      conditions.push(gte(stockMovements.createdAt, new Date(filter.dateFrom)));
    }

    if (filter.dateTo) {
      conditions.push(lte(stockMovements.createdAt, new Date(filter.dateTo)));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    return dbRead
      .select({
        createdAt: stockMovements.createdAt,
        createdBy: users.name,
        notes: stockMovements.notes,
        productName: products.name,
        productSku: products.sku,
        quantity: stockMovements.quantity,
        referenceId: stockMovements.referenceId,
        referenceType: stockMovements.referenceType,
        type: stockMovements.type,
        unitCost: stockMovements.unitCost,
        warehouseName: warehouses.name,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .innerJoin(warehouses, eq(stockMovements.warehouseId, warehouses.id))
      .leftJoin(users, eq(stockMovements.createdBy, users.id))
      .where(whereCondition)
      .orderBy(desc(stockMovements.createdAt))
      .limit(10000);
  }

  /**
   * Generate PDF buffer for inventory summary report.
   */
  static async buildPdf(
    reportType: ReportType,
    filter: ReportFilter,
    generatedBy: string,
  ): Promise<Buffer> {
    const pdfmake = await import("pdfmake/build/pdfmake");
    const pdfFonts = await import("pdfmake/build/vfs_fonts");

    const pdfMakeInstance = (pdfmake.default ?? pdfmake) as Record<string, unknown> & { createPdf: (def: unknown) => { getBuffer: (cb: (buf: Buffer) => void) => void } };
    if (!("vfs" in pdfMakeInstance) && pdfFonts.default) {
      (pdfMakeInstance as Record<string, unknown>).vfs = (pdfFonts.default as Record<string, unknown>).vfs ?? {};
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    let tableBody: unknown[][];
    let tableHeaders: string[];

    if (reportType === "INVENTORY_SUMMARY") {
      const data = await this.generateInventorySummaryData(filter);
      tableHeaders = ["SKU", "Produk", "Kategori", "Gudang", "Stok", "Stok Min", "Status", "Nilai"];
      tableBody = [
        tableHeaders.map((h) => ({ bold: true, text: h })),
        ...data.map((row) => [
          row.productSku,
          row.productName,
          row.categoryName,
          row.warehouseName,
          `${row.currentStock} ${row.unit}`,
          `${row.minimumStock} ${row.unit}`,
          row.stockStatus,
          `Rp${Number(row.inventoryValue).toLocaleString("id-ID")}`,
        ]),
      ];
    } else {
      const data = await this.generateMovementData(filter);
      tableHeaders = ["Tanggal", "Produk", "Gudang", "Tipe", "Jumlah", "Referensi", "Dibuat Oleh"];
      tableBody = [
        tableHeaders.map((h) => ({ bold: true, text: h })),
        ...data.map((row) => [
          new Date(row.createdAt).toLocaleDateString("id-ID"),
          `${row.productSku} - ${row.productName}`,
          row.warehouseName,
          row.type,
          String(row.quantity),
          row.referenceType ?? "-",
          row.createdBy ?? "-",
        ]),
      ];
    }

    const reportTitle: Record<ReportType, string> = {
      INVENTORY_SUMMARY: "Laporan Inventaris",
      LOW_STOCK_REPORT: "Laporan Stok Rendah",
      STOCK_MOVEMENT: "Laporan Pergerakan Stok",
      TRANSFER_REPORT: "Laporan Transfer",
    };

    const docDefinition = {
      content: [
        { style: "title", text: reportTitle[reportType] ?? reportType },
        { style: "subtitle", text: `SmartStock Pro - PT Maju Bersama Digital` },
        { style: "meta", text: `Dibuat: ${dateStr}` },
        { style: "meta", text: `Dibuat oleh: ${generatedBy}` },
        { margin: [0, 12, 0, 12], style: "hr", text: "" },
        {
          layout: "lightHorizontalLines",
          table: {
            body: tableBody,
            headerRows: 1,
            widths: Array(tableHeaders.length).fill("*") as string[],
          },
        },
      ],
      styles: {
        hr: { fontSize: 1, margin: [0, 8, 0, 8] },
        meta: { color: "#64748B", fontSize: 10, margin: [0, 2, 0, 0] },
        subtitle: { color: "#334155", fontSize: 12, margin: [0, 4, 0, 0] },
        title: { bold: true, color: "#0F172A", fontSize: 18, margin: [0, 0, 0, 4] },
      },
    };

    return new Promise((resolve, reject) => {
      try {
        const doc = (pdfMakeInstance as { createPdf: (def: unknown) => { getBuffer: (cb: (b: Buffer) => void) => void } }).createPdf(docDefinition);
        doc.getBuffer((buffer) => {
          resolve(buffer);
        });
      } catch (error) {
        reject(new ReportGenerationError());
      }
    });
  }

  /**
   * Build CSV buffer for a report.
   */
  static async buildCsv(
    reportType: ReportType,
    filter: ReportFilter,
  ): Promise<Buffer> {
    if (reportType === "INVENTORY_SUMMARY") {
      const data = await this.generateInventorySummaryData(filter);
      const header = "SKU,Produk,Kategori,Gudang,Stok,Stok Min,Status,Nilai";
      const rows = data.map(
        (row) =>
          `"${row.productSku}","${row.productName}","${row.categoryName}","${row.warehouseName}",${row.currentStock} ${row.unit},${row.minimumStock} ${row.unit},"${row.stockStatus}",${row.inventoryValue}`,
      );

      return Buffer.from([header, ...rows].join("\n"), "utf-8");
    }

    const data = await this.generateMovementData(filter);
    const header = "Tanggal,Produk,Gudang,Tipe,Jumlah,Referensi,Dibuat Oleh";
    const rows = data.map(
      (row) =>
        `"${new Date(row.createdAt).toLocaleDateString("id-ID")}","${row.productSku} - ${row.productName}","${row.warehouseName}","${row.type}",${row.quantity},"${row.referenceType ?? "-"}","${row.createdBy ?? "-"}"`,
    );

    return Buffer.from([header, ...rows].join("\n"), "utf-8");
  }

  /**
   * Get report export detail.
   */
  static async getById(reportId: string) {
    const id = parseUuid(reportId, "ID laporan tidak valid.");
    const [record] = await dbRead
      .select()
      .from(reportExports)
      .where(eq(reportExports.id, id))
      .limit(1);

    if (!record) throw new NotFoundAppError("Laporan tidak ditemukan.");

    return record;
  }

  /**
   * List report exports with pagination.
   */
  static async list(searchParams: Record<string, unknown>) {
    const filters = getFilters(searchParams);
    const where = filters.where;
    const conditions: SQL[] = [];

    if (typeof where.reportType === "string" && where.reportType) {
      conditions.push(eq(reportExports.type, where.reportType as ReportType));
    }

    if (typeof where.status === "string" && where.status) {
      conditions.push(eq(reportExports.status, where.status as any));
    }

    if (typeof where.generatedBy === "string" && where.generatedBy) {
      conditions.push(eq(reportExports.generatedBy, where.generatedBy));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ total }] = await dbRead
      .select({ total: count() })
      .from(reportExports)
      .where(whereCondition);
    const data = await dbRead
      .select()
      .from(reportExports)
      .where(whereCondition)
      .orderBy(desc(reportExports.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      data,
      pagination: getPagination(filters.page, filters.limit, Number(total)),
    };
  }

  /**
   * Notify user when report completes.
   */
  static async notifyCompleted(
    reportId: string,
    reportType: ReportType,
    userId: string,
  ) {
    await Notifications.create({
      actionHref: `/reports/${reportId}`,
      message: `Laporan ${reportType} sudah siap untuk diunduh.`,
      severity: "success",
      title: "Laporan Selesai",
      type: "REPORT_COMPLETED",
      userId,
    });
  }

  /**
   * Notify user when report fails.
   */
  static async notifyFailed(
    reportId: string,
    reportType: ReportType,
    userId: string,
  ) {
    await Notifications.create({
      actionHref: `/reports/${reportId}`,
      message: `Laporan ${reportType} gagal dibuat. Coba lagi atau hubungi admin.`,
      severity: "warning",
      title: "Laporan Gagal",
      type: "REPORT_FAILED",
      userId,
    });
  }
}
