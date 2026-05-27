import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { USER_ROLE_VALUES } from "@/constants/auth";
import {
  ERROR_SEVERITY_VALUES,
  HEALTH_CHECK_STATUS_VALUES,
  IMPORT_ROW_STATUS_VALUES,
  IMPORT_STATUS_VALUES,
  JOB_STATUS_VALUES,
  JOB_TYPE_VALUES,
  NOTIFICATION_SEVERITY_VALUES,
  NOTIFICATION_TYPE_VALUES,
  REPORT_TYPE_VALUES,
  STOCK_MOVEMENT_TYPE_VALUES,
  SYNC_STATUS_VALUES,
  TRANSFER_STATUS_VALUES,
} from "@/constants/inventory";

const timestampz = (name: string) => timestamp(name, { withTimezone: true });

/**
 * Database enum for system user roles.
 */
export const userRole = pgEnum("user_role", USER_ROLE_VALUES);

/**
 * Database enum for stock movement ledger types.
 */
export const stockMovementType = pgEnum(
  "stock_movement_type",
  STOCK_MOVEMENT_TYPE_VALUES,
);

/**
 * Database enum for warehouse transfer status.
 */
export const transferStatus = pgEnum("transfer_status", TRANSFER_STATUS_VALUES);

/**
 * Database enum for import batch status.
 */
export const importStatus = pgEnum("import_status", IMPORT_STATUS_VALUES);

/**
 * Database enum for import batch row status.
 */
export const importRowStatus = pgEnum(
  "import_row_status",
  IMPORT_ROW_STATUS_VALUES,
);

/**
 * Database enum for background job types.
 */
export const jobType = pgEnum("job_type", JOB_TYPE_VALUES);

/**
 * Database enum for background job status.
 */
export const jobStatus = pgEnum("job_status", JOB_STATUS_VALUES);

/**
 * Database enum for warehouse sync status.
 */
export const syncStatus = pgEnum("sync_status", SYNC_STATUS_VALUES);

/**
 * Database enum for report export types.
 */
export const reportType = pgEnum("report_type", REPORT_TYPE_VALUES);

/**
 * Database enum for notification types.
 */
export const notificationType = pgEnum(
  "notification_type",
  NOTIFICATION_TYPE_VALUES,
);

/**
 * Database enum for notification severity.
 */
export const notificationSeverity = pgEnum(
  "notification_severity",
  NOTIFICATION_SEVERITY_VALUES,
);

/**
 * Database enum for error log severity.
 */
export const errorSeverity = pgEnum("error_severity", ERROR_SEVERITY_VALUES);

/**
 * Database enum for system health status.
 */
export const healthCheckStatus = pgEnum(
  "health_check_status",
  HEALTH_CHECK_STATUS_VALUES,
);

/**
 * Authenticated system users.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").default("VIEWER").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastLoginAt: timestampz("last_login_at"),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    isActiveIdx: index("users_is_active_idx").on(table.isActive),
    roleIdx: index("users_role_idx").on(table.role),
  }),
);

/**
 * Server-side session records for secure cookie auth.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionTokenHash: text("session_token_hash").notNull(),
    csrfTokenHash: text("csrf_token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: inet("ip_address"),
    expiresAt: timestampz("expires_at").notNull(),
    idleExpiresAt: timestampz("idle_expires_at").notNull(),
    revokedAt: timestampz("revoked_at"),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    expiresAtIdx: index("sessions_expires_at_idx").on(table.expiresAt),
    idleExpiresAtIdx: index("sessions_idle_expires_at_idx").on(
      table.idleExpiresAt,
    ),
    revokedAtIdx: index("sessions_revoked_at_idx").on(table.revokedAt),
    tokenHashIdx: uniqueIndex("sessions_session_token_hash_idx").on(
      table.sessionTokenHash,
    ),
    userIdIdx: index("sessions_user_id_idx").on(table.userId),
  }),
);

/**
 * Immutable audit trail for important security and user-management actions.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    description: text("description").notNull(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    actionIdx: index("audit_logs_action_idx").on(table.action),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
    entityIdx: index("audit_logs_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
    userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
  }),
);

/**
 * Product categories.
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    isActiveIdx: index("categories_is_active_idx").on(table.isActive),
    nameIdx: index("categories_name_idx").on(table.name),
    slugIdx: uniqueIndex("categories_slug_idx").on(table.slug),
  }),
);

/**
 * Product suppliers.
 */
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("suppliers_email_idx").on(table.email),
    isActiveIdx: index("suppliers_is_active_idx").on(table.isActive),
    nameIdx: index("suppliers_name_idx").on(table.name),
  }),
);

/**
 * Warehouses operated by PT Maju Bersama Digital.
 */
export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    address: text("address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    cityIdx: index("warehouses_city_idx").on(table.city),
    codeIdx: uniqueIndex("warehouses_code_idx").on(table.code),
    isActiveIdx: index("warehouses_is_active_idx").on(table.isActive),
    nameIdx: index("warehouses_name_idx").on(table.name),
  }),
);

/**
 * Product master data. Stock is not stored here.
 */
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    imageKey: text("image_key"),
    imageUrl: text("image_url"),
    unit: text("unit").notNull(),
    minimumStock: integer("minimum_stock").default(0).notNull(),
    price: integer("price").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    categoryIdIdx: index("products_category_id_idx").on(table.categoryId),
    createdAtIdx: index("products_created_at_idx").on(table.createdAt),
    isActiveIdx: index("products_is_active_idx").on(table.isActive),
    imageKeyIdx: index("products_image_key_idx").on(table.imageKey),
    minimumStockCheck: check(
      "products_minimum_stock_check",
      sql`${table.minimumStock} >= 0`,
    ),
    nameIdx: index("products_name_idx").on(table.name),
    priceCheck: check("products_price_check", sql`${table.price} >= 0`),
    skuIdx: uniqueIndex("products_sku_idx").on(table.sku),
    supplierIdIdx: index("products_supplier_id_idx").on(table.supplierId),
  }),
);

/**
 * Stock batches with remaining quantity per product and warehouse.
 */
export const stockBatches = pgTable(
  "stock_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    sourceMovementId: uuid("source_movement_id"),
    quantityInitial: integer("quantity_initial").notNull(),
    quantityRemaining: integer("quantity_remaining").notNull(),
    unitCost: integer("unit_cost").default(0).notNull(),
    receivedAt: timestampz("received_at").notNull(),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    productWarehouseIdx: index("stock_batches_product_warehouse_idx").on(
      table.productId,
      table.warehouseId,
    ),
    productIdIdx: index("stock_batches_product_id_idx").on(table.productId),
    quantityInitialCheck: check(
      "stock_batches_quantity_initial_check",
      sql`${table.quantityInitial} > 0`,
    ),
    quantityRemainingCheck: check(
      "stock_batches_quantity_remaining_check",
      sql`${table.quantityRemaining} >= 0`,
    ),
    quantityRemainingIdx: index("stock_batches_quantity_remaining_idx").on(
      table.quantityRemaining,
    ),
    receivedAtIdx: index("stock_batches_received_at_idx").on(table.receivedAt),
    unitCostCheck: check(
      "stock_batches_unit_cost_check",
      sql`${table.unitCost} >= 0`,
    ),
    warehouseIdIdx: index("stock_batches_warehouse_id_idx").on(
      table.warehouseId,
    ),
  }),
);

/**
 * Immutable inventory movement ledger.
 */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    type: stockMovementType("type").notNull(),
    quantity: integer("quantity").notNull(),
    unitCost: integer("unit_cost").default(0).notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("stock_movements_created_at_idx").on(table.createdAt),
    createdByIdx: index("stock_movements_created_by_idx").on(table.createdBy),
    productIdIdx: index("stock_movements_product_id_idx").on(table.productId),
    quantityCheck: check(
      "stock_movements_quantity_check",
      sql`${table.quantity} > 0`,
    ),
    typeIdx: index("stock_movements_type_idx").on(table.type),
    unitCostCheck: check(
      "stock_movements_unit_cost_check",
      sql`${table.unitCost} >= 0`,
    ),
    warehouseIdIdx: index("stock_movements_warehouse_id_idx").on(
      table.warehouseId,
    ),
  }),
);

/**
 * Warehouse-to-warehouse stock transfer records.
 */
export const stockTransfers = pgTable(
  "stock_transfers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transferNumber: text("transfer_number").notNull(),
    sourceWarehouseId: uuid("source_warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    destinationWarehouseId: uuid("destination_warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    status: transferStatus("status").default("PENDING").notNull(),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    notes: text("notes"),
    errorMessage: text("error_message"),
    completedAt: timestampz("completed_at"),
    cancelledAt: timestampz("cancelled_at"),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("stock_transfers_created_at_idx").on(table.createdAt),
    destinationWarehouseIdx: index(
      "stock_transfers_destination_warehouse_idx",
    ).on(table.destinationWarehouseId),
    requestedByIdx: index("stock_transfers_requested_by_idx").on(
      table.requestedBy,
    ),
    sourceWarehouseIdx: index("stock_transfers_source_warehouse_idx").on(
      table.sourceWarehouseId,
    ),
    statusIdx: index("stock_transfers_status_idx").on(table.status),
    transferNumberIdx: uniqueIndex("stock_transfers_transfer_number_idx").on(
      table.transferNumber,
    ),
  }),
);

/**
 * Individual items included in a warehouse transfer.
 */
export const stockTransferItems = pgTable(
  "stock_transfer_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => stockTransfers.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index("stock_transfer_items_product_id_idx").on(
      table.productId,
    ),
    quantityCheck: check(
      "stock_transfer_items_quantity_check",
      sql`${table.quantity} > 0`,
    ),
    transferIdIdx: index("stock_transfer_items_transfer_id_idx").on(
      table.transferId,
    ),
  }),
);

/**
 * Background job tracking records for UI progress monitoring.
 */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    queueJobId: text("queue_job_id"),
    type: jobType("type").notNull(),
    status: jobStatus("status").default("PENDING").notNull(),
    progress: integer("progress").default(0).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    errorMessage: text("error_message"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    startedAt: timestampz("started_at"),
    completedAt: timestampz("completed_at"),
    failedAt: timestampz("failed_at"),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("jobs_created_at_idx").on(table.createdAt),
    createdByIdx: index("jobs_created_by_idx").on(table.createdBy),
    progressCheck: check("jobs_progress_check", sql`${table.progress} >= 0 and ${table.progress} <= 100`),
    queueJobIdIdx: index("jobs_queue_job_id_idx").on(table.queueJobId),
    statusIdx: index("jobs_status_idx").on(table.status),
    typeIdx: index("jobs_type_idx").on(table.type),
  }),
);

/**
 * Import batch records tracking CSV/Excel file processing.
 */
export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(),
    status: importStatus("status").default("UPLOADED").notNull(),
    totalRows: integer("total_rows").default(0).notNull(),
    successRows: integer("success_rows").default(0).notNull(),
    failedRows: integer("failed_rows").default(0).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    completedAt: timestampz("completed_at"),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("import_batches_created_at_idx").on(table.createdAt),
    createdByIdx: index("import_batches_created_by_idx").on(table.createdBy),
    statusIdx: index("import_batches_status_idx").on(table.status),
  }),
);

/**
 * Row-level import results for each CSV/Excel row.
 */
export const importBatchRows = pgTable(
  "import_batch_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    importBatchId: uuid("import_batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>().notNull(),
    normalizedData: jsonb("normalized_data").$type<Record<string, unknown>>(),
    status: importRowStatus("status").default("VALID").notNull(),
    errorMessage: text("error_message"),
    createdProductId: uuid("created_product_id"),
    createdMovementId: uuid("created_movement_id"),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    importBatchIdIdx: index("import_batch_rows_import_batch_id_idx").on(
      table.importBatchId,
    ),
    statusIdx: index("import_batch_rows_status_idx").on(table.status),
  }),
);

/**
 * Generated report export records.
 */
export const reportExports = pgTable(
  "report_exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    type: reportType("type").notNull(),
    fileName: text("file_name").notNull(),
    status: jobStatus("status").default("PENDING").notNull(),
    filter: jsonb("filter").$type<Record<string, unknown>>().notNull(),
    generatedBy: uuid("generated_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    completedAt: timestampz("completed_at"),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("report_exports_created_at_idx").on(table.createdAt),
    generatedByIdx: index("report_exports_generated_by_idx").on(
      table.generatedBy,
    ),
    jobIdIdx: index("report_exports_job_id_idx").on(table.jobId),
    statusIdx: index("report_exports_status_idx").on(table.status),
    typeIdx: index("report_exports_type_idx").on(table.type),
  }),
);

/**
 * Warehouse sync log records tracking post-transfer sync jobs.
 */
export const warehouseSyncLogs = pgTable(
  "warehouse_sync_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    transferId: uuid("transfer_id").references(() => stockTransfers.id, {
      onDelete: "set null",
    }),
    sourceWarehouseId: uuid("source_warehouse_id").references(
      () => warehouses.id,
      { onDelete: "set null" },
    ),
    destinationWarehouseId: uuid("destination_warehouse_id").references(
      () => warehouses.id,
      { onDelete: "set null" },
    ),
    status: syncStatus("status").default("PENDING").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    completedAt: timestampz("completed_at"),
    createdAt: timestampz("created_at").defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("warehouse_sync_logs_created_at_idx").on(
      table.createdAt,
    ),
    jobIdIdx: index("warehouse_sync_logs_job_id_idx").on(table.jobId),
    statusIdx: index("warehouse_sync_logs_status_idx").on(table.status),
    transferIdIdx: index("warehouse_sync_logs_transfer_id_idx").on(
      table.transferId,
    ),
  }),
);

/**
 * In-app notifications for users and roles.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    roleTarget: userRole("role_target"),
    type: notificationType("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    severity: notificationSeverity("severity").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestampz("read_at"),
    actionHref: text("action_href"),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
    isReadIdx: index("notifications_is_read_idx").on(table.isRead),
    roleTargetIdx: index("notifications_role_target_idx").on(table.roleTarget),
    severityIdx: index("notifications_severity_idx").on(table.severity),
    typeIdx: index("notifications_type_idx").on(table.type),
    userIdIdx: index("notifications_user_id_idx").on(table.userId),
  }),
);

/**
 * Application error logs for admin troubleshooting.
 */
export const errorLogs = pgTable(
  "error_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    module: text("module").notNull(),
    message: text("message").notNull(),
    stack: text("stack"),
    severity: errorSeverity("severity").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    resolvedAt: timestampz("resolved_at"),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("error_logs_created_at_idx").on(table.createdAt),
    moduleIdx: index("error_logs_module_idx").on(table.module),
    resolvedAtIdx: index("error_logs_resolved_at_idx").on(table.resolvedAt),
    severityIdx: index("error_logs_severity_idx").on(table.severity),
  }),
);

/**
 * Stored health checks and response-time metrics.
 */
export const systemHealthChecks = pgTable(
  "system_health_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serviceName: text("service_name").notNull(),
    status: healthCheckStatus("status").notNull(),
    responseTimeMs: integer("response_time_ms").notNull(),
    cpuUsage: doublePrecision("cpu_usage"),
    memoryUsage: doublePrecision("memory_usage"),
    uptimeSeconds: integer("uptime_seconds"),
    checkedAt: timestampz("checked_at").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestampz("created_at").defaultNow().notNull(),
    updatedAt: timestampz("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    checkedAtIdx: index("system_health_checks_checked_at_idx").on(
      table.checkedAt,
    ),
    responseTimeMsCheck: check(
      "system_health_checks_response_time_ms_check",
      sql`${table.responseTimeMs} >= 0`,
    ),
    responseTimeMsIdx: index("system_health_checks_response_time_ms_idx").on(
      table.responseTimeMs,
    ),
    serviceStatusIdx: index("system_health_checks_service_status_idx").on(
      table.serviceName,
      table.status,
    ),
  }),
);

/**
 * Request-level API response time metrics captured by middleware.
 */
export const apiResponseTimeLogs = pgTable(
  "api_response_time_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    path: text("path").notNull(),
    method: text("method").notNull(),
    statusCode: integer("status_code").notNull(),
    durationMs: doublePrecision("duration_ms").notNull(),
    createdAt: timestampz("created_at").defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("api_response_time_logs_created_at_idx").on(
      table.createdAt,
    ),
    durationMsCheck: check(
      "api_response_time_logs_duration_ms_check",
      sql`${table.durationMs} >= 0`,
    ),
    durationMsIdx: index("api_response_time_logs_duration_ms_idx").on(
      table.durationMs,
    ),
    pathIdx: index("api_response_time_logs_path_idx").on(table.path),
  }),
);

// Row types

/** @see users */
export type UserRow = typeof users.$inferSelect;
/** @see users */
export type NewUserRow = typeof users.$inferInsert;
/** @see sessions */
export type SessionRow = typeof sessions.$inferSelect;
/** @see auditLogs */
export type AuditLogRow = typeof auditLogs.$inferSelect;
/** @see products */
export type ProductRow = typeof products.$inferSelect;
/** @see categories */
export type CategoryRow = typeof categories.$inferSelect;
/** @see suppliers */
export type SupplierRow = typeof suppliers.$inferSelect;
/** @see warehouses */
export type WarehouseRow = typeof warehouses.$inferSelect;
/** @see stockBatches */
export type StockBatchRow = typeof stockBatches.$inferSelect;
/** @see stockMovements */
export type StockMovementRow = typeof stockMovements.$inferSelect;
/** @see stockTransfers */
export type StockTransferRow = typeof stockTransfers.$inferSelect;
/** @see stockTransferItems */
export type StockTransferItemRow = typeof stockTransferItems.$inferSelect;
/** @see jobs */
export type JobRow = typeof jobs.$inferSelect;
/** @see importBatches */
export type ImportBatchRow = typeof importBatches.$inferSelect;
/** @see importBatchRows */
export type ImportBatchRowRow = typeof importBatchRows.$inferSelect;
/** @see reportExports */
export type ReportExportRow = typeof reportExports.$inferSelect;
/** @see warehouseSyncLogs */
export type WarehouseSyncLogRow = typeof warehouseSyncLogs.$inferSelect;
/** @see notifications */
export type NotificationRow = typeof notifications.$inferSelect;
/** @see errorLogs */
export type ErrorLogRow = typeof errorLogs.$inferSelect;
/** @see systemHealthChecks */
export type SystemHealthCheckRow = typeof systemHealthChecks.$inferSelect;
/** @see apiResponseTimeLogs */
export type ApiResponseTimeLogRow = typeof apiResponseTimeLogs.$inferSelect;
