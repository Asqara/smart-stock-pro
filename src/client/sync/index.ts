import "server-only";

import { and, count, desc, eq, type SQL } from "drizzle-orm";

import type { SyncStatus } from "@/constants/inventory";
import { warehouseSyncLogs, warehouses } from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import { NotFoundAppError } from "@/lib/errors";
import { getFilters } from "@/utils/getFilters";

import { getPagination, parseUuid } from "../inventory/shared";

type CreateSyncLogInput = {
  destinationWarehouseId?: string | null;
  jobId?: string | null;
  message: string;
  metadata?: Record<string, unknown> | null;
  sourceWarehouseId?: string | null;
  status: SyncStatus;
  transferId?: string | null;
};

/**
 * Business logic for warehouse sync log tracking.
 */
export class WarehouseSync {
  /**
   * Create a sync log record.
   */
  static async createLog(input: CreateSyncLogInput) {
    const [log] = await db
      .insert(warehouseSyncLogs)
      .values({
        destinationWarehouseId: input.destinationWarehouseId ?? null,
        jobId: input.jobId ?? null,
        message: input.message,
        metadata: input.metadata ?? null,
        sourceWarehouseId: input.sourceWarehouseId ?? null,
        status: input.status,
        transferId: input.transferId ?? null,
      })
      .returning();

    return log;
  }

  /**
   * Update sync log status to SYNCING.
   */
  static async markSyncing(logId: string) {
    const [log] = await db
      .update(warehouseSyncLogs)
      .set({ status: "SYNCING" })
      .where(eq(warehouseSyncLogs.id, logId))
      .returning();

    return log;
  }

  /**
   * Mark sync log as COMPLETED.
   */
  static async markCompleted(logId: string, message: string) {
    const [log] = await db
      .update(warehouseSyncLogs)
      .set({
        completedAt: new Date(),
        message,
        status: "COMPLETED",
      })
      .where(eq(warehouseSyncLogs.id, logId))
      .returning();

    return log;
  }

  /**
   * Mark sync log as FAILED.
   */
  static async markFailed(logId: string, message: string) {
    const [log] = await db
      .update(warehouseSyncLogs)
      .set({
        message,
        status: "FAILED",
      })
      .where(eq(warehouseSyncLogs.id, logId))
      .returning();

    return log;
  }

  /**
   * Get sync log by ID.
   */
  static async getById(logId: string) {
    const id = parseUuid(logId, "ID sync log tidak valid.");
    const [log] = await dbRead
      .select()
      .from(warehouseSyncLogs)
      .where(eq(warehouseSyncLogs.id, id))
      .limit(1);

    if (!log) throw new NotFoundAppError("Sync log tidak ditemukan.");

    return log;
  }

  /**
   * List sync logs for a specific transfer.
   */
  static async listByTransfer(transferId: string) {
    return dbRead
      .select()
      .from(warehouseSyncLogs)
      .where(eq(warehouseSyncLogs.transferId, transferId))
      .orderBy(desc(warehouseSyncLogs.createdAt));
  }

  /**
   * List sync logs with pagination.
   */
  static async list(searchParams: Record<string, unknown>) {
    const filters = getFilters(searchParams);
    const where = filters.where;
    const conditions: SQL[] = [];

    if (typeof where.status === "string" && where.status) {
      conditions.push(eq(warehouseSyncLogs.status, where.status as SyncStatus));
    }

    if (typeof where.transferId === "string" && where.transferId) {
      conditions.push(eq(warehouseSyncLogs.transferId, where.transferId));
    }

    if (typeof where.warehouseId === "string" && where.warehouseId) {
      conditions.push(
        eq(warehouseSyncLogs.sourceWarehouseId, where.warehouseId),
      );
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ total }] = await dbRead
      .select({ total: count() })
      .from(warehouseSyncLogs)
      .where(whereCondition);
    const data = await dbRead
      .select()
      .from(warehouseSyncLogs)
      .where(whereCondition)
      .orderBy(desc(warehouseSyncLogs.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      data,
      pagination: getPagination(filters.page, filters.limit, Number(total)),
    };
  }
}
