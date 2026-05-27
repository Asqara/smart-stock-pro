import "server-only";

import { and, asc, count, desc, eq, type SQL } from "drizzle-orm";

import type { JobStatus, JobType } from "@/constants/inventory";
import { jobs } from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import { JobNotFoundError, NotFoundAppError } from "@/lib/errors";
import { getFilters } from "@/utils/getFilters";

import { getPagination } from "../inventory/shared";

type CreateJobInput = {
  createdBy?: string | null;
  payload: Record<string, unknown>;
  queueJobId?: string | null;
  type: JobType;
};

/**
 * Business logic for tracking background job records in the database.
 */
export class JobTracking {
  /**
   * Create a job tracking record before enqueueing to queue.
   */
  static async create(input: CreateJobInput) {
    const [job] = await db
      .insert(jobs)
      .values({
        createdBy: input.createdBy ?? null,
        payload: input.payload,
        progress: 0,
        queueJobId: input.queueJobId ?? null,
        status: "PENDING",
        type: input.type,
      })
      .returning();

    return job;
  }

  /**
   * Update job status to PROCESSING and record start time.
   */
  static async markProcessing(jobId: string, queueJobId?: string) {
    const [job] = await db
      .update(jobs)
      .set({
        queueJobId: queueJobId ?? undefined,
        startedAt: new Date(),
        status: "PROCESSING",
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId))
      .returning();

    return job;
  }

  /**
   * Update job progress percentage (0-100).
   */
  static async updateProgress(jobId: string, progress: number) {
    const safeProgress = Math.min(100, Math.max(0, Math.round(progress)));
    const [job] = await db
      .update(jobs)
      .set({
        progress: safeProgress,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId))
      .returning();

    return job;
  }

  /**
   * Mark job as COMPLETED with optional result.
   */
  static async markCompleted(jobId: string, result?: Record<string, unknown>) {
    const [job] = await db
      .update(jobs)
      .set({
        completedAt: new Date(),
        progress: 100,
        result: result ?? null,
        status: "COMPLETED",
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId))
      .returning();

    return job;
  }

  /**
   * Mark job as FAILED with error message.
   */
  static async markFailed(jobId: string, errorMessage: string) {
    const [job] = await db
      .update(jobs)
      .set({
        errorMessage,
        failedAt: new Date(),
        status: "FAILED",
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId))
      .returning();

    return job;
  }

  /**
   * Mark job as CANCELLED.
   */
  static async markCancelled(jobId: string) {
    const [job] = await db
      .update(jobs)
      .set({
        status: "CANCELLED",
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId))
      .returning();

    return job;
  }

  /**
   * Get single job by ID.
   */
  static async getById(jobId: string) {
    const [job] = await dbRead
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!job) {
      throw new JobNotFoundError();
    }

    return job;
  }

  /**
   * Get single job by ID and type - throws if not found or wrong type.
   */
  static async getByIdAndType(jobId: string, type: JobType) {
    const [job] = await dbRead
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.type, type)))
      .limit(1);

    if (!job) {
      throw new NotFoundAppError("Job tidak ditemukan.");
    }

    return job;
  }

  /**
   * List jobs with pagination, filtering by type and status.
   */
  static async list(searchParams: Record<string, unknown>) {
    const filters = getFilters(searchParams);
    const where = filters.where;
    const conditions: SQL[] = [];

    if (typeof where.type === "string" && where.type) {
      conditions.push(eq(jobs.type, where.type as JobType));
    }

    if (typeof where.status === "string" && where.status) {
      conditions.push(eq(jobs.status, where.status as JobStatus));
    }

    if (typeof where.createdBy === "string" && where.createdBy) {
      conditions.push(eq(jobs.createdBy, where.createdBy));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ total }] = await dbRead
      .select({ total: count() })
      .from(jobs)
      .where(whereCondition);
    const sortDirection = filters.sortDir === "asc" ? asc : desc;
    const data = await dbRead
      .select()
      .from(jobs)
      .where(whereCondition)
      .orderBy(sortDirection(jobs.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      data,
      pagination: getPagination(filters.page, filters.limit, Number(total)),
    };
  }
}
