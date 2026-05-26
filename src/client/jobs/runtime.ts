import { Worker, type Job } from "bullmq";

import {
  MONITORING_SERVICE_NAMES,
  QUEUE_JOB_NAMES,
  QUEUE_NAMES,
} from "@/constants/inventory";
import { errorLogs } from "@/drizzle-schema";
import { db } from "@/lib/db";

import { EmailNotifications } from "../email";
import { ErrorLogs } from "../error-logs";
import { Monitoring } from "../monitoring";
import { Notifications } from "../notifications";
import { getQueueBaseOptions, isQueueConfigured, Jobs } from "./enqueue";
import type {
  LowStockAlertJobData,
  LowStockEmailJobData,
  MonitoringCheckJobData,
  SystemErrorEmailJobData,
} from "./types";

let queueRuntimeStarted = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

async function processAlertJob(job: Job<LowStockAlertJobData>) {
  if (job.name !== QUEUE_JOB_NAMES.lowStockAlert) {
    throw new Error(`Job alert tidak dikenal: ${job.name}`);
  }

  return Notifications.createLowStockNotification(
    job.data.productId,
    job.data.warehouseId,
    job.data,
  );
}

async function processEmailJob(
  job: Job<LowStockEmailJobData | SystemErrorEmailJobData>,
) {
  if (job.name === QUEUE_JOB_NAMES.lowStockEmail) {
    return EmailNotifications.sendLowStockEmail(job.data as LowStockEmailJobData);
  }

  if (job.name === QUEUE_JOB_NAMES.systemErrorEmail) {
    return EmailNotifications.sendSystemErrorEmail(
      job.data as SystemErrorEmailJobData,
    );
  }

  throw new Error(`Job email tidak dikenal: ${job.name}`);
}

async function processMonitoringJob(job: Job<MonitoringCheckJobData>) {
  if (job.name !== QUEUE_JOB_NAMES.monitoringCheck) {
    throw new Error(`Job monitoring tidak dikenal: ${job.name}`);
  }

  return Monitoring.check();
}

async function logQueueFailure(queueName: string, job: Job | undefined, error: Error) {
  const [errorLog] = await db
    .insert(errorLogs)
    .values({
      message: `Job ${job?.name ?? "unknown"} gagal diproses.`,
      metadata: {
        failedReason: error.message,
        jobId: job?.id ?? null,
        queueName,
      },
      module: `queue.${queueName}`,
      severity: "warning",
      stack: error.stack ?? null,
    })
    .returning();

  await Notifications.createForRole("ADMIN", {
    actionHref: `/error-logs/${errorLog.id}`,
    message: errorLog.message,
    severity: "warning",
    title: "Job queue gagal",
    type: "SYSTEM_ERROR",
  });
}

function attachFailureLogger(worker: Worker, queueName: string) {
  worker.on("failed", (job, error) => {
    void logQueueFailure(queueName, job, error);
  });
}

async function writeWorkerHeartbeat(source: string) {
  await Monitoring.storeHealthCheck({
    metadata: {
      source,
    },
    responseTimeMs: 0,
    serviceName: MONITORING_SERVICE_NAMES.worker,
    status: "healthy",
  });
}

/**
 * Start BullMQ workers inside the running server process.
 */
export function ensureQueueRuntimeStarted() {
  if (queueRuntimeStarted || !isQueueConfigured()) {
    return;
  }

  queueRuntimeStarted = true;

  try {
    const workerOptions = {
      ...getQueueBaseOptions(),
      concurrency: 3,
    };
    const alertWorker = new Worker(QUEUE_NAMES.alerts, processAlertJob, {
      ...workerOptions,
      name: "smartstock-alert-worker",
    });
    const emailWorker = new Worker(QUEUE_NAMES.emails, processEmailJob, {
      ...workerOptions,
      name: "smartstock-email-worker",
    });
    const monitoringWorker = new Worker(
      QUEUE_NAMES.monitoring,
      processMonitoringJob,
      {
        ...workerOptions,
        name: "smartstock-monitoring-worker",
      },
    );

    attachFailureLogger(alertWorker, QUEUE_NAMES.alerts);
    attachFailureLogger(emailWorker, QUEUE_NAMES.emails);
    attachFailureLogger(monitoringWorker, QUEUE_NAMES.monitoring);

    void Jobs.scheduleMonitoringCheck();
    void writeWorkerHeartbeat("queue-runtime-started");

    if (!heartbeatTimer) {
      heartbeatTimer = setInterval(() => {
        void writeWorkerHeartbeat("queue-runtime-heartbeat");
      }, 30_000);
    }
  } catch (error) {
    queueRuntimeStarted = false;
    void ErrorLogs.log({
      message:
        error instanceof Error
          ? error.message
          : "Queue runtime gagal dijalankan.",
      metadata: {
        queueRuntime: true,
      },
      module: "queue.runtime",
      severity: "critical",
      stack: error instanceof Error ? error.stack : null,
    });
  }
}
