/**
 * MVP role values used by SmartStock Pro.
 */
export const USER_ROLE_VALUES = [
  "ADMIN",
  "WAREHOUSE_MANAGER",
  "WAREHOUSE_STAFF",
  "VIEWER",
] as const;

/**
 * Permission values used by Module 1.
 */
export const PERMISSION_VALUES = [
  "auth.login",
  "auth.logout",
  "user.read",
  "user.create",
  "user.update",
  "user.delete",
  "user.change_role",
  "user.reset_password",
  "product.read",
  "product.create",
  "product.update",
  "product.delete",
  "category.read",
  "category.create",
  "category.update",
  "category.delete",
  "supplier.read",
  "supplier.create",
  "supplier.update",
  "supplier.delete",
  "warehouse.read",
  "warehouse.create",
  "warehouse.update",
  "warehouse.delete",
  "stock.read",
  "stock.in",
  "stock.out",
  "stock.read_batches",
  "stock.read_movements",
  "notification.read",
  "notification.mark_read",
  "notification.manage",
  "error_log.read",
  "error_log.resolve",
  "monitoring.read",
  "monitoring.read_server",
  "monitoring.read_redis",
  "monitoring.read_database",
  "audit_log.read",
  "security.read_risk_document",
] as const;

/**
 * User role union.
 */
export type UserRole = (typeof USER_ROLE_VALUES)[number];

/**
 * Permission union.
 */
export type Permission = (typeof PERMISSION_VALUES)[number];

/**
 * Role labels shown in Bahasa Indonesia.
 */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  WAREHOUSE_MANAGER: "Manajer Gudang",
  WAREHOUSE_STAFF: "Staf Gudang",
  VIEWER: "Viewer",
};

/**
 * Permission labels shown in admin screens.
 */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "auth.login": "Login",
  "auth.logout": "Logout",
  "user.read": "Lihat User",
  "user.create": "Buat User",
  "user.update": "Ubah User",
  "user.delete": "Nonaktifkan User",
  "user.change_role": "Ubah Role",
  "user.reset_password": "Reset Password",
  "product.read": "Lihat Produk",
  "product.create": "Buat Produk",
  "product.update": "Ubah Produk",
  "product.delete": "Nonaktifkan Produk",
  "category.read": "Lihat Kategori",
  "category.create": "Buat Kategori",
  "category.update": "Ubah Kategori",
  "category.delete": "Nonaktifkan Kategori",
  "supplier.read": "Lihat Supplier",
  "supplier.create": "Buat Supplier",
  "supplier.update": "Ubah Supplier",
  "supplier.delete": "Nonaktifkan Supplier",
  "warehouse.read": "Lihat Gudang",
  "warehouse.create": "Buat Gudang",
  "warehouse.update": "Ubah Gudang",
  "warehouse.delete": "Nonaktifkan Gudang",
  "stock.read": "Lihat Stok",
  "stock.in": "Catat Stock In",
  "stock.out": "Catat Stock Out",
  "stock.read_batches": "Lihat Batch Stok",
  "stock.read_movements": "Lihat Riwayat Stok",
  "notification.read": "Lihat Notifikasi",
  "notification.mark_read": "Tandai Notifikasi",
  "notification.manage": "Kelola Notifikasi",
  "error_log.read": "Lihat Error Log",
  "error_log.resolve": "Selesaikan Error Log",
  "monitoring.read": "Lihat Monitoring",
  "monitoring.read_server": "Lihat Server",
  "monitoring.read_redis": "Lihat Redis",
  "monitoring.read_database": "Lihat Database",
  "audit_log.read": "Lihat Audit Log",
  "security.read_risk_document": "Baca Dokumen Risiko",
};

/**
 * Permission mapping per MVP role.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  ADMIN: PERMISSION_VALUES,
  WAREHOUSE_MANAGER: [
    "auth.login",
    "auth.logout",
    "product.read",
    "product.create",
    "product.update",
    "category.read",
    "category.create",
    "category.update",
    "supplier.read",
    "supplier.create",
    "supplier.update",
    "warehouse.read",
    "warehouse.create",
    "warehouse.update",
    "stock.read",
    "stock.in",
    "stock.out",
    "stock.read_batches",
    "stock.read_movements",
    "notification.read",
    "notification.mark_read",
    "monitoring.read",
    "monitoring.read_database",
    "monitoring.read_redis",
    "security.read_risk_document",
  ],
  WAREHOUSE_STAFF: [
    "auth.login",
    "auth.logout",
    "product.read",
    "warehouse.read",
    "stock.read",
    "stock.in",
    "stock.out",
    "stock.read_movements",
    "notification.read",
    "notification.mark_read",
    "security.read_risk_document",
  ],
  VIEWER: [
    "auth.login",
    "auth.logout",
    "product.read",
    "warehouse.read",
    "stock.read",
    "stock.read_movements",
    "notification.read",
    "security.read_risk_document",
  ],
};

/**
 * Audit action names used by security-sensitive flows.
 */
export const AUDIT_ACTIONS = {
  ACCESS_DENIED: "ACCESS_DENIED",
  AUTH_LOGIN_FAILED: "AUTH_LOGIN_FAILED",
  AUTH_LOGIN_SUCCESS: "AUTH_LOGIN_SUCCESS",
  AUTH_LOGOUT: "AUTH_LOGOUT",
  CATEGORY_CREATED: "CATEGORY_CREATED",
  CATEGORY_DEACTIVATED: "CATEGORY_DEACTIVATED",
  CATEGORY_UPDATED: "CATEGORY_UPDATED",
  ERROR_RESOLVED: "ERROR_RESOLVED",
  LOW_STOCK_NOTIFICATION_CREATED: "LOW_STOCK_NOTIFICATION_CREATED",
  PRODUCT_CREATED: "PRODUCT_CREATED",
  PRODUCT_DEACTIVATED: "PRODUCT_DEACTIVATED",
  PRODUCT_UPDATED: "PRODUCT_UPDATED",
  STOCK_IN_CREATED: "STOCK_IN_CREATED",
  STOCK_OUT_CREATED: "STOCK_OUT_CREATED",
  SUPPLIER_CREATED: "SUPPLIER_CREATED",
  SUPPLIER_DEACTIVATED: "SUPPLIER_DEACTIVATED",
  SUPPLIER_UPDATED: "SUPPLIER_UPDATED",
  USER_ACTIVATED: "USER_ACTIVATED",
  USER_CREATED: "USER_CREATED",
  USER_DEACTIVATED: "USER_DEACTIVATED",
  USER_PASSWORD_RESET: "USER_PASSWORD_RESET",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  USER_UPDATED: "USER_UPDATED",
  WAREHOUSE_CREATED: "WAREHOUSE_CREATED",
  WAREHOUSE_DEACTIVATED: "WAREHOUSE_DEACTIVATED",
  WAREHOUSE_UPDATED: "WAREHOUSE_UPDATED",
} as const;

/**
 * Session idle timeout in seconds.
 */
export const SESSION_IDLE_TIMEOUT_SECONDS = 30 * 60;

/**
 * Session absolute timeout in seconds.
 */
export const SESSION_ABSOLUTE_TIMEOUT_SECONDS = 24 * 60 * 60;

/**
 * CSRF header required on mutation requests after login.
 */
export const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Demo password for local seed users only.
 */
export const DEMO_USER_PASSWORD = "Demo#12345";

/**
 * Argon2 password hash options shared by auth and seed flows.
 */
export const PASSWORD_HASH_OPTIONS = {
  memoryCost: 19_456,
  outputLen: 32,
  parallelism: 1,
  timeCost: 2,
} as const;

/**
 * Demo users for local development seed data.
 */
export const DEMO_USERS = [
  {
    email: "admin@smartstock.test",
    name: "Admin SmartStock",
    role: "ADMIN",
  },
  {
    email: "manager@smartstock.test",
    name: "Manajer Gudang Demo",
    role: "WAREHOUSE_MANAGER",
  },
  {
    email: "staff@smartstock.test",
    name: "Staf Gudang Demo",
    role: "WAREHOUSE_STAFF",
  },
  {
    email: "viewer@smartstock.test",
    name: "Viewer Demo",
    role: "VIEWER",
  },
] as const satisfies readonly {
  email: string;
  name: string;
  role: UserRole;
}[];
