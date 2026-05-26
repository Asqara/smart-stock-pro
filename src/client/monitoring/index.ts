import { desc, eq, sql } from "drizzle-orm";
import Redis from "ioredis";

import {
  MONITORING_SERVICE_NAMES,
  RESPONSE_TIME_CRITICAL_THRESHOLD_MS,
  RESPONSE_TIME_WARNING_THRESHOLD_MS,
  type HealthCheckStatus,
} from "@/constants/inventory";
import { systemHealthChecks } from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";

import { ErrorLogs } from "../error-logs";
import { Notifications } from "../notifications";
import { getResponseTimeSeverity, getResponseTimeStatus } from "./rules";

const STARTED_AT = Date.now();

type HealthCheckInput = {
  metadata?: Record<string, unknown>;
  responseTimeMs: number;
  serviceName: string;
  status: HealthCheckStatus;
};

async function measure<T>(operation: () => Promise<T>) {
  const startedAt = performance.now();
  const result = await operation();
  const responseTimeMs = Math.round(performance.now() - startedAt);

  return { responseTimeMs, result };
}

/**
 * Business logic for monitoring and health checks.
 */
export class Monitoring {
  /**
   * Store one monitoring check row.
   */
  static async storeHealthCheck(input: HealthCheckInput) {
    const [row] = await db
      .insert(systemHealthChecks)
      .values({
        checkedAt: new Date(),
        metadata: input.metadata ?? null,
        responseTimeMs: input.responseTimeMs,
        serviceName: input.serviceName,
        status: input.status,
        uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
      })
      .returning();

    return row;
  }

  /**
   * Check API, database, Redis if configured, and worker heartbeat.
   */
  static async check() {
    const api = await this.checkApi();
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();
    const worker = await this.checkWorker();

    return { api, database, redis, worker };
  }

  /**
   * Get latest health snapshot, creating one if no metrics exist.
   */
  static async getHealth() {
    const latest = await this.getLatestMetrics();

    if (latest.length > 0) {
      return latest;
    }

    const checked = await this.check();

    return Object.values(checked);
  }

  /**
   * List recent monitoring metrics.
   */
  static async listMetrics() {
    return dbRead
      .select()
      .from(systemHealthChecks)
      .orderBy(desc(systemHealthChecks.checkedAt))
      .limit(50);
  }

  /**
   * Get process uptime summary.
   */
  static async getUptime() {
    const uptimeSeconds = Math.floor((Date.now() - STARTED_AT) / 1000);
    const latest = await this.getLatestMetrics();

    return {
      latest,
      uptimeSeconds,
    };
  }

  /**
   * List recent response-time metrics.
   */
  static async getResponseTime() {
    return dbRead
      .select()
      .from(systemHealthChecks)
      .where(eq(systemHealthChecks.serviceName, MONITORING_SERVICE_NAMES.api))
      .orderBy(desc(systemHealthChecks.checkedAt))
      .limit(20);
  }

  private static async checkApi() {
    const measured = await measure(async () => Promise.resolve(true));
    const status = getResponseTimeStatus(measured.responseTimeMs);
    await this.createResponseTimeAlert(
      MONITORING_SERVICE_NAMES.api,
      measured.responseTimeMs,
    );

    return this.storeHealthCheck({
      metadata: {
        warningThresholdMs: RESPONSE_TIME_WARNING_THRESHOLD_MS,
        criticalThresholdMs: RESPONSE_TIME_CRITICAL_THRESHOLD_MS,
      },
      responseTimeMs: measured.responseTimeMs,
      serviceName: MONITORING_SERVICE_NAMES.api,
      status,
    });
  }

  private static async checkDatabase() {
    try {
      const measured = await measure(async () =>
        dbRead.select({ ok: sql<number>`1` }),
      );
      const status = getResponseTimeStatus(measured.responseTimeMs);
      await this.createResponseTimeAlert(
        MONITORING_SERVICE_NAMES.database,
        measured.responseTimeMs,
      );

      return this.storeHealthCheck({
        metadata: { query: "select 1" },
        responseTimeMs: measured.responseTimeMs,
        serviceName: MONITORING_SERVICE_NAMES.database,
        status,
      });
    } catch (error) {
      await this.createHealthFailureAlert(MONITORING_SERVICE_NAMES.database, error);

      return this.storeHealthCheck({
        metadata: {
          message: error instanceof Error ? error.message : "Database gagal.",
        },
        responseTimeMs: RESPONSE_TIME_CRITICAL_THRESHOLD_MS + 1,
        serviceName: MONITORING_SERVICE_NAMES.database,
        status: "down",
      });
    }
  }

  private static async checkRedis() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      return this.storeHealthCheck({
        metadata: { message: "REDIS_URL belum diatur." },
        responseTimeMs: 0,
        serviceName: MONITORING_SERVICE_NAMES.redis,
        status: "degraded",
      });
    }

    const redis = new Redis(redisUrl, {
      connectTimeout: 500,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
    });

    try {
      const measured = await measure(async () => {
        await redis.connect();
        await redis.ping();
      });
      const status = getResponseTimeStatus(measured.responseTimeMs);
      await this.createResponseTimeAlert(
        MONITORING_SERVICE_NAMES.redis,
        measured.responseTimeMs,
      );

      return this.storeHealthCheck({
        metadata: { ping: "PONG" },
        responseTimeMs: measured.responseTimeMs,
        serviceName: MONITORING_SERVICE_NAMES.redis,
        status,
      });
    } catch (error) {
      await this.createHealthFailureAlert(MONITORING_SERVICE_NAMES.redis, error);

      return this.storeHealthCheck({
        metadata: {
          message: error instanceof Error ? error.message : "Redis gagal.",
        },
        responseTimeMs: RESPONSE_TIME_CRITICAL_THRESHOLD_MS + 1,
        serviceName: MONITORING_SERVICE_NAMES.redis,
        status: "down",
      });
    } finally {
      redis.disconnect();
    }
  }

  private static async checkWorker() {
    const [latestWorker] = await dbRead
      .select()
      .from(systemHealthChecks)
      .where(eq(systemHealthChecks.serviceName, MONITORING_SERVICE_NAMES.worker))
      .orderBy(desc(systemHealthChecks.checkedAt))
      .limit(1);

    if (latestWorker) {
      return latestWorker;
    }

    return this.storeHealthCheck({
      metadata: { message: "Worker heartbeat belum tersedia." },
      responseTimeMs: 0,
      serviceName: MONITORING_SERVICE_NAMES.worker,
      status: "degraded",
    });
  }

  private static async createResponseTimeAlert(
    serviceName: string,
    responseTimeMs: number,
  ) {
    const severity = getResponseTimeSeverity(responseTimeMs);

    if (!severity) {
      return;
    }

    await Notifications.createForRole("ADMIN", {
      actionHref: "/monitoring",
      message: `${serviceName} merespons dalam ${responseTimeMs} ms.`,
      severity,
      title:
        severity === "critical"
          ? "Response time kritis"
          : "Response time lambat",
      type: "RESPONSE_TIME_ALERT",
    });
  }

  private static async createHealthFailureAlert(
    serviceName: string,
    error: unknown,
  ) {
    try {
      await ErrorLogs.log({
        message: `${serviceName} health check gagal.`,
        metadata: {
          serviceName,
        },
        module: `monitoring.${serviceName}`,
        severity: "critical",
        stack: error instanceof Error ? error.stack : null,
      });
    } catch (logError) {
      console.error("Monitoring failure log gagal dibuat.", logError);
    }
  }

  private static async getLatestMetrics() {
    const serviceNames = Object.values(MONITORING_SERVICE_NAMES);
    const result = [];

    for (const serviceName of serviceNames) {
      const [row] = await dbRead
        .select()
        .from(systemHealthChecks)
        .where(eq(systemHealthChecks.serviceName, serviceName))
        .orderBy(desc(systemHealthChecks.checkedAt))
        .limit(1);

      if (row) {
        result.push(row);
      }
    }

    return result;
  }
}

export { getResponseTimeSeverity, getResponseTimeStatus };
