/**
 * Default dashboard date range in days.
 */
export const DASHBOARD_DEFAULT_RANGE_DAYS = 30;

/**
 * Dashboard period filter values.
 */
export const DASHBOARD_PERIOD_VALUES = ["today", "7d", "30d", "90d"] as const;

/**
 * Default dashboard period for trend charts.
 */
export const DASHBOARD_DEFAULT_PERIOD = "30d";

/**
 * Number of days represented by each dashboard period.
 */
export const DASHBOARD_PERIOD_DAY_COUNTS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  today: 1,
} as const;

/**
 * Maximum alert rows shown on the main dashboard.
 */
export const DASHBOARD_ALERT_LIMIT = 5;

/**
 * Default recent table limit for dashboard widgets.
 */
export const DASHBOARD_RECENT_LIMIT = 8;

/**
 * Dashboard export report type values.
 */
export const DASHBOARD_EXPORT_REPORT_TYPE_VALUES = [
  "DASHBOARD_SUMMARY",
  "INVENTORY_SUMMARY",
  "STOCK_MOVEMENT",
] as const;

/**
 * Dashboard export filename prefix.
 */
export const DASHBOARD_EXPORT_FILE_PREFIX = "smartstock-dashboard";

/**
 * Dashboard period union.
 */
export type DashboardPeriod = (typeof DASHBOARD_PERIOD_VALUES)[number];

/**
 * Dashboard export report type union.
 */
export type DashboardExportReportType =
  (typeof DASHBOARD_EXPORT_REPORT_TYPE_VALUES)[number];
