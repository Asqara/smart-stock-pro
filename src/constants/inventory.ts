/**
 * Stock movement types persisted in the inventory ledger.
 */
export const STOCK_MOVEMENT_TYPE_VALUES = ["IN", "OUT"] as const;

/**
 * Stock valuation methods supported by stock out.
 */
export const STOCK_VALUATION_METHOD_VALUES = ["FIFO", "LIFO"] as const;

/**
 * Reference types for stock ledger rows.
 */
export const STOCK_REFERENCE_TYPE_VALUES = [
  "STOCK_IN",
  "STOCK_OUT",
  "SYSTEM",
] as const;

/**
 * Product stock status values returned by inventory APIs.
 */
export const PRODUCT_STOCK_STATUS_VALUES = [
  "available",
  "low_stock",
  "critical",
  "out_of_stock",
] as const;

/**
 * Notification type values used by alerts.
 */
export const NOTIFICATION_TYPE_VALUES = [
  "LOW_STOCK",
  "SYSTEM_ERROR",
  "RESPONSE_TIME_ALERT",
  "UPTIME_ALERT",
] as const;

/**
 * Notification severity values.
 */
export const NOTIFICATION_SEVERITY_VALUES = [
  "critical",
  "warning",
  "info",
  "success",
] as const;

/**
 * Error log severity values.
 */
export const ERROR_SEVERITY_VALUES = ["critical", "warning", "info"] as const;

/**
 * System health status values.
 */
export const HEALTH_CHECK_STATUS_VALUES = [
  "healthy",
  "degraded",
  "down",
] as const;

/**
 * Service names shown in monitoring.
 */
export const MONITORING_SERVICE_NAMES = {
  api: "api",
  database: "database",
  redis: "redis",
  worker: "worker",
} as const;

/**
 * Queue names used by BullMQ background jobs.
 */
export const QUEUE_NAMES = {
  alerts: "smartstock-alerts",
  emails: "smartstock-emails",
  monitoring: "smartstock-monitoring",
} as const;

/**
 * Job names used by SmartStock Pro queues.
 */
export const QUEUE_JOB_NAMES = {
  lowStockAlert: "low-stock-alert",
  lowStockEmail: "low-stock-email",
  monitoringCheck: "monitoring-check",
  systemErrorEmail: "system-error-email",
} as const;

/**
 * Default response-time warning threshold in milliseconds.
 */
export const RESPONSE_TIME_WARNING_THRESHOLD_MS = 1000;

/**
 * Default response-time critical threshold in milliseconds.
 */
export const RESPONSE_TIME_CRITICAL_THRESHOLD_MS = 3000;

/**
 * Roles that receive low-stock alerts.
 */
export const LOW_STOCK_ALERT_ROLE_TARGETS = [
  "ADMIN",
  "WAREHOUSE_MANAGER",
] as const;

/**
 * Role that receives system error alerts.
 */
export const SYSTEM_ERROR_ROLE_TARGET = "ADMIN";

/**
 * Stock movement type union.
 */
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPE_VALUES)[number];

/**
 * Stock valuation method union.
 */
export type StockValuationMethod =
  (typeof STOCK_VALUATION_METHOD_VALUES)[number];

/**
 * Product stock status union.
 */
export type ProductStockStatus =
  (typeof PRODUCT_STOCK_STATUS_VALUES)[number];

/**
 * Notification type union.
 */
export type NotificationType = (typeof NOTIFICATION_TYPE_VALUES)[number];

/**
 * Notification severity union.
 */
export type NotificationSeverity =
  (typeof NOTIFICATION_SEVERITY_VALUES)[number];

/**
 * Error severity union.
 */
export type ErrorSeverity = (typeof ERROR_SEVERITY_VALUES)[number];

/**
 * Health check status union.
 */
export type HealthCheckStatus = (typeof HEALTH_CHECK_STATUS_VALUES)[number];

/**
 * Queue name union.
 */
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Queue job name union.
 */
export type QueueJobName =
  (typeof QUEUE_JOB_NAMES)[keyof typeof QUEUE_JOB_NAMES];
