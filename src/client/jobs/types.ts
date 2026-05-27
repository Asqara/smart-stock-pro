import type { AuditContext } from "../types";

/**
 * Email recipient payload stored in email queue jobs.
 */
export type QueuedEmailRecipient = {
  email: string;
  name: string;
};

/**
 * Low-stock alert job payload.
 */
export type LowStockAlertJobData = AuditContext & {
  productId: string;
  warehouseId: string;
};

/**
 * Low-stock email job payload.
 */
export type LowStockEmailJobData = {
  currentStock: number;
  minimumStock: number;
  productName: string;
  recipients: QueuedEmailRecipient[];
  unit: string;
  warehouseName: string;
};

/**
 * System error email job payload.
 */
export type SystemErrorEmailJobData = {
  message: string;
  module: string;
  recipients: QueuedEmailRecipient[];
  severity: string;
};

/**
 * Monitoring check job payload.
 */
export type MonitoringCheckJobData = {
  serviceName?: string;
};

/**
 * Import products job payload.
 */
export type ImportProductsJobData = {
  batchId: string;
  createdBy: string;
  jobId: string;
  tmpPath: string;
};

/**
 * Generate report job payload.
 */
export type GenerateReportJobData = {
  createdBy: string;
  filters: Record<string, unknown>;
  jobId: string;
  outputFormat: "CSV" | "PDF";
  reportExportId: string;
  reportType: string;
};

/**
 * Warehouse sync job payload.
 */
export type WarehouseSyncJobData = {
  destinationWarehouseId: string;
  itemCount: number;
  jobId: string;
  sourceWarehouseId: string;
  syncLogId: string;
  transferId: string;
  transferNumber: string;
};

/**
 * Queue enqueue result.
 */
export type QueueEnqueueResult = {
  jobId?: string;
  queued: boolean;
  reason?: string;
};
