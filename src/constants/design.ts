/**
 * Logo assets available in the public folder.
 */
export const LOGO_ASSETS = {
  compact: "/logogram.svg",
  favicon: "/favicon.png",
  horizontal: "/logotype_horizontal.svg",
  vertical: "/logotype_vertical.svg",
} as const;

/**
 * Button visual variants from the SmartStock Pro design system.
 */
export const BUTTON_VARIANT_CLASS_NAMES = {
  danger:
    "bg-danger text-text-inverse hover:bg-danger-hover focus-visible:ring-danger",
  ghost:
    "bg-transparent text-text-default hover:bg-muted-surface focus-visible:ring-primary-blue",
  primary:
    "bg-primary-blue text-text-inverse hover:bg-primary-blue-hover focus-visible:ring-primary-blue",
  secondary:
    "border border-border-default bg-card-surface text-text-strong hover:bg-muted-surface focus-visible:ring-primary-blue",
} as const;

/**
 * Button sizes from the dashboard interaction model.
 */
export const BUTTON_SIZE_CLASS_NAMES = {
  default: "h-10 px-4",
  icon: "h-10 w-10 p-0",
  sm: "h-9 px-3",
} as const;

/**
 * Status badge tones for operational data.
 */
export const STATUS_TONE_CLASS_NAMES = {
  danger: "border-danger-border bg-danger-bg text-danger",
  info: "border-info-border bg-info-bg text-info",
  neutral: "border-neutral-border bg-neutral-bg text-neutral",
  stockAvailable:
    "border-stock-available-border bg-stock-available-bg text-stock-available-text",
  stockCritical:
    "border-stock-critical-border bg-stock-critical-bg text-stock-critical-text",
  stockLow: "border-stock-low-border bg-stock-low-bg text-stock-low-text",
  stockOut: "border-stock-out-border bg-stock-out-bg text-stock-out-text",
  success: "border-success-border bg-success-bg text-success",
  warning: "border-warning-border bg-warning-bg text-warning",
} as const;

/**
 * Chart colors aligned with SmartStock Pro operational states.
 */
export const CHART_COLORS = {
  adjustment: "#64748B",
  danger: "#DC2626",
  grid: "#E2E8F0",
  import: "#2563EB",
  inbound: "#16A34A",
  neutral: "#64748B",
  outbound: "#DC2626",
  primary: "#2563EB",
  transferIn: "#0891B2",
  transferOut: "#D97706",
  warning: "#D97706",
} as const;

/**
 * Stock status labels shown to users.
 */
export const STOCK_STATUS_LABELS = {
  available: "Tersedia",
  critical: "Stok Kritis",
  low: "Stok Rendah",
  out: "Stok Habis",
} as const;

/**
 * Stock status tone mapping.
 */
export const STOCK_STATUS_TONES = {
  available: "stockAvailable",
  critical: "stockCritical",
  low: "stockLow",
  out: "stockOut",
} as const;

/**
 * Transfer status labels shown to users.
 */
export const TRANSFER_STATUS_LABELS = {
  approved: "Disetujui",
  cancelled: "Dibatalkan",
  completed: "Selesai",
  draft: "Draft",
  failed: "Gagal",
  pending: "Menunggu",
} as const;

/**
 * Transfer status tone mapping.
 */
export const TRANSFER_STATUS_TONES = {
  approved: "info",
  cancelled: "neutral",
  completed: "success",
  draft: "neutral",
  failed: "danger",
  pending: "warning",
} as const;

/**
 * Import batch status labels shown to users.
 */
export const IMPORT_STATUS_LABELS = {
  COMPLETED: "Selesai",
  COMPLETED_WITH_ERRORS: "Selesai dengan Error",
  FAILED: "Gagal",
  PROCESSING: "Diproses",
  ROLLED_BACK: "Di-rollback",
  UPLOADED: "Diunggah",
  VALIDATING: "Divalidasi",
} as const;

/**
 * Import batch status tone mapping.
 */
export const IMPORT_STATUS_TONES = {
  COMPLETED: "success",
  COMPLETED_WITH_ERRORS: "warning",
  FAILED: "danger",
  PROCESSING: "info",
  ROLLED_BACK: "neutral",
  UPLOADED: "neutral",
  VALIDATING: "info",
} as const;

/**
 * Sync status labels shown to users.
 */
export const SYNC_STATUS_LABELS = {
  COMPLETED: "Selesai",
  FAILED: "Gagal",
  PENDING: "Menunggu",
  SYNCING: "Sinkronisasi",
} as const;

/**
 * Sync status tone mapping.
 */
export const SYNC_STATUS_TONES = {
  COMPLETED: "success",
  FAILED: "danger",
  PENDING: "warning",
  SYNCING: "info",
} as const;

/**
 * Queue and job status labels shown to users.
 */
export const JOB_STATUS_LABELS = {
  cancelled: "Dibatalkan",
  completed: "Selesai",
  failed: "Gagal",
  pending: "Menunggu",
  processing: "Diproses",
} as const;

/**
 * Queue and job status tone mapping.
 */
export const JOB_STATUS_TONES = {
  cancelled: "neutral",
  completed: "success",
  failed: "danger",
  pending: "warning",
  processing: "info",
} as const;

/**
 * System health labels shown to users.
 */
export const HEALTH_STATUS_LABELS = {
  degraded: "Menurun",
  down: "Bermasalah",
  healthy: "Sehat",
  unknown: "Tidak Diketahui",
} as const;

/**
 * System health tone mapping.
 */
export const HEALTH_STATUS_TONES = {
  degraded: "warning",
  down: "danger",
  healthy: "success",
  unknown: "neutral",
} as const;

/**
 * Alert severity labels shown to users.
 */
export const ALERT_SEVERITY_LABELS = {
  critical: "Kritis",
  danger: "Gagal",
  info: "Info",
  warning: "Perlu Perhatian",
} as const;

/**
 * Alert severity tone mapping.
 */
export const ALERT_SEVERITY_TONES = {
  critical: "stockCritical",
  danger: "danger",
  info: "info",
  warning: "warning",
} as const;

/**
 * Shared form field class names.
 */
export const FIELD_CLASS_NAMES = {
  control:
    "h-10 w-full min-w-0 rounded-md border border-border-default bg-card-surface px-3 text-text-strong shadow-sm outline-none transition-colors placeholder:text-text-disabled focus:border-primary-blue focus:ring-2 focus:ring-primary-blue/20 disabled:bg-muted-surface disabled:text-text-disabled",
  error: "ts-xs text-danger",
  helper: "ts-xs text-text-muted",
  label: "ts-sm font-medium text-text-strong",
  textarea:
    "min-h-24 w-full min-w-0 rounded-md border border-border-default bg-card-surface px-3 py-2 text-text-strong shadow-sm outline-none transition-colors placeholder:text-text-disabled focus:border-primary-blue focus:ring-2 focus:ring-primary-blue/20 disabled:bg-muted-surface disabled:text-text-disabled",
  wrapper: "grid gap-2",
} as const;

/**
 * Shared select field class names.
 */
export const SELECT_CLASS_NAMES = {
  option:
    "ts-sm flex min-h-10 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-text-default transition-colors hover:bg-muted-surface hover:text-text-strong disabled:pointer-events-none disabled:text-text-disabled",
  optionActive: "bg-muted-surface font-medium text-text-strong",
  panel:
    "z-60 overflow-y-auto rounded-lg border border-border-default bg-elevated-surface p-1 shadow-md",
  placeholder: "text-text-disabled",
  trigger:
    "h-10 w-full min-w-0 rounded-md border border-border-default bg-card-surface px-3 text-left text-text-strong shadow-sm outline-none transition-colors hover:bg-muted-surface focus:border-primary-blue focus:ring-2 focus:ring-primary-blue/20 disabled:bg-muted-surface disabled:text-text-disabled",
  value: "truncate",
} as const;

/**
 * Shared date input class names.
 */
export const DATE_INPUT_CLASS_NAMES = {
  day:
    "ts-sm grid min-h-10 place-items-center rounded-md text-text-default transition-colors hover:bg-muted-surface hover:text-text-strong",
  dayMuted: "text-text-disabled",
  daySelected: "bg-primary-blue text-text-inverse hover:bg-primary-blue hover:text-text-inverse",
  icon:
    "pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted",
  panel:
    "z-60 rounded-lg border border-border-default bg-elevated-surface p-3 shadow-md",
  placeholder: "text-text-disabled",
  trigger:
    "h-10 w-full min-w-0 rounded-md border border-border-default bg-card-surface px-3 pr-10 text-left text-text-strong shadow-sm outline-none transition-colors hover:bg-muted-surface focus:border-primary-blue focus:ring-2 focus:ring-primary-blue/20 disabled:bg-muted-surface disabled:text-text-disabled",
  value: "truncate",
  weekDay: "ts-xs grid min-h-8 place-items-center font-medium text-text-muted",
  wrapper: "relative",
} as const;

/**
 * Date input weekday labels.
 */
export const DATE_INPUT_WEEKDAY_LABELS = [
  "Min",
  "Sen",
  "Sel",
  "Rab",
  "Kam",
  "Jum",
  "Sab",
] as const;

/**
 * Date input accessible copy.
 */
export const DATE_INPUT_COPY = {
  nextMonth: "Bulan berikutnya",
  previousMonth: "Bulan sebelumnya",
} as const;

/**
 * Shared card class names.
 */
export const CARD_CLASS_NAMES = {
  content: "grid gap-4 p-4 sm:p-6",
  denseContent: "grid gap-3 p-4",
  description: "ts-sm text-text-muted",
  footer:
    "flex flex-wrap items-center gap-3 border-t border-border-default px-4 py-4 sm:px-6",
  header: "grid gap-1 border-b border-border-default px-4 py-4 sm:px-6",
  root: "rounded-xl border border-border-default bg-card-surface shadow-sm",
  title: "ts-lg font-semibold text-text-strong",
} as const;

/**
 * Default copy used by reusable empty states.
 */
export const EMPTY_STATE_COPY = {
  actionLabel: "Tambah Data",
  description: "Data belum tersedia untuk ditampilkan.",
  title: "Belum Ada Data",
} as const;

/**
 * Default copy used by reusable error states.
 */
export const ERROR_STATE_COPY = {
  actionLabel: "Coba Lagi",
  description: "Data gagal dimuat. Coba muat ulang halaman.",
  title: "Data Gagal Dimuat",
} as const;

/**
 * Default copy used by pagination controls.
 */
export const PAGINATION_COPY = {
  label: "Paginasi",
  next: "Berikutnya",
  of: "dari",
  previous: "Sebelumnya",
  summary: "Halaman",
} as const;

/**
 * Default copy used by progress indicators.
 */
export const PROGRESS_COPY = {
  complete: "selesai",
  label: "Progres",
} as const;

/**
 * Default copy used by dialog controls.
 */
export const DIALOG_COPY = {
  cancel: "Batal",
  close: "Tutup",
  confirm: "Konfirmasi",
} as const;

/**
 * Default copy used by action menus.
 */
export const ACTION_MENU_COPY = {
  label: "Aksi",
} as const;

/**
 * Default copy used by tab controls.
 */
export const TABS_COPY = {
  label: "Tab",
} as const;

/**
 * Default copy used by queue status cards.
 */
export const QUEUE_STATUS_COPY = {
  waitingSuffix: "job menunggu",
} as const;

/**
 * Import step status labels.
 */
export const STEPPER_STATUS_LABELS = {
  completed: "Selesai",
  current: "Aktif",
  error: "Gagal",
  pending: "Menunggu",
} as const;

/**
 * Sonner toast class names aligned to the dashboard design system.
 */
export const TOAST_CLASS_NAMES = {
  actionButton: "bg-primary-blue text-text-inverse",
  cancelButton: "bg-muted-surface text-text-strong",
  description: "ts-sm text-text-muted",
  toast:
    "rounded-lg border border-border-default bg-card-surface text-text-strong shadow-md",
  title: "ts-sm font-semibold text-text-strong",
} as const;

/**
 * Dashboard navigation section labels.
 */
export const NAVIGATION_SECTION_LABELS = {
  inventory: "Inventory",
  operations: "Operasional",
  overview: "Overview",
  reports: "Laporan",
  system: "Sistem",
} as const;

/**
 * Default copy used by app navigation.
 */
export const NAVIGATION_COPY = {
  main: "Navigasi utama",
} as const;

/**
 * Status tone keys supported by badge components.
 */
export type StatusTone = keyof typeof STATUS_TONE_CLASS_NAMES;

/**
 * Stock status keys supported by stock badges.
 */
export type StockStatus = keyof typeof STOCK_STATUS_LABELS;

/**
 * Transfer status keys supported by transfer badges.
 */
export type TransferStatus = keyof typeof TRANSFER_STATUS_LABELS;

/**
 * Job status keys supported by job badges.
 */
export type JobStatus = keyof typeof JOB_STATUS_LABELS;

/**
 * Health status keys supported by health badges.
 */
export type HealthStatus = keyof typeof HEALTH_STATUS_LABELS;

/**
 * Alert severity keys supported by alert cards.
 */
export type AlertSeverity = keyof typeof ALERT_SEVERITY_LABELS;
