import { Queue, type JobsOptions } from "bullmq";

import { QUEUE_JOB_NAMES, QUEUE_NAMES } from "@/constants/inventory";

import type {
  LowStockAlertJobData,
  LowStockEmailJobData,
  MonitoringCheckJobData,
  QueueEnqueueResult,
  SystemErrorEmailJobData,
} from "./types";

const QUEUE_PREFIX = "smartstock";
const MONITORING_REPEAT_JOB_ID = "smartstock-monitoring-check";

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    delay: 5_000,
    type: "exponential",
  },
  removeOnComplete: {
    age: 86_400,
    count: 500,
  },
  removeOnFail: {
    age: 604_800,
    count: 1_000,
  },
} satisfies JobsOptions;

let alertQueue: Queue | null = null;
let emailQueue: Queue | null = null;
let monitoringQueue: Queue | null = null;

/**
 * Check whether Redis queue config is available.
 */
export function isQueueConfigured() {
  return Boolean(process.env.REDIS_URL);
}

/**
 * BullMQ base options shared by queues and workers.
 */
export function getQueueBaseOptions() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL belum diatur.");
  }

  return {
    connection: {
      maxRetriesPerRequest: null,
      url: redisUrl,
    },
    prefix: QUEUE_PREFIX,
  };
}

function getQueue(queueName: string, currentQueue: Queue | null) {
  if (currentQueue) {
    return currentQueue;
  }

  return new Queue(queueName, {
    ...getQueueBaseOptions(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}

function getAlertQueue() {
  alertQueue = getQueue(QUEUE_NAMES.alerts, alertQueue);

  return alertQueue;
}

function getEmailQueue() {
  emailQueue = getQueue(QUEUE_NAMES.emails, emailQueue);

  return emailQueue;
}

function getMonitoringQueue() {
  monitoringQueue = getQueue(QUEUE_NAMES.monitoring, monitoringQueue);

  return monitoringQueue;
}

async function enqueueJob<Data>(
  queue: Queue,
  name: string,
  data: Data,
  options?: JobsOptions,
): Promise<QueueEnqueueResult> {
  try {
    const job = await queue.add(name, data, options);

    return {
      jobId: job.id,
      queued: true,
    };
  } catch (error) {
    return {
      queued: false,
      reason: error instanceof Error ? error.message : "Queue gagal dipakai.",
    };
  }
}

/**
 * Queue enqueue helpers for inventory alerts, email, and monitoring.
 */
export class Jobs {
  /**
   * Enqueue low-stock alert processing.
   */
  static enqueueLowStockAlert(data: LowStockAlertJobData) {
    if (!isQueueConfigured()) {
      return Promise.resolve({
        queued: false,
        reason: "REDIS_URL belum diatur.",
      });
    }

    return enqueueJob(getAlertQueue(), QUEUE_JOB_NAMES.lowStockAlert, data);
  }

  /**
   * Enqueue low-stock email delivery.
   */
  static enqueueLowStockEmail(data: LowStockEmailJobData) {
    if (!isQueueConfigured()) {
      return Promise.resolve({
        queued: false,
        reason: "REDIS_URL belum diatur.",
      });
    }

    return enqueueJob(getEmailQueue(), QUEUE_JOB_NAMES.lowStockEmail, data);
  }

  /**
   * Enqueue system error email delivery.
   */
  static enqueueSystemErrorEmail(data: SystemErrorEmailJobData) {
    if (!isQueueConfigured()) {
      return Promise.resolve({
        queued: false,
        reason: "REDIS_URL belum diatur.",
      });
    }

    return enqueueJob(getEmailQueue(), QUEUE_JOB_NAMES.systemErrorEmail, data);
  }

  /**
   * Enqueue a one-off monitoring check.
   */
  static enqueueMonitoringCheck(data: MonitoringCheckJobData = {}) {
    if (!isQueueConfigured()) {
      return Promise.resolve({
        queued: false,
        reason: "REDIS_URL belum diatur.",
      });
    }

    return enqueueJob(getMonitoringQueue(), QUEUE_JOB_NAMES.monitoringCheck, data);
  }

  /**
   * Schedule recurring monitoring checks.
   */
  static scheduleMonitoringCheck() {
    if (!isQueueConfigured()) {
      return Promise.resolve({
        queued: false,
        reason: "REDIS_URL belum diatur.",
      });
    }

    return enqueueJob(
      getMonitoringQueue(),
      QUEUE_JOB_NAMES.monitoringCheck,
      { serviceName: "scheduled" },
      {
        jobId: MONITORING_REPEAT_JOB_ID,
        repeat: {
          every: 60_000,
        },
      },
    );
  }

  /**
   * Read queue counts for monitoring UI.
   */
  static async getQueueSummaries() {
    if (!isQueueConfigured()) {
      return [];
    }

    const queues = [
      { label: "Alert Queue", queue: getAlertQueue() },
      { label: "Email Queue", queue: getEmailQueue() },
      { label: "Monitoring Queue", queue: getMonitoringQueue() },
    ];
    const summaries = [];

    for (const item of queues) {
      const counts = await item.queue.getJobCounts(
        "active",
        "completed",
        "delayed",
        "failed",
        "waiting",
      );
      const total =
        counts.active +
        counts.completed +
        counts.delayed +
        counts.failed +
        counts.waiting;
      const progressValue =
        total > 0 ? Math.round((counts.completed / total) * 100) : 100;
      const status =
        counts.failed > 0
          ? "failed"
          : counts.active > 0
            ? "processing"
            : counts.waiting + counts.delayed > 0
              ? "pending"
              : "completed";

      summaries.push({
        active: counts.active,
        completed: counts.completed,
        delayed: counts.delayed,
        failed: counts.failed,
        progressValue,
        queueName: item.label,
        status,
        waiting: counts.waiting,
      });
    }

    return summaries;
  }
}
