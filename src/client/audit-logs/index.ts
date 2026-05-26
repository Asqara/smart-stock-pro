import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  type SQL,
} from "drizzle-orm";

import { db, dbRead } from "@/lib/db";
import { auditLogs } from "@/drizzle-schema";
import { getFilters } from "@/utils/getFilters";

import type { AuditContext } from "../types";

type CreateAuditLogInput = {
  action: string;
  description: string;
  entityId?: string | null;
  entityType: string;
  metadata?: Record<string, unknown>;
};

type AuditLogListResult = {
  data: (typeof auditLogs.$inferSelect)[];
  pagination: {
    limit: number;
    page: number;
    pageCount: number;
    total: number;
  };
};

/**
 * Business logic for audit log persistence and listing.
 */
export class AuditLogs {
  /**
   * Create one audit log entry.
   */
  static async create(input: CreateAuditLogInput, context: AuditContext) {
    await db.insert(auditLogs).values({
      action: input.action,
      description: input.description,
      entityId: input.entityId ?? null,
      entityType: input.entityType,
      ipAddress: context.ipAddress,
      metadata: input.metadata ?? {},
      userAgent: context.userAgent,
      userId: context.actorUserId ?? null,
    });
  }

  /**
   * List audit logs with pagination, sorting, and filtering.
   */
  static async list(
    searchParams: Record<string, unknown>,
  ): Promise<AuditLogListResult> {
    const filters = getFilters(searchParams);
    const where = filters.where;
    const conditions: SQL[] = [];

    if (typeof where.userId === "string" && where.userId) {
      conditions.push(eq(auditLogs.userId, where.userId));
    }

    if (typeof where.action === "string" && where.action) {
      conditions.push(eq(auditLogs.action, where.action));
    }

    if (typeof where.entityType === "string" && where.entityType) {
      conditions.push(eq(auditLogs.entityType, where.entityType));
    }

    if (typeof where.dateFrom === "string" && where.dateFrom) {
      conditions.push(gte(auditLogs.createdAt, new Date(where.dateFrom)));
    }

    if (typeof where.dateTo === "string" && where.dateTo) {
      conditions.push(lte(auditLogs.createdAt, new Date(where.dateTo)));
    }

    if (filters.search) {
      conditions.push(ilike(auditLogs.description, `%${filters.search}%`));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ total }] = await dbRead
      .select({ total: count() })
      .from(auditLogs)
      .where(whereCondition);

    const sortColumn =
      filters.sortBy === "action" ? auditLogs.action : auditLogs.createdAt;
    const sortDirection = filters.sortDir === "asc" ? asc : desc;
    const data = await dbRead
      .select()
      .from(auditLogs)
      .where(whereCondition)
      .orderBy(sortDirection(sortColumn))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      data,
      pagination: {
        limit: filters.limit,
        page: filters.page,
        pageCount: Math.max(1, Math.ceil(Number(total) / filters.limit)),
        total: Number(total),
      },
    };
  }

  /**
   * List audit logs for one user.
   */
  static listForUser(
    userId: string,
    searchParams: Record<string, unknown>,
  ): Promise<AuditLogListResult> {
    return this.list({
      ...searchParams,
      userId,
    });
  }
}
