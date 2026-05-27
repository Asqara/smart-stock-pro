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
import { Import } from "../import";
import { JobTracking } from "../job-tracking";
import { Monitoring } from "../monitoring";
import { Notifications } from "../notifications";
import { Report } from "../report";
import { WarehouseSync } from "../sync";
import { getQueueBaseOptions, isQueueConfigured, Jobs } from "./enqueue";
import type {
  GenerateReportJobData,
  ImportProductsJobData,
  LowStockAlertJobData,
  LowStockEmailJobData,
  MonitoringCheckJobData,
  SystemErrorEmailJobData,
  WarehouseSyncJobData,
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

async function processImportJob(job: Job<ImportProductsJobData>) {
  if (job.name !== QUEUE_JOB_NAMES.importProducts) {
    throw new Error(`Job import tidak dikenal: ${job.name}`);
  }

  const { batchId, createdBy, jobId, tmpPath } = job.data;
  await JobTracking.markProcessing(jobId, job.id);

  const context = { actorUserId: createdBy, ipAddress: null, userAgent: null };

  try {
    await Import.processImport(batchId, tmpPath, context, async (progress) => {
      await JobTracking.updateProgress(jobId, progress);
    });

    await JobTracking.markCompleted(jobId, { batchId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import gagal.";
    await JobTracking.markFailed(jobId, message);

    throw error;
  }
}

async function processReportJob(job: Job<GenerateReportJobData>) {
  if (job.name !== QUEUE_JOB_NAMES.generateReport) {
    throw new Error(`Job report tidak dikenal: ${job.name}`);
  }

  const { createdBy, filters, jobId, outputFormat, reportExportId, reportType } = job.data;
  await JobTracking.markProcessing(jobId, job.id);
  await JobTracking.updateProgress(jobId, 10);

  try {
    const reportTypeValue = reportType as import("@/constants/inventory").ReportType;
    const filterObj = filters as import("@/client/report").Report extends { generateInventorySummaryData: (f: infer F) => any } ? F : Record<string, string | null | undefined>;

    let buffer: Buffer;
    if (outputFormat === "CSV") {
      buffer = await Report.buildCsv(reportTypeValue, filters as any);
    } else {
      buffer = await Report.buildPdf(reportTypeValue, filters as any, createdBy);
    }

    await JobTracking.updateProgress(jobId, 90);
    await Report.markCompleted(reportExportId);
    await JobTracking.markCompleted(jobId, { reportExportId, size: buffer.length });
    await Report.notifyCompleted(reportExportId, reportTypeValue, createdBy);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Laporan gagal dibuat.";
    await Report.markFailed(reportExportId);
    await JobTracking.markFailed(jobId, message);
    await Report.notifyFailed(reportExportId, reportType as any, createdBy);

    throw error;
  }
}

async function processWarehouseSyncJob(job: Job<WarehouseSyncJobData>) {
  if (job.name !== QUEUE_JOB_NAMES.warehouseSync) {
    throw new Error(`Job sync tidak dikenal: ${job.name}`);
  }

  const {
    destinationWarehouseId,
    itemCount,
    jobId,
    sourceWarehouseId,
    syncLogId,
    transferId,
    transferNumber,
  } = job.data;

  await JobTracking.markProcessing(jobId, job.id);
  await WarehouseSync.markSyncing(syncLogId);

  try {
    await new Promise((resolve) => setTimeout(resolve, 500));

    await WarehouseSync.markCompleted(
      syncLogId,
      `Sinkronisasi transfer ${transferNumber} berhasil. ${itemCount} produk disinkronkan.`,
    );
    await JobTracking.markCompleted(jobId, {
      destinationWarehouseId,
      itemCount,
      sourceWarehouseId,
      transferId,
    });

    await Notifications.createForRoles(["ADMIN", "WAREHOUSE_MANAGER"], {
      actionHref: `/transfers/${transferId}`,
      message: `Sinkronisasi gudang untuk transfer ${transferNumber} selesai.`,
      severity: "info",
      title: "Sinkronisasi Selesai",
      type: "SYNC_FAILED",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sinkronisasi gagal.";
    await WarehouseSync.markFailed(syncLogId, message);
    await JobTracking.markFailed(jobId, message);

    await Notifications.createForRole("ADMIN", {
      actionHref: `/transfers/${transferId}`,
      message: `Sinkronisasi gudang untuk transfer ${transferNumber} gagal: ${message}`,
      severity: "warning",
      title: "Sinkronisasi Gagal",
      type: "SYNC_FAILED",
    });

    throw error;
  }
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
    type: "JOB_FAILED",
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
    const importWorker = new Worker(QUEUE_NAMES.import, processImportJob, {
      ...getQueueBaseOptions(),
      concurrency: 1,
      name: "smartstock-import-worker",
    });
    const reportWorker = new Worker(QUEUE_NAMES.report, processReportJob, {
      ...getQueueBaseOptions(),
      concurrency: 2,
      name: "smartstock-report-worker",
    });
    const warehouseSyncWorker = new Worker(
      QUEUE_NAMES.warehouseSync,
      processWarehouseSyncJob,
      {
        ...workerOptions,
        name: "smartstock-warehouse-sync-worker",
      },
    );

    attachFailureLogger(alertWorker, QUEUE_NAMES.alerts);
    attachFailureLogger(emailWorker, QUEUE_NAMES.emails);
    attachFailureLogger(monitoringWorker, QUEUE_NAMES.monitoring);
    attachFailureLogger(importWorker, QUEUE_NAMES.import);
    attachFailureLogger(reportWorker, QUEUE_NAMES.report);
    attachFailureLogger(warehouseSyncWorker, QUEUE_NAMES.warehouseSync);

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
