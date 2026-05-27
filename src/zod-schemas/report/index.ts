import { z } from "zod";

import { REPORT_TYPE_VALUES } from "@/constants/inventory";

/**
 * Validation schemas for report generation.
 */
export class Report {
  /**
   * Generate report request body.
   */
  static GenerateReport = z.object({
    reportType: z.enum(REPORT_TYPE_VALUES, {
      error: "Tipe laporan tidak valid.",
    }),
    filters: z
      .object({
        warehouseId: z.string().uuid().optional().nullable(),
        categoryId: z.string().uuid().optional().nullable(),
        dateFrom: z.string().optional().nullable(),
        dateTo: z.string().optional().nullable(),
        stockStatus: z.string().optional().nullable(),
      })
      .optional()
      .default({}),
    outputFormat: z.enum(["PDF", "CSV"]).default("PDF"),
  });
}
