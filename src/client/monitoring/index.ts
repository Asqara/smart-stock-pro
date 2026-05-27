import "server-only";

import { desc, eq, gte, sql } from "drizzle-orm";
import Redis from "ioredis";
import { readFile } from "node:fs/promises";
import { cpus, freemem, totalmem } from "node:os";

import {
  MONITORING_SERVICE_NAMES,
  RESPONSE_TIME_CRITICAL_THRESHOLD_MS,
  RESPONSE_TIME_WARNING_THRESHOLD_MS,
  type HealthCheckStatus,
} from "@/constants/inventory";
import { apiResponseTimeLogs, systemHealthChecks } from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";

import { ErrorLogs } from "../error-logs";
import { Notifications } from "../notifications";
import { getResponseTimeSeverity, getResponseTimeStatus } from "./rules";

const STARTED_AT = Date.now();
const RESPONSE_TIME_WINDOW_HOURS = 24;
const RESPONSE_TIME_RECENT_LIMIT = 50;

type HealthCheckInput = {
  cpuUsage?: number | null;
  memoryUsage?: number | null;
  metadata?: Record<string, unknown>;
  responseTimeMs: number;
  serviceName: string;
  status: HealthCheckStatus;
};

type CpuSample = {
  idle: number;
  total: number;
};

type ProcessCpuSample = {
  atMs: number;
  system: number;
  user: number;
};

type ResponseTimeInput = {
  durationMs: number;
  method: string;
  path: string;
  statusCode: number;
};

let lastProcStatSample: CpuSample | null = null;
let lastProcessCpuSample: ProcessCpuSample | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roundMetric(value: number, fractionDigits = 1) {
  const factor = 10 ** fractionDigits;

  return Math.round(value * factor) / factor;
}

function clampPercentage(value: number) {
  return Math.min(100, Math.max(0, value));
}

function getUptimeSeconds() {
  return Math.floor((Date.now() - STARTED_AT) / 1000);
}

async function measure<T>(operation: () => Promise<T>) {
  const startedAt = performance.now();
  const result = await operation();
  const responseTimeMs = Math.round(performance.now() - startedAt);

  return { responseTimeMs, result };
}

async function readProcStatSample(): Promise<CpuSample | null> {
  try {
    const content = await readFile("/proc/stat", "utf-8");
    const cpuLine = content
      .split("\n")
      .find((line) => line.startsWith("cpu "));

    if (!cpuLine) {
      return null;
    }

    const values = cpuLine
      .trim()
      .split(/\s+/)
      .slice(1)
      .map(Number);
    const idle = (values[3] ?? 0) + (values[4] ?? 0);
    const total = values.reduce((sum, value) => sum + value, 0);

    return { idle, total };
  } catch {
    return null;
  }
}

function getCpuUsageFromDelta(previous: CpuSample, current: CpuSample) {
  const idleDelta = current.idle - previous.idle;
  const totalDelta = current.total - previous.total;

  if (totalDelta <= 0) {
    return 0;
  }

  return clampPercentage(100 * (1 - idleDelta / totalDelta));
}

async function getSystemCpuUsage() {
  const current = await readProcStatSample();

  if (!current) {
    return null;
  }

  const previous = lastProcStatSample;
  lastProcStatSample = current;

  if (!previous) {
    await sleep(100);

    const next = await readProcStatSample();

    if (!next) {
      return null;
    }

    lastProcStatSample = next;

    return roundMetric(getCpuUsageFromDelta(current, next));
  }

  return roundMetric(getCpuUsageFromDelta(previous, current));
}

async function getProcessCpuUsage() {
  const currentCpu = process.cpuUsage();
  const current: ProcessCpuSample = {
    atMs: performance.now(),
    system: currentCpu.system,
    user: currentCpu.user,
  };
  const previous = lastProcessCpuSample;
  lastProcessCpuSample = current;

  if (!previous) {
    await sleep(100);

    const nextCpu = process.cpuUsage();
    const next: ProcessCpuSample = {
      atMs: performance.now(),
      system: nextCpu.system,
      user: nextCpu.user,
    };
    lastProcessCpuSample = next;

    return getProcessCpuUsageFromDelta(current, next);
  }

  return getProcessCpuUsageFromDelta(previous, current);
}

function getProcessCpuUsageFromDelta(
  previous: ProcessCpuSample,
  current: ProcessCpuSample,
) {
  const deltaCpuMs =
    (current.user - previous.user + current.system - previous.system) / 1000;
  const elapsedMs = Math.max(1, current.atMs - previous.atMs);
  const cpuCoreCount = Math.max(1, cpus().length);

  return roundMetric(clampPercentage((deltaCpuMs / elapsedMs / cpuCoreCount) * 100));
}

async function getResourceSnapshot() {
  const systemTotalMemory = totalmem();
  const systemFreeMemory = freemem();
  const systemUsedMemory = systemTotalMemory - systemFreeMemory;
  const appMemory = process.memoryUsage();
  const systemCpuUsage = await getSystemCpuUsage();
  const cpuUsage =
    systemCpuUsage === null ? await getProcessCpuUsage() : systemCpuUsage;
  const cpuSource = systemCpuUsage === null ? "process" : "system";

  /*
   * Memory uses OS counters: used = os.totalmem() - os.freemem().
   * CPU uses /proc/stat delta when available. Non-Linux runtime falls back to
   * process.cpuUsage() delta divided by elapsed time and CPU core count.
   */
  return {
    appMemoryUsage: roundMetric((appMemory.rss / systemTotalMemory) * 100),
    appRssBytes: appMemory.rss,
    cpuLabel: cpuSource === "system" ? "Server CPU" : "App CPU",
    cpuSource,
    cpuUsage,
    heapTotalBytes: appMemory.heapTotal,
    heapUsedBytes: appMemory.heapUsed,
    metadata: {
      appMemory: {
        heapTotalBytes: appMemory.heapTotal,
        heapUsedBytes: appMemory.heapUsed,
        rssBytes: appMemory.rss,
      },
      cpu: {
        coreCount: cpus().length,
        label: cpuSource === "system" ? "Server CPU" : "App CPU",
        source: cpuSource,
      },
      systemMemory: {
        freeBytes: systemFreeMemory,
        totalBytes: systemTotalMemory,
        usedBytes: systemUsedMemory,
      },
    },
    systemMemoryTotalBytes: systemTotalMemory,
    systemMemoryUsage: roundMetric((systemUsedMemory / systemTotalMemory) * 100),
    systemMemoryUsedBytes: systemUsedMemory,
  };
}

function getP95(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil(sorted.length * 0.95) - 1,
  );

  return sorted[index] ?? null;
}

async function getResponseTimeStats() {
  const since = new Date(Date.now() - RESPONSE_TIME_WINDOW_HOURS * 60 * 60 * 1000);
  const rows = await dbRead
    .select()
    .from(apiResponseTimeLogs)
    .where(gte(apiResponseTimeLogs.createdAt, since))
    .orderBy(desc(apiResponseTimeLogs.createdAt))
    .limit(500);
  const durations = rows.map((row) => Number(row.durationMs));
  const latest = rows[0] ?? null;
  const average =
    durations.length > 0
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : null;
  const slowest =
    rows.length > 0
      ? rows.reduce((currentSlowest, row) =>
          row.durationMs > currentSlowest.durationMs ? row : currentSlowest,
        )
      : null;

  return {
    averageResponseTimeMs: average === null ? null : roundMetric(average, 2),
    latest,
    p95ResponseTimeMs: getP95(durations),
    recent: rows.slice(0, RESPONSE_TIME_RECENT_LIMIT),
    slowest,
  };
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
        cpuUsage: input.cpuUsage ?? null,
        memoryUsage: input.memoryUsage ?? null,
        metadata: input.metadata ?? null,
        responseTimeMs: input.responseTimeMs,
        serviceName: input.serviceName,
        status: input.status,
        uptimeSeconds: getUptimeSeconds(),
      })
      .returning();

    return row;
  }

  /**
   * Store request-level API response time captured by middleware.
   */
  static async recordResponseTime(input: ResponseTimeInput) {
    const durationMs = roundMetric(Math.max(0, input.durationMs), 2);
    const [row] = await db
      .insert(apiResponseTimeLogs)
      .values({
        durationMs,
        method: input.method.toUpperCase(),
        path: input.path,
        statusCode: input.statusCode,
      })
      .returning();

    await this.createResponseTimeAlert("api", durationMs);

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
   * List resource metrics for CPU, memory, uptime, and response time.
   */
  static async getResourceMetrics() {
    const current = await getResourceSnapshot();
    const responseTime = await getResponseTimeStats();

    return {
      ...current,
      averageResponseTimeMs: responseTime.averageResponseTimeMs,
      checkedAt: new Date(),
      memoryUsage: current.systemMemoryUsage,
      p95ResponseTimeMs: responseTime.p95ResponseTimeMs,
      responseTimeMs: responseTime.latest?.durationMs ?? null,
      slowestEndpoint: responseTime.slowest,
      uptimeSeconds: getUptimeSeconds(),
    };
  }

  /**
   * Get process uptime summary.
   */
  static async getUptime() {
    const latest = await this.getLatestMetrics();

    return {
      latest,
      uptimeSeconds: getUptimeSeconds(),
    };
  }

  /**
   * List request-level API response-time metrics.
   */
  static async getResponseTime() {
    return getResponseTimeStats();
  }

  private static async checkApi() {
    const measured = await measure(async () => Promise.resolve(true));
    const status = getResponseTimeStatus(measured.responseTimeMs);
    const resources = await getResourceSnapshot();

    return this.storeHealthCheck({
      metadata: {
        ...resources.metadata,
        criticalThresholdMs: RESPONSE_TIME_CRITICAL_THRESHOLD_MS,
        warningThresholdMs: RESPONSE_TIME_WARNING_THRESHOLD_MS,
      },
      cpuUsage: resources.cpuUsage,
      memoryUsage: resources.systemMemoryUsage,
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
      const resources = await getResourceSnapshot();
      await this.createResponseTimeAlert(
        MONITORING_SERVICE_NAMES.database,
        measured.responseTimeMs,
      );

      return this.storeHealthCheck({
        metadata: { ...resources.metadata, query: "select 1" },
        cpuUsage: resources.cpuUsage,
        memoryUsage: resources.systemMemoryUsage,
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
        cpuUsage: null,
        memoryUsage: null,
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
        cpuUsage: null,
        memoryUsage: null,
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
      const resources = await getResourceSnapshot();
      await this.createResponseTimeAlert(
        MONITORING_SERVICE_NAMES.redis,
        measured.responseTimeMs,
      );

      return this.storeHealthCheck({
        metadata: { ...resources.metadata, ping: "PONG" },
        cpuUsage: resources.cpuUsage,
        memoryUsage: resources.systemMemoryUsage,
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
        cpuUsage: null,
        memoryUsage: null,
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
      cpuUsage: null,
      memoryUsage: null,
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
      message: `${serviceName} merespons dalam ${responseTimeMs.toLocaleString("id-ID")} ms.`,
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
