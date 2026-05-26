import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lte,
  type SQL,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { AUDIT_ACTIONS } from "@/constants/auth";
import type { ErrorSeverity } from "@/constants/inventory";
import { errorLogs, users } from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import { NotFoundAppError } from "@/lib/errors";
import { getFilters } from "@/utils/getFilters";

import { AuditLogs } from "../audit-logs";
import { EmailNotifications } from "../email";
import { Jobs } from "../jobs/enqueue";
import { Notifications } from "../notifications";
import type { AuditContext } from "../types";
import { getPagination, parseUuid } from "../inventory/shared";
import { categorizeErrorSeverity } from "./severity";

type CreateErrorLogInput = {
  message: string;
  metadata?: Record<string, unknown>;
  module: string;
  severity?: ErrorSeverity;
  stack?: string | null;
};

function getErrorLogSortColumn(sortBy?: string): AnyPgColumn {
  if (sortBy === "severity") return errorLogs.severity;
  if (sortBy === "module") return errorLogs.module;
  if (sortBy === "resolvedAt" || sortBy === "resolved_at") {
    return errorLogs.resolvedAt;
  }

  return errorLogs.createdAt;
}

/**
 * Business logic for application error logs.
 */
export class ErrorLogs {
  /**
   * Create an error log and notify Admin for warning or critical severity.
   */
  static async log(input: CreateErrorLogInput) {
    const severity = input.severity ?? "info";
    const [errorLog] = await db
      .insert(errorLogs)
      .values({
        message: input.message,
        metadata: input.metadata ?? {},
        module: input.module,
        severity,
        stack: input.stack ?? null,
      })
      .returning();

    if (severity === "critical" || severity === "warning") {
      await Notifications.createForRole("ADMIN", {
        actionHref: `/error-logs/${errorLog.id}`,
        message: input.message,
        severity,
        title: severity === "critical" ? "Error sistem kritis" : "Error sistem",
        type: "SYSTEM_ERROR",
      });

      const recipients = await dbRead
        .select({
          email: users.email,
          name: users.name,
        })
        .from(users)
        .where(and(eq(users.role, "ADMIN"), eq(users.isActive, true)));
      const emailPayload = {
        message: input.message,
        module: input.module,
        recipients,
        severity,
      };
      const queuedEmail = await Jobs.enqueueSystemErrorEmail(emailPayload);

      if (!queuedEmail.queued) {
        try {
          await EmailNotifications.sendSystemErrorEmail(emailPayload);
        } catch {
          await db.insert(errorLogs).values({
            message: "Email error sistem gagal dikirim.",
            metadata: {
              queueReason: queuedEmail.reason ?? null,
              sourceErrorLogId: errorLog.id,
            },
            module: "error-log.email",
            severity: "warning",
          });
        }
      }
    }

    return errorLog;
  }

  /**
   * Log an unknown error with categorized severity.
   */
  static logUnexpected(error: unknown, module = "api") {
    return this.log({
      message:
        error instanceof Error ? error.message : "Unexpected error terjadi.",
      metadata: {
        name: error instanceof Error ? error.name : "UnknownError",
      },
      module,
      severity: categorizeErrorSeverity(error),
      stack: error instanceof Error ? error.stack : null,
    });
  }

  /**
   * List error logs with pagination, sorting, and filtering.
   */
  static async list(searchParams: Record<string, unknown>) {
    const filters = getFilters(searchParams);
    const where = filters.where;
    const conditions: SQL[] = [];

    if (
      where.severity === "critical" ||
      where.severity === "warning" ||
      where.severity === "info"
    ) {
      conditions.push(eq(errorLogs.severity, where.severity));
    }

    if (typeof where.module === "string" && where.module) {
      conditions.push(eq(errorLogs.module, where.module));
    }

    if (typeof where.resolved === "string" && where.resolved) {
      conditions.push(
        where.resolved === "true"
          ? isNotNull(errorLogs.resolvedAt)
          : isNull(errorLogs.resolvedAt),
      );
    }

    if (typeof where.dateFrom === "string" && where.dateFrom) {
      conditions.push(gte(errorLogs.createdAt, new Date(where.dateFrom)));
    }

    if (typeof where.date_from === "string" && where.date_from) {
      conditions.push(gte(errorLogs.createdAt, new Date(where.date_from)));
    }

    if (typeof where.dateTo === "string" && where.dateTo) {
      conditions.push(lte(errorLogs.createdAt, new Date(where.dateTo)));
    }

    if (typeof where.date_to === "string" && where.date_to) {
      conditions.push(lte(errorLogs.createdAt, new Date(where.date_to)));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ total }] = await dbRead
      .select({ total: count() })
      .from(errorLogs)
      .where(whereCondition);
    const sortDirection = filters.sortDir === "asc" ? asc : desc;
    const data = await dbRead
      .select()
      .from(errorLogs)
      .where(whereCondition)
      .orderBy(sortDirection(getErrorLogSortColumn(filters.sortBy)))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      data,
      pagination: getPagination(filters.page, filters.limit, Number(total)),
    };
  }

  /**
   * Get one error log by id.
   */
  static async getById(id: string) {
    const errorLogId = parseUuid(id, "ID error log tidak valid.");
    const [errorLog] = await dbRead
      .select()
      .from(errorLogs)
      .where(eq(errorLogs.id, errorLogId))
      .limit(1);

    if (!errorLog) {
      throw new NotFoundAppError("Error log tidak ditemukan.");
    }

    return errorLog;
  }

  /**
   * Mark an error log as resolved.
   */
  static async resolve(id: string, context: AuditContext) {
    const errorLogId = parseUuid(id, "ID error log tidak valid.");
    const current = await this.getById(errorLogId);
    const [errorLog] = await db
      .update(errorLogs)
      .set({
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(errorLogs.id, errorLogId))
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.ERROR_RESOLVED,
        description: `Error ${current.module} diselesaikan.`,
        entityId: errorLog.id,
        entityType: "error_log",
        metadata: { severity: current.severity },
      },
      context,
    );

    return errorLog;
  }
}

export { categorizeErrorSeverity };
