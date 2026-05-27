import { z } from "zod";

import { IMPORT_MAX_FILE_SIZE_BYTES } from "@/constants/inventory";

/**
 * Validation schemas for product import operations.
 */
export class Import {
  /**
   * Import upload payload. Excel is the primary format, CSV remains fallback.
   */
  static UploadImport = z.object({
    dataBase64: z.string().min(1, "Data file wajib diisi."),
    fileName: z.string().trim().min(1, "Nama file wajib diisi."),
    fileType: z
      .enum([
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
      ])
      .or(z.literal("")),
    fileSize: z.number().int().positive().max(
      IMPORT_MAX_FILE_SIZE_BYTES,
      `Ukuran file maksimal ${IMPORT_MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
    ),
  });

  /**
   * Process import request - trigger background job for uploaded batch.
   */
  static ProcessImport = z.object({
    importBatchId: z.string().uuid("ID batch import tidak valid."),
  });
}
