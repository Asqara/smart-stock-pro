/**
 * Stock movement types persisted in the inventory ledger.
 */
export const STOCK_MOVEMENT_TYPE_VALUES = [
  "IN",
  "OUT",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "IMPORT",
  "ADJUSTMENT",
] as const;

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
  "TRANSFER",
  "IMPORT",
  "ADJUSTMENT",
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
 * Transfer status values for warehouse-to-warehouse transfers.
 */
export const TRANSFER_STATUS_VALUES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
] as const;

/**
 * Import batch status values.
 */
export const IMPORT_STATUS_VALUES = [
  "UPLOADED",
  "VALIDATING",
  "PROCESSING",
  "COMPLETED",
  "COMPLETED_WITH_ERRORS",
  "FAILED",
  "ROLLED_BACK",
] as const;

/**
 * Import batch row status values.
 */
export const IMPORT_ROW_STATUS_VALUES = [
  "VALID",
  "INVALID",
  "IMPORTED",
  "FAILED",
  "SKIPPED",
] as const;

/**
 * Background job type values.
 */
export const JOB_TYPE_VALUES = [
  "IMPORT_PRODUCTS",
  "GENERATE_INVENTORY_REPORT",
  "GENERATE_MOVEMENT_REPORT",
  "GENERATE_TRANSFER_REPORT",
  "WAREHOUSE_SYNC",
  "LOW_STOCK_CHECK",
] as const;

/**
 * Background job status values.
 */
export const JOB_STATUS_VALUES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

/**
 * Warehouse sync log status values.
 */
export const SYNC_STATUS_VALUES = [
  "PENDING",
  "SYNCING",
  "COMPLETED",
  "FAILED",
] as const;

/**
 * Report export type values.
 */
export const REPORT_TYPE_VALUES = [
  "INVENTORY_SUMMARY",
  "STOCK_MOVEMENT",
  "TRANSFER_REPORT",
  "LOW_STOCK_REPORT",
] as const;

/**
 * Notification type values used by alerts.
 */
export const NOTIFICATION_TYPE_VALUES = [
  "LOW_STOCK",
  "SYSTEM_ERROR",
  "RESPONSE_TIME_ALERT",
  "UPTIME_ALERT",
  "TRANSFER_COMPLETED",
  "TRANSFER_FAILED",
  "IMPORT_COMPLETED",
  "IMPORT_FAILED",
  "REPORT_COMPLETED",
  "REPORT_FAILED",
  "JOB_FAILED",
  "SYNC_FAILED",
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
  import: "smartstock-import",
  monitoring: "smartstock-monitoring",
  report: "smartstock-report",
  warehouseSync: "smartstock-warehouse-sync",
} as const;

/**
 * Job names used by SmartStock Pro queues.
 */
export const QUEUE_JOB_NAMES = {
  generateReport: "generate-report",
  importProducts: "import-products",
  lowStockAlert: "low-stock-alert",
  lowStockEmail: "low-stock-email",
  monitoringCheck: "monitoring-check",
  systemErrorEmail: "system-error-email",
  warehouseSync: "warehouse-sync",
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
 * Default map center for Indonesia.
 */
export const INDONESIA_MAP_CENTER = {
  latitude: -2.5489,
  longitude: 118.0149,
} as const;

/**
 * Default city centers used by the warehouse location picker.
 */
export const WAREHOUSE_CITY_COORDINATES = {
  Bandung: { latitude: -6.9175, longitude: 107.6191 },
  Jakarta: { latitude: -6.2088, longitude: 106.8456 },
  Makassar: { latitude: -5.1477, longitude: 119.4327 },
  Medan: { latitude: 3.5952, longitude: 98.6722 },
  Surabaya: { latitude: -7.2575, longitude: 112.7521 },
} as const;

/**
 * Default map zoom levels for warehouse location forms.
 */
export const WAREHOUSE_MAP_PICKER_ZOOM = {
  country: 5,
  location: 12,
} as const;

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
 * Import required column headers.
 */
export const IMPORT_REQUIRED_COLUMNS = [
  "sku",
  "name",
  "category",
  "supplier",
  "warehouse_code",
  "quantity",
  "unit_cost",
  "minimum_stock",
] as const;

/**
 * Import optional column headers.
 */
export const IMPORT_OPTIONAL_COLUMNS = [
  "description",
  "unit",
  "price",
] as const;

/**
 * Backward-compatible CSV fallback headers.
 */
export const IMPORT_CSV_REQUIRED_COLUMNS = IMPORT_REQUIRED_COLUMNS;

/**
 * Backward-compatible CSV fallback optional headers.
 */
export const IMPORT_CSV_OPTIONAL_COLUMNS = IMPORT_OPTIONAL_COLUMNS;

/**
 * Import Excel MIME types accepted by the API.
 */
export const IMPORT_EXCEL_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/**
 * Maximum import file size in bytes (10 MB).
 */
export const IMPORT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Import concurrency limit for parallel row processing.
 */
export const IMPORT_CONCURRENCY_LIMIT = 5;

/**
 * Import chunk size for parsing and validation.
 */
export const IMPORT_CHUNK_SIZE = 50;

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
 * Transfer status union.
 */
export type TransferStatus = (typeof TRANSFER_STATUS_VALUES)[number];

/**
 * Import batch status union.
 */
export type ImportStatus = (typeof IMPORT_STATUS_VALUES)[number];

/**
 * Import row status union.
 */
export type ImportRowStatus = (typeof IMPORT_ROW_STATUS_VALUES)[number];

/**
 * Job type union.
 */
export type JobType = (typeof JOB_TYPE_VALUES)[number];

/**
 * Job status union.
 */
export type JobStatus = (typeof JOB_STATUS_VALUES)[number];

/**
 * Sync status union.
 */
export type SyncStatus = (typeof SYNC_STATUS_VALUES)[number];

/**
 * Report type union.
 */
export type ReportType = (typeof REPORT_TYPE_VALUES)[number];

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
