import "server-only";

import { parse as parseCsv } from "csv-parse/sync";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import ExcelJS from "exceljs";
import { randomBytes } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

import { AUDIT_ACTIONS } from "@/constants/auth";
import {
  IMPORT_CHUNK_SIZE,
  IMPORT_CONCURRENCY_LIMIT,
  IMPORT_REQUIRED_COLUMNS,
  IMPORT_OPTIONAL_COLUMNS,
  type ImportRowStatus,
  type ImportStatus,
} from "@/constants/inventory";
import {
  categories,
  importBatchRows,
  importBatches,
  products,
  stockBatches,
  stockMovements,
  suppliers,
  warehouses,
} from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import { ImportFileError, NotFoundAppError } from "@/lib/errors";
import { getFilters } from "@/utils/getFilters";

import { AuditLogs } from "../audit-logs";
import { getPagination, parseUuid } from "../inventory/shared";
import { Notifications } from "../notifications";
import type { AuditContext } from "../types";

type ImportRow = {
  category: string;
  description?: string;
  minimum_stock: string;
  name: string;
  price?: string;
  quantity: string;
  sku: string;
  supplier: string;
  unit?: string;
  unit_cost: string;
  warehouse_code: string;
};

type NormalizedRow = {
  categoryName: string;
  description: string | null;
  minimumStock: number;
  name: string;
  price: number;
  quantity: number;
  sku: string;
  supplierName: string;
  unit: string;
  unitCost: number;
  warehouseCode: string;
};

function getImportExtension(fileName: string) {
  return extname(fileName).toLowerCase();
}

function isExcelFile(fileName: string, fileType: string) {
  return (
    getImportExtension(fileName) === ".xlsx" ||
    fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

function isCsvFile(fileName: string, fileType: string) {
  return getImportExtension(fileName) === ".csv" || fileType === "text/csv";
}

function getRequiredHeaderErrors(headers: string[]) {
  const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
  const missing = IMPORT_REQUIRED_COLUMNS.filter(
    (column) => !normalizedHeaders.includes(column),
  );

  if (missing.length === 0) {
    return [];
  }

  return [`Kolom wajib tidak ditemukan: ${missing.join(", ")}`];
}

function getDuplicateSkus(rows: ImportRow[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const row of rows) {
    const sku = row.sku?.trim().toUpperCase();

    if (!sku) {
      continue;
    }

    if (seen.has(sku)) {
      duplicates.add(sku);
    }

    seen.add(sku);
  }

  return duplicates;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Run tasks with a concurrency limit.
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  const running = new Set<Promise<void>>();

  for (const task of tasks) {
    const promise = task()
      .then((result) => {
        results.push(result);
      })
      .finally(() => {
        running.delete(promise);
      });
    running.add(promise);

    if (running.size >= limit) {
      await Promise.race(running);
    }
  }

  await Promise.all([...running]);

  return results;
}

/**
 * Business logic for Excel-first product import.
 */
export class Import {
  /**
   * Save uploaded file to temp location and create import batch record.
   */
  static async createBatch(
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    context: AuditContext,
  ) {
    this.validateFileType(fileName, fileType);

    const tmpPath = join(
      tmpdir(),
      `import-${randomBytes(8).toString("hex")}${getImportExtension(fileName)}`,
    );
    await writeFile(tmpPath, fileBuffer);

    const [batch] = await db
      .insert(importBatches)
      .values({
        createdBy: context.actorUserId!,
        fileName,
        fileType,
        status: "UPLOADED",
        totalRows: 0,
      })
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.IMPORT_UPLOADED,
        description: `File import ${fileName} diunggah.`,
        entityId: batch.id,
        entityType: "import_batch",
        metadata: { fileName, fileType },
      },
      context,
    );

    return { batch, tmpPath };
  }

  /**
   * Parse CSV fallback buffer into raw rows.
   */
  static parseCSV(buffer: Buffer): { errors: string[]; rows: ImportRow[] } {
    let rows: ImportRow[] = [];

    try {
      rows = parseCsv(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as ImportRow[];
    } catch {
      throw new ImportFileError(
        "File CSV tidak dapat dibaca. Gunakan template Excel untuk hasil terbaik.",
      );
    }

    const headers = rows[0] ? Object.keys(rows[0]) : [];

    return { errors: getRequiredHeaderErrors(headers), rows };
  }

  /**
   * Parse Excel template buffer into raw rows.
   */
  static async parseExcel(buffer: Buffer): Promise<{
    errors: string[];
    rows: ImportRow[];
  }> {
    const workbook = new ExcelJS.Workbook();

    try {
      type XlsxLoadBuffer = Parameters<typeof workbook.xlsx.load>[0];
      const excelBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as XlsxLoadBuffer;
      await workbook.xlsx.load(excelBuffer);
    } catch {
      throw new ImportFileError("File Excel tidak dapat dibaca.");
    }

    const worksheet =
      workbook.getWorksheet("Products Import") ?? workbook.worksheets[0];

    if (!worksheet) {
      throw new ImportFileError("Worksheet Products Import tidak ditemukan.");
    }

    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];

    headerRow.eachCell((cell, columnNumber) => {
      headers[columnNumber - 1] = cell.text.trim().toLowerCase();
    });

    const errors = getRequiredHeaderErrors(headers);
    const rows: ImportRow[] = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const raw = {} as Record<string, string>;

      headers.forEach((header, index) => {
        if (header) {
          raw[header] = row.getCell(index + 1).text.trim();
        }
      });

      const hasValue = Object.values(raw).some((value) => value.trim());

      if (hasValue) {
        rows.push(raw as ImportRow);
      }
    }

    return { errors, rows };
  }

  /**
   * Parse uploaded import file. Excel is primary, CSV is fallback.
   */
  static async parseFile(
    buffer: Buffer,
    fileName: string,
    fileType: string,
  ) {
    if (isExcelFile(fileName, fileType)) {
      return this.parseExcel(buffer);
    }

    if (isCsvFile(fileName, fileType)) {
      return this.parseCSV(buffer);
    }

    throw new ImportFileError("Format file harus Excel (.xlsx).");
  }

  /**
   * Validate a single raw import row. Returns normalized data or error.
   */
  static validateRow(
    raw: ImportRow,
    duplicateSkus: Set<string>,
  ): { error: string | null; normalized: NormalizedRow | null } {
    const sku = raw.sku?.trim().toUpperCase();
    const quantity = Number(raw.quantity);
    const unitCost = Number(raw.unit_cost);
    const minimumStock = Number(raw.minimum_stock);

    if (!sku) return { error: "SKU wajib diisi.", normalized: null };
    if (duplicateSkus.has(sku)) return { error: `SKU ${sku} duplikat dalam file.`, normalized: null };
    if (!raw.name?.trim()) return { error: "Nama produk wajib diisi.", normalized: null };
    if (!raw.category?.trim()) return { error: "Kategori wajib diisi.", normalized: null };
    if (!raw.supplier?.trim()) return { error: "Supplier wajib diisi.", normalized: null };
    if (!raw.warehouse_code?.trim()) return { error: "Kode gudang wajib diisi.", normalized: null };
    if (Number.isNaN(quantity) || quantity <= 0) return { error: "Jumlah harus angka lebih dari 0.", normalized: null };
    if (Number.isNaN(unitCost) || unitCost < 0) return { error: "Harga satuan tidak boleh negatif.", normalized: null };
    if (Number.isNaN(minimumStock) || minimumStock < 0) return { error: "Stok minimum tidak boleh negatif.", normalized: null };

    return {
      error: null,
      normalized: {
        categoryName: raw.category.trim(),
        description: raw.description?.trim() ?? null,
        minimumStock,
        name: raw.name.trim(),
        price: raw.price ? Number(raw.price) : 0,
        quantity,
        sku,
        supplierName: raw.supplier.trim(),
        unit: raw.unit?.trim() ?? "unit",
        unitCost,
        warehouseCode: raw.warehouse_code.trim().toUpperCase(),
      },
    };
  }

  /**
   * Process all validated rows: upsert products, create movements and batches.
   */
  static async processImport(
    batchId: string,
    tmpPath: string,
    context: AuditContext,
    onProgress?: (progress: number) => Promise<void>,
  ) {
    await db
      .update(importBatches)
      .set({ status: "VALIDATING", updatedAt: new Date() })
      .where(eq(importBatches.id, batchId));

    const batch = await this.getById(batchId);
    const fileBuffer = await readFile(tmpPath);
    const { errors: parseErrors, rows } = await this.parseFile(
      fileBuffer,
      batch.fileName,
      batch.fileType,
    );

    if (parseErrors.length > 0) {
      await db
        .update(importBatches)
        .set({
          status: "FAILED",
          updatedAt: new Date(),
        })
        .where(eq(importBatches.id, batchId));
      throw new ImportFileError(parseErrors.join("; "));
    }

    const totalRows = rows.length;
    const duplicateSkus = getDuplicateSkus(rows);
    await db
      .update(importBatches)
      .set({ status: "PROCESSING", totalRows, updatedAt: new Date() })
      .where(eq(importBatches.id, batchId));

    let successRows = 0;
    let failedRows = 0;
    let processedCount = 0;

    const chunks: ImportRow[][] = [];
    for (let index = 0; index < rows.length; index += IMPORT_CHUNK_SIZE) {
      chunks.push(rows.slice(index, index + IMPORT_CHUNK_SIZE));
    }

    for (const chunk of chunks) {
      const validatedChunk = chunk.map((raw, index) => ({
        ...this.validateRow(raw, duplicateSkus),
        raw,
        rowNumber: processedCount + index + 1,
      }));

      const tasks = validatedChunk.map(({ error, normalized, raw, rowNumber }) => async () => {
        const rawData = raw as unknown as Record<string, unknown>;

        if (error || !normalized) {
          await db.insert(importBatchRows).values({
            errorMessage: error,
            importBatchId: batchId,
            rawData,
            rowNumber,
            status: "INVALID",
          });
          failedRows++;
          return;
        }

        const [warehouse] = await dbRead
          .select()
          .from(warehouses)
          .where(eq(warehouses.code, normalized.warehouseCode))
          .limit(1);

        if (!warehouse) {
          await db.insert(importBatchRows).values({
            errorMessage: `Gudang dengan kode ${normalized.warehouseCode} tidak ditemukan.`,
            importBatchId: batchId,
            rawData,
            rowNumber,
            status: "INVALID",
          });
          failedRows++;
          return;
        }

        try {
          let [category] = await dbRead
            .select()
            .from(categories)
            .where(eq(categories.name, normalized.categoryName))
            .limit(1);

          if (!category) {
            const [created] = await db
              .insert(categories)
              .values({
                isActive: true,
                name: normalized.categoryName,
                slug: slugify(normalized.categoryName),
              })
              .returning();
            category = created;
          }

          let [supplier] = await dbRead
            .select()
            .from(suppliers)
            .where(eq(suppliers.name, normalized.supplierName))
            .limit(1);

          if (!supplier) {
            const [created] = await db
              .insert(suppliers)
              .values({
                isActive: true,
                name: normalized.supplierName,
              })
              .returning();
            supplier = created;
          }

          let product: typeof products.$inferSelect | undefined;
          let createdProductId: string | undefined;

          const [existingProduct] = await dbRead
            .select()
            .from(products)
            .where(eq(products.sku, normalized.sku))
            .limit(1);

          if (existingProduct) {
            const [updated] = await db
              .update(products)
              .set({
                categoryId: category.id,
                minimumStock: normalized.minimumStock,
                name: normalized.name,
                price: normalized.price,
                supplierId: supplier.id,
                unit: normalized.unit,
                updatedAt: new Date(),
              })
              .where(eq(products.id, existingProduct.id))
              .returning();
            product = updated;
          } else {
            const [created] = await db
              .insert(products)
              .values({
                categoryId: category.id,
                description: normalized.description,
                isActive: true,
                minimumStock: normalized.minimumStock,
                name: normalized.name,
                price: normalized.price,
                sku: normalized.sku,
                supplierId: supplier.id,
                unit: normalized.unit,
              })
              .returning();
            product = created;
            createdProductId = created.id;
          }

          const result = await db.transaction(async (tx) => {
            const [movement] = await tx
              .insert(stockMovements)
              .values({
                createdBy: context.actorUserId ?? null,
                notes: `Import batch ${batchId}`,
                productId: product!.id,
                quantity: normalized.quantity,
                referenceId: batchId,
                referenceType: "IMPORT",
                type: "IMPORT",
                unitCost: normalized.unitCost,
                warehouseId: warehouse.id,
              })
              .returning();

            await tx.insert(stockBatches).values({
              productId: product!.id,
              quantityInitial: normalized.quantity,
              quantityRemaining: normalized.quantity,
              receivedAt: new Date(),
              sourceMovementId: movement.id,
              unitCost: normalized.unitCost,
              warehouseId: warehouse.id,
            });

            return movement;
          });

          await db.insert(importBatchRows).values({
            createdMovementId: result.id,
            createdProductId: createdProductId ?? null,
            importBatchId: batchId,
            normalizedData: normalized as unknown as Record<string, unknown>,
            rawData,
            rowNumber,
            status: "IMPORTED",
          });

          successRows++;
        } catch (rowError) {
          await db.insert(importBatchRows).values({
            errorMessage:
              rowError instanceof Error
                ? rowError.message
                : "Error saat memproses baris.",
            importBatchId: batchId,
            rawData,
            rowNumber,
            status: "FAILED",
          });
          failedRows++;
        }
      });

      await runWithConcurrency(tasks, IMPORT_CONCURRENCY_LIMIT);
      processedCount += chunk.length;

      const progress = totalRows > 0 ? Math.round((processedCount / totalRows) * 100) : 100;
      if (onProgress) await onProgress(progress);
    }

    const finalStatus =
      failedRows === 0
        ? "COMPLETED"
        : successRows === 0
          ? "FAILED"
          : "COMPLETED_WITH_ERRORS";

    await db
      .update(importBatches)
      .set({
        completedAt: new Date(),
        failedRows,
        status: finalStatus,
        successRows,
        totalRows,
        updatedAt: new Date(),
      })
      .where(eq(importBatches.id, batchId));

    await unlink(tmpPath).catch(() => null);

    await AuditLogs.create(
      {
        action:
          finalStatus === "FAILED"
            ? AUDIT_ACTIONS.IMPORT_FAILED
            : AUDIT_ACTIONS.IMPORT_COMPLETED,
        description: `Import ${batchId}: ${successRows} berhasil, ${failedRows} gagal.`,
        entityId: batchId,
        entityType: "import_batch",
        metadata: { failedRows, finalStatus, successRows, totalRows },
      },
      context,
    );

    await Notifications.createForRole("ADMIN", {
      actionHref: `/imports/${batchId}`,
      message: `Import selesai: ${successRows} berhasil, ${failedRows} gagal dari ${totalRows} baris.`,
      severity: failedRows > 0 ? "warning" : "success",
      title: failedRows > 0 ? "Import Selesai dengan Error" : "Import Selesai",
      type: failedRows > 0 ? "IMPORT_FAILED" : "IMPORT_COMPLETED",
    });

    return { batchId, failedRows, finalStatus, successRows, totalRows };
  }

  /**
   * Get import batch detail by ID.
   */
  static async getById(batchId: string) {
    const id = parseUuid(batchId, "ID batch import tidak valid.");
    const [batch] = await dbRead
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, id))
      .limit(1);

    if (!batch) throw new NotFoundAppError("Import batch tidak ditemukan.");

    return batch;
  }

  /**
   * Get rows for an import batch with pagination.
   */
  static async listRows(batchId: string, searchParams: Record<string, unknown>) {
    const id = parseUuid(batchId, "ID batch import tidak valid.");
    const filters = getFilters(searchParams);
    const conditions: SQL[] = [eq(importBatchRows.importBatchId, id)];

    if (typeof filters.where.status === "string" && filters.where.status) {
      conditions.push(
        eq(importBatchRows.status, filters.where.status as ImportRowStatus),
      );
    }

    const whereCondition = and(...conditions);
    const [{ total }] = await dbRead
      .select({ total: count() })
      .from(importBatchRows)
      .where(whereCondition);
    const data = await dbRead
      .select()
      .from(importBatchRows)
      .where(whereCondition)
      .orderBy(importBatchRows.rowNumber)
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      data,
      pagination: getPagination(filters.page, filters.limit, Number(total)),
    };
  }

  /**
   * List import batches with pagination.
   */
  static async list(searchParams: Record<string, unknown>) {
    const filters = getFilters(searchParams);
    const where = filters.where;
    const conditions: SQL[] = [];

    if (typeof where.status === "string" && where.status) {
      conditions.push(eq(importBatches.status, where.status as ImportStatus));
    }

    if (typeof where.createdBy === "string" && where.createdBy) {
      conditions.push(eq(importBatches.createdBy, where.createdBy));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ total }] = await dbRead
      .select({ total: count() })
      .from(importBatches)
      .where(whereCondition);
    const data = await dbRead
      .select()
      .from(importBatches)
      .where(whereCondition)
      .orderBy(desc(importBatches.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      data,
      pagination: getPagination(filters.page, filters.limit, Number(total)),
    };
  }

  /**
   * Generate Excel template for product import.
   */
  static async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Products Import", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    const headers = [...IMPORT_REQUIRED_COLUMNS, ...IMPORT_OPTIONAL_COLUMNS];

    worksheet.addRow(headers);
    worksheet.addRows([
      [
        "ELEC-DEMO-001",
        "Laptop ASUS VivoBook",
        "Laptop",
        "PT Teknologi Maju",
        "JKT",
        10,
        8500000,
        5,
        "Laptop untuk kebutuhan bisnis",
        "unit",
        9000000,
      ],
      [
        "ELEC-DEMO-002",
        "Monitor LED 24 Inch",
        "Monitor",
        "PT Display Nusantara",
        "BDG",
        15,
        1200000,
        4,
        "Monitor kantor",
        "unit",
        1500000,
      ],
      [
        "ELEC-DEMO-003",
        "Router WiFi 6",
        "Networking",
        "PT Jaringan Digital",
        "SBY",
        20,
        700000,
        6,
        "Perangkat jaringan",
        "unit",
        950000,
      ],
    ]);

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      fgColor: { argb: "FF1E3A8A" },
      pattern: "solid",
      type: "pattern",
    };
    headerRow.alignment = { vertical: "middle" };
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.max(16, header.length + 4),
    }));

    const notes = workbook.addWorksheet("Instructions");
    notes.addRows([
      ["Gunakan worksheet Products Import untuk mengisi data."],
      ["Kolom wajib: sku, name, category, supplier, warehouse_code, quantity, unit_cost, minimum_stock."],
      ["Gambar produk diatur dari Galeri Produk dengan Cloudflare R2, bukan dari template import."],
      ["Baris kosong akan dilewati saat import."],
    ]);
    notes.getColumn(1).width = 120;

    const output = await workbook.xlsx.writeBuffer();

    return Buffer.isBuffer(output) ? output : Buffer.from(output);
  }

  private static validateFileType(fileName: string, fileType: string) {
    if (isExcelFile(fileName, fileType) || isCsvFile(fileName, fileType)) {
      return;
    }

    throw new ImportFileError("Format file harus Excel (.xlsx).");
  }
}
