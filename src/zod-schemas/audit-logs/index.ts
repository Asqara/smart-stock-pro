import { z } from "zod";

/**
 * Validation helpers for audit log filters.
 */
export class AuditLogs {
  /**
   * Query filter shape used by the list service.
   */
  static Query = z.object({
    action: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    entityType: z.string().optional(),
    userId: z.string().uuid().optional(),
  });
}
