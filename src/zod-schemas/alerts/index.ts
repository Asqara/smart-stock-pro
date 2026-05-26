import { z } from "zod";

import { USER_ROLE_VALUES } from "@/constants/auth";
import {
  ERROR_SEVERITY_VALUES,
  NOTIFICATION_SEVERITY_VALUES,
  NOTIFICATION_TYPE_VALUES,
} from "@/constants/inventory";

/**
 * Validation schemas for notifications, error logs, and monitoring.
 */
export class Alerts {
  /**
   * Notification read request body.
   */
  static MarkNotificationRead = z.object({
    isRead: z.boolean().default(true),
  });

  /**
   * Notification create request body.
   */
  static CreateNotification = z.object({
    userId: z.string().uuid("ID user tidak valid.").optional().nullable(),
    roleTarget: z.enum(USER_ROLE_VALUES).optional().nullable(),
    type: z.enum(NOTIFICATION_TYPE_VALUES),
    title: z.string().trim().min(1, "Judul wajib diisi.").max(160),
    message: z.string().trim().min(1, "Pesan wajib diisi.").max(500),
    severity: z.enum(NOTIFICATION_SEVERITY_VALUES),
    actionHref: z.string().trim().max(240).optional().nullable(),
  });

  /**
   * Error resolve request body.
   */
  static ResolveError = z.object({
    note: z.string().trim().max(300).optional(),
  });

  /**
   * Error log create request body.
   */
  static CreateErrorLog = z.object({
    module: z.string().trim().min(1, "Module wajib diisi.").max(120),
    message: z.string().trim().min(1, "Pesan wajib diisi.").max(500),
    stack: z.string().max(4000).optional().nullable(),
    severity: z.enum(ERROR_SEVERITY_VALUES),
    metadata: z.record(z.string(), z.unknown()).optional(),
  });

  /**
   * Monitoring check request body.
   */
  static MonitoringCheck = z.object({
    serviceName: z.string().trim().max(80).optional(),
  });
}
