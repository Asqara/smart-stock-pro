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
  NOTIFICATION_SEVERITY_VALUES,
  NOTIFICATION_TYPE_VALUES,
  STOCK_MOVEMENT_TYPE_VALUES,
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
 * Selected user row type.
 */
export type UserRow = typeof users.$inferSelect;

/**
 * Insert user row type.
 */
export type NewUserRow = typeof users.$inferInsert;

/**
 * Selected session row type.
 */
export type SessionRow = typeof sessions.$inferSelect;

/**
 * Selected audit log row type.
 */
export type AuditLogRow = typeof auditLogs.$inferSelect;

/**
 * Selected product row type.
 */
export type ProductRow = typeof products.$inferSelect;

/**
 * Selected category row type.
 */
export type CategoryRow = typeof categories.$inferSelect;

/**
 * Selected supplier row type.
 */
export type SupplierRow = typeof suppliers.$inferSelect;

/**
 * Selected warehouse row type.
 */
export type WarehouseRow = typeof warehouses.$inferSelect;

/**
 * Selected stock batch row type.
 */
export type StockBatchRow = typeof stockBatches.$inferSelect;

/**
 * Selected stock movement row type.
 */
export type StockMovementRow = typeof stockMovements.$inferSelect;

/**
 * Selected notification row type.
 */
export type NotificationRow = typeof notifications.$inferSelect;

/**
 * Selected error log row type.
 */
export type ErrorLogRow = typeof errorLogs.$inferSelect;

/**
 * Selected system health check row type.
 */
export type SystemHealthCheckRow = typeof systemHealthChecks.$inferSelect;
