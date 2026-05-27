import { z } from "zod";

import {
  DASHBOARD_EXPORT_REPORT_TYPE_VALUES,
} from "@/constants/dashboard";

/**
 * Validation schemas for dashboard and monitoring reports.
 */
export class Dashboard {
  /**
   * Dashboard PDF export request body.
   */
  static ExportPdf = z.object({
    categoryId: z.string().uuid("ID kategori tidak valid.").optional().nullable(),
    dateFrom: z.string().optional().nullable(),
    dateTo: z.string().optional().nullable(),
    includeCharts: z.boolean().default(true),
    includeLowStock: z.boolean().default(true),
    includeMovements: z.boolean().default(true),
    reportType: z
      .enum(DASHBOARD_EXPORT_REPORT_TYPE_VALUES)
      .default("DASHBOARD_SUMMARY"),
    warehouseId: z.string().uuid("ID gudang tidak valid.").optional().nullable(),
  });
}
