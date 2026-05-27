"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Download,
  Package,
  RefreshCw,
  Server,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  AlertCard,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  DateInput,
  EmptyState,
  ErrorState,
  HealthStatusBadge,
  SelectInput,
  Skeleton,
  StatusBadge,
  StockStatusBadge,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TransferStatusBadge,
} from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { APP_META_DESCRIPTION } from "@/constants/app";
import {
  DASHBOARD_DEFAULT_RANGE_DAYS,
  DASHBOARD_EXPORT_FILE_PREFIX,
} from "@/constants/dashboard";
import { CHART_COLORS } from "@/constants/design";
import type {
  HealthCheckStatus,
  ProductStockStatus,
  StockMovementType,
  TransferStatus,
} from "@/constants/inventory";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/useAuth";
import { eden } from "@/lib/eden";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatRp } from "@/utils/formatRp";
import {
  formatDateTime,
  formatStockQuantity,
  toStockBadgeStatus,
} from "@/utils/inventoryDisplay";
import { hasPermission } from "@/utils/permissions";

type DashboardFilters = {
  dateRange: {
    from: string;
    to: string;
  };
  warehouseId: string;
};

type DashboardSummary = {
  apiStatus: HealthCheckStatus | "unknown";
  criticalErrors: number;
  criticalStockCount: number;
  inventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingTransfers: number;
  responseTimeMs: number | null;
  runningJobs: number;
  totalProducts: number;
  totalStock: number;
  totalWarehouses: number;
};

type TrendRow = Record<StockMovementType | "date", number | string>;

type WarehouseStockRow = {
  city: string;
  criticalStockCount: number;
  inventoryValue: number;
  lowStockCount: number;
  totalProducts: number;
  totalStock: number;
  warehouseCode: string;
  warehouseId: string;
  warehouseName: string;
};

type LowStockRow = {
  categoryName: string;
  currentStock: number;
  minimumStock: number;
  productId: string;
  productName: string;
  productSku: string;
  stockStatus: ProductStockStatus;
  unit: string;
  warehouseId: string;
  warehouseName: string;
};

type MovementRow = {
  createdAt: Date | string;
  createdBy: string | null;
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  type: StockMovementType;
  unit: string;
  warehouseName: string;
};

type TransferRow = {
  createdAt: Date | string;
  destinationWarehouseName: string;
  id: string;
  sourceWarehouseName: string;
  status: TransferStatus;
  transferNumber: string;
};

type DashboardAlert = {
  actionHref: string;
  createdAt: Date | string;
  id: string;
  message: string;
  severity: "critical" | "info" | "warning";
  title: string;
  type: string;
};

type HealthMetric = {
  checkedAt: Date | string;
  responseTimeMs: number;
  serviceName: string;
  status: HealthCheckStatus;
};

type WarehouseOption = {
  id: string;
  name: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatResponseTime(value: number | null) {
  if (value === null) return "Belum dicek";
  if (value >= 1000) return `${(value / 1000).toLocaleString("id-ID")} s`;

  return `${formatNumber(value)} ms`;
}

function getDashboardQuery(filters: DashboardFilters) {
  return {
    dateFrom: filters.dateRange.from,
    dateTo: filters.dateRange.to,
    limit: "8",
    warehouseId: filters.warehouseId,
  };
}

function getDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultDashboardDateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - DASHBOARD_DEFAULT_RANGE_DAYS + 1);

  return {
    from: getDateInputValue(from),
    to: getDateInputValue(to),
  };
}

function getMovementTone(type: StockMovementType) {
  if (type === "IN" || type === "TRANSFER_IN" || type === "IMPORT") {
    return "success";
  }

  if (type === "OUT" || type === "TRANSFER_OUT") {
    return "warning";
  }

  return "neutral";
}

function getTransferBadgeStatus(status: TransferStatus) {
  if (status === "COMPLETED") return "completed";
  if (status === "CANCELLED") return "cancelled";
  if (status === "FAILED") return "failed";

  return "pending";
}

function useWarehouseOptions() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.warehouses.get({
        query: { isActive: "true", limit: "100", page: "1", sortBy: "name" },
      });

      if (response.error) throw response.error;

      return response.data.data as WarehouseOption[];
    },
    queryKey: ["dashboard", "warehouses"],
    staleTime: 120_000,
  });
}

function DashboardFilterBar({
  canExport,
  filters,
  isExporting,
  isRefreshing,
  onApply,
  onExport,
  onRefresh,
  warehouses,
}: {
  canExport: boolean;
  filters: DashboardFilters;
  isExporting: boolean;
  isRefreshing: boolean;
  onApply: (filters: DashboardFilters) => void;
  onExport: () => void;
  onRefresh: () => void;
  warehouses: WarehouseOption[];
}) {
  const form = useForm({
    defaultValues: filters,
    onSubmit: ({ value }) => onApply(value),
  });
  const warehouseOptions = [
    { label: "Semua Gudang", value: "" },
    ...warehouses.map((warehouse) => ({
      label: warehouse.name,
      value: warehouse.id,
    })),
  ];
  let exportButton = null;

  if (canExport) {
    exportButton = (
      <Button
        disabled={isExporting}
        leftIcon={<Download />}
        onClick={onExport}
        type="button"
        variant="secondary"
      >
        {isExporting ? "Menyiapkan..." : "Export PDF"}
      </Button>
    );
  }

  return (
    <form
      className="ssp-filter-bar lg:grid-cols-[260px_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="warehouseId">
        {(field) => (
          <SelectInput
            id="dashboard-warehouse"
            label="Gudang"
            onBlur={field.handleBlur}
            onValueChange={field.handleChange}
            options={warehouseOptions}
            searchable
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="dateRange">
        {(field) => (
          <DateInput
            id="dashboard-date-range"
            label="Rentang Tanggal"
            mode="range"
            onBlur={field.handleBlur}
            onValueChange={field.handleChange}
            value={field.state.value}
          />
        )}
      </form.Field>
      <section className="flex flex-wrap items-end gap-2">
        <Button leftIcon={<BarChart3 />} type="submit">
          Terapkan
        </Button>
        <Button
          disabled={isRefreshing}
          leftIcon={<RefreshCw />}
          onClick={onRefresh}
          type="button"
          variant="secondary"
        >
          Refresh
        </Button>
        {exportButton}
      </section>
    </form>
  );
}

function ChartEmptyState({ title }: { title: string }) {
  return (
    <section className="grid min-h-64 place-items-center rounded-lg border border-border-default bg-muted-surface p-6 text-center">
      <EmptyState
        description="Belum ada data pada filter ini."
        title={title}
      />
    </section>
  );
}

/**
 * Inventory operations dashboard.
 */
export default function DashboardPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const user = auth.data?.user;
  const canReadSummary = user ? hasPermission(user.role, "dashboard.read_summary") : false;
  const canReadCharts = user ? hasPermission(user.role, "dashboard.read_stock_chart") : false;
  const canReadInventoryValue = user
    ? hasPermission(user.role, "dashboard.read_inventory_value")
    : false;
  const canReadAlerts = user ? hasPermission(user.role, "dashboard.read_alerts") : false;
  const canReadTransfers = user ? hasPermission(user.role, "transfer.read") : false;
  const canReadMonitoring = user ? hasPermission(user.role, "monitoring.read") : false;
  const canExport = user
    ? hasPermission(user.role, "dashboard.export_pdf") ||
      hasPermission(user.role, "report.export_pdf")
    : false;
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: getDefaultDashboardDateRange(),
    warehouseId: "",
  });
  const dashboardQuery = getDashboardQuery(filters);
  const warehousesQuery = useWarehouseOptions();
  const summaryQuery = useQuery({
    enabled: canReadSummary,
    queryFn: async () => {
      const response = await eden.api.v1.dashboard.summary.get({
        query: dashboardQuery,
      });

      if (response.error) throw response.error;

      return response.data as DashboardSummary;
    },
    queryKey: ["dashboard", "summary", filters],
    refetchInterval: 60_000,
  });
  const trendQuery = useQuery({
    enabled: canReadCharts,
    queryFn: async () => {
      const response = await eden.api.v1.dashboard["stock-trend"].get({
        query: dashboardQuery,
      });

      if (response.error) throw response.error;

      return response.data as TrendRow[];
    },
    queryKey: ["dashboard", "stock-trend", filters],
  });
  const inventoryValueQuery = useQuery({
    enabled: canReadInventoryValue,
    queryFn: async () => {
      const response = await eden.api.v1.dashboard["inventory-value"].get({
        query: dashboardQuery,
      });

      if (response.error) throw response.error;

      return response.data as Array<{
        city: string;
        inventoryValue: number;
        totalStock: number;
        warehouseId: string;
        warehouseName: string;
      }>;
    },
    queryKey: ["dashboard", "inventory-value", filters],
  });
  const stockByWarehouseQuery = useQuery({
    enabled: canReadCharts,
    queryFn: async () => {
      const response = await eden.api.v1.dashboard["stock-by-warehouse"].get({
        query: dashboardQuery,
      });

      if (response.error) throw response.error;

      return response.data as WarehouseStockRow[];
    },
    queryKey: ["dashboard", "stock-by-warehouse", filters],
  });
  const lowStockQuery = useQuery({
    enabled: canReadAlerts,
    queryFn: async () => {
      const response = await eden.api.v1.dashboard["low-stock"].get({
        query: dashboardQuery,
      });

      if (response.error) throw response.error;

      return response.data as LowStockRow[];
    },
    queryKey: ["dashboard", "low-stock", filters],
  });
  const movementsQuery = useQuery({
    enabled: canReadSummary,
    queryFn: async () => {
      const response = await eden.api.v1.dashboard["recent-movements"].get({
        query: dashboardQuery,
      });

      if (response.error) throw response.error;

      return response.data as MovementRow[];
    },
    queryKey: ["dashboard", "recent-movements", filters],
  });
  const transfersQuery = useQuery({
    enabled: canReadTransfers,
    queryFn: async () => {
      const response = await eden.api.v1.dashboard["recent-transfers"].get({
        query: dashboardQuery,
      });

      if (response.error) throw response.error;

      return response.data as TransferRow[];
    },
    queryKey: ["dashboard", "recent-transfers", filters],
  });
  const alertsQuery = useQuery({
    enabled: canReadAlerts,
    queryFn: async () => {
      const response = await eden.api.v1.dashboard.alerts.get({
        query: dashboardQuery,
      });

      if (response.error) throw response.error;

      return response.data as DashboardAlert[];
    },
    queryKey: ["dashboard", "alerts", filters],
    refetchInterval: 60_000,
  });
  const healthQuery = useQuery({
    enabled: canReadMonitoring,
    queryFn: async () => {
      const response = await eden.api.v1.monitoring.health.get();

      if (response.error) throw response.error;

      return response.data as HealthMetric[];
    },
    queryKey: ["dashboard", "health"],
    refetchInterval: 30_000,
  });
  const exportPdf = useMutation({
    mutationFn: async () => {
      const result = await eden.api.v1.dashboard["export-pdf"].post({
        categoryId: null,
        dateFrom: filters.dateRange.from || null,
        dateTo: filters.dateRange.to || null,
        includeCharts: true,
        includeLowStock: true,
        includeMovements: true,
        reportType: "DASHBOARD_SUMMARY",
        warehouseId: filters.warehouseId || null,
      });

      if (result.error) throw result.error;

      return result.data as { data: string; fileName: string };
    },
    onSuccess: ({ data, fileName }) => {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Laporan PDF berhasil disiapkan.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Export PDF gagal."));
    },
  });
  const summary = summaryQuery.data;
  const trendRows = trendQuery.data ?? [];
  const warehouseRows = stockByWarehouseQuery.data ?? [];
  const inventoryRows = inventoryValueQuery.data ?? [];
  const lowStockRows = lowStockQuery.data ?? [];
  const movementRows = movementsQuery.data ?? [];
  const transferRows = transfersQuery.data ?? [];
  const alertRows = alertsQuery.data ?? [];
  const healthRows = healthQuery.data ?? [];
  const apiHealth = healthRows.find((metric) => metric.serviceName === "api");
  const databaseHealth = healthRows.find(
    (metric) => metric.serviceName === "database",
  );
  const isRefreshing =
    summaryQuery.isFetching ||
    trendQuery.isFetching ||
    stockByWarehouseQuery.isFetching ||
    lowStockQuery.isFetching ||
    movementsQuery.isFetching;

  const refreshDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const metricContent = summaryQuery.isLoading ? (
    <section className="ssp-dashboard-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton className="h-28" key={index} />
      ))}
    </section>
  ) : null;
  let metricCards = metricContent;

  if (summaryQuery.isError) {
    metricCards = (
      <ErrorState
        description={getErrorMessage(summaryQuery.error, "Ringkasan dashboard gagal dimuat.")}
        onRetry={() => summaryQuery.refetch()}
      />
    );
  }

  if (!summaryQuery.isLoading && !summaryQuery.isError) {
    metricCards = (
      <section className="ssp-dashboard-grid">
        <Card className="p-4 sm:p-5">
          <header className="flex items-start justify-between gap-4">
            <section className="grid gap-2">
              <p className="ts-sm font-medium text-text-muted">Total Produk</p>
              <strong className="ts-2xl text-text-strong">
                {formatNumber(summary?.totalProducts ?? 0)}
              </strong>
            </section>
            <Package className="size-5 text-primary-blue" />
          </header>
          <p className="ts-xs text-text-muted">Produk aktif dalam master data.</p>
        </Card>
        <Card className="p-4 sm:p-5">
          <header className="flex items-start justify-between gap-4">
            <section className="grid gap-2">
              <p className="ts-sm font-medium text-text-muted">Total Gudang</p>
              <strong className="ts-2xl text-text-strong">
                {formatNumber(summary?.totalWarehouses ?? 0)}
              </strong>
            </section>
            <Warehouse className="size-5 text-primary-blue" />
          </header>
          <p className="ts-xs text-text-muted">Lokasi aktif yang dipantau.</p>
        </Card>
        <Card className="p-4 sm:p-5">
          <header className="flex items-start justify-between gap-4">
            <section className="grid gap-2">
              <p className="ts-sm font-medium text-text-muted">Total Stok</p>
              <strong className="ts-2xl text-text-strong">
                {formatNumber(summary?.totalStock ?? 0)}
              </strong>
            </section>
            <Boxes className="size-5 text-primary-blue" />
          </header>
          <p className="ts-xs text-text-muted">Akumulasi batch tersedia.</p>
        </Card>
        <Card className="p-4 sm:p-5">
          <header className="flex items-start justify-between gap-4">
            <section className="grid gap-2">
              <p className="ts-sm font-medium text-text-muted">Nilai Inventaris</p>
              <strong className="ts-2xl text-text-strong">
                {formatRp(summary?.inventoryValue ?? 0)}
              </strong>
            </section>
            <TrendingUp className="size-5 text-success" />
          </header>
          <p className="ts-xs text-text-muted">Berdasarkan unit cost batch.</p>
        </Card>
        <Card className="p-4 sm:p-5">
          <header className="flex items-start justify-between gap-4">
            <section className="grid gap-2">
              <p className="ts-sm font-medium text-text-muted">Stok Rendah</p>
              <strong className="ts-2xl text-warning">
                {formatNumber(summary?.lowStockCount ?? 0)}
              </strong>
            </section>
            <AlertTriangle className="size-5 text-warning" />
          </header>
          <p className="ts-xs text-text-muted">
            Termasuk {formatNumber(summary?.outOfStockCount ?? 0)} stok habis.
          </p>
        </Card>
        <Card className="p-4 sm:p-5">
          <header className="flex items-start justify-between gap-4">
            <section className="grid gap-2">
              <p className="ts-sm font-medium text-text-muted">Transfer Pending</p>
              <strong className="ts-2xl text-text-strong">
                {formatNumber(summary?.pendingTransfers ?? 0)}
              </strong>
            </section>
            <Server className="size-5 text-operational-cyan" />
          </header>
          <p className="ts-xs text-text-muted">
            API {formatResponseTime(summary?.responseTimeMs ?? null)}.
          </p>
        </Card>
      </section>
    );
  }

  const alertContent =
    alertRows.length > 0 ? (
      <section className="grid gap-3 lg:grid-cols-2">
        {alertRows.map((alert) => (
          <AlertCard
            actionHref={alert.actionHref}
            actionLabel="Lihat Detail"
            key={alert.id}
            message={alert.message}
            severity={alert.severity}
            title={alert.title}
          />
        ))}
      </section>
    ) : (
      <AlertCard
        message="Tidak ada alert critical pada filter ini."
        severity="info"
        title="Operasional stabil"
      />
    );
  const lowStockBody =
    lowStockRows.length > 0 ? (
      lowStockRows.map((product) => (
        <TableRow key={`${product.productId}-${product.warehouseId}`}>
          <TableCell>
            <section className="grid gap-1">
              <Link
                className="font-medium text-text-strong hover:text-primary-blue"
                href={ROUTES.PRODUCTS.DETAIL(product.productId)}
              >
                {product.productName}
              </Link>
              <span className="ts-mono-xs text-text-muted">{product.productSku}</span>
            </section>
          </TableCell>
          <TableCell>{product.warehouseName}</TableCell>
          <TableCell>{formatStockQuantity(product.currentStock, product.unit)}</TableCell>
          <TableCell>{formatStockQuantity(product.minimumStock, product.unit)}</TableCell>
          <TableCell>
            <StockStatusBadge status={toStockBadgeStatus(product.stockStatus)} />
          </TableCell>
          <TableCell>
            <Link
              className="ts-sm text-primary-blue hover:underline"
              href={ROUTES.PRODUCTS.DETAIL(product.productId)}
            >
              Detail
            </Link>
          </TableCell>
        </TableRow>
      ))
    ) : (
      <TableRow>
        <TableCell className="text-text-muted" colSpan={6}>
          Tidak ada produk stok rendah pada filter ini.
        </TableCell>
      </TableRow>
    );
  const movementBody =
    movementRows.length > 0 ? (
      movementRows.map((movement) => (
        <TableRow key={movement.id}>
          <TableCell className="ts-mono-xs">{formatDateTime(movement.createdAt)}</TableCell>
          <TableCell>
            <section className="grid gap-1">
              <span className="font-medium text-text-strong">{movement.productName}</span>
              <span className="ts-mono-xs text-text-muted">{movement.productSku}</span>
            </section>
          </TableCell>
          <TableCell>{movement.warehouseName}</TableCell>
          <TableCell>
            <StatusBadge label={movement.type} tone={getMovementTone(movement.type)} />
          </TableCell>
          <TableCell>{formatStockQuantity(movement.quantity, movement.unit)}</TableCell>
          <TableCell>{movement.createdBy ?? "-"}</TableCell>
        </TableRow>
      ))
    ) : (
      <TableRow>
        <TableCell className="text-text-muted" colSpan={6}>
          Belum ada pergerakan stok pada rentang tanggal ini.
        </TableCell>
      </TableRow>
    );
  const transferBody =
    transferRows.length > 0 ? (
      transferRows.map((transfer) => (
        <TableRow key={transfer.id}>
          <TableCell className="ts-mono-xs">{transfer.transferNumber}</TableCell>
          <TableCell>{transfer.sourceWarehouseName}</TableCell>
          <TableCell>{transfer.destinationWarehouseName}</TableCell>
          <TableCell>
            <TransferStatusBadge status={getTransferBadgeStatus(transfer.status)} />
          </TableCell>
          <TableCell className="ts-mono-xs">{formatDateTime(transfer.createdAt)}</TableCell>
        </TableRow>
      ))
    ) : (
      <TableRow>
        <TableCell className="text-text-muted" colSpan={5}>
          Belum ada transfer pada rentang tanggal ini.
        </TableCell>
      </TableRow>
    );
  const healthContent =
    canReadMonitoring && healthRows.length > 0 ? (
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {healthRows.map((metric) => (
          <article
            className="rounded-lg border border-border-default bg-card-surface p-4"
            key={`${metric.serviceName}-${metric.checkedAt}`}
          >
            <header className="flex items-start justify-between gap-3">
              <section className="grid gap-1">
                <p className="ts-sm font-semibold text-text-strong">{metric.serviceName}</p>
                <p className="ts-xs text-text-muted">{formatDateTime(metric.checkedAt)}</p>
              </section>
              <HealthStatusBadge status={metric.status} />
            </header>
            <strong className="ts-lg mt-3 block text-text-strong">
              {formatResponseTime(metric.responseTimeMs)}
            </strong>
          </article>
        ))}
      </section>
    ) : null;

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Dashboard | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <section className="grid gap-2">
          <h1 className="ts-3xl text-text-strong">Dashboard</h1>
          <p className="ts-sm text-text-muted">
            Pantau stok, gudang, alert, dan performa sistem secara real-time.
          </p>
        </section>
      </header>
      <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            {healthContent}
            <section className="grid gap-3 md:grid-cols-2">
              <article className="rounded-lg border border-border-default bg-card-surface p-4">
                <p className="ts-sm text-text-muted">API</p>
                <HealthStatusBadge status={apiHealth?.status ?? summary?.apiStatus ?? "unknown"} />
                <strong className="ts-lg mt-2 block text-text-strong">
                  {formatResponseTime(apiHealth?.responseTimeMs ?? summary?.responseTimeMs ?? null)}
                </strong>
              </article>
              <article className="rounded-lg border border-border-default bg-card-surface p-4">
                <p className="ts-sm text-text-muted">Database</p>
                <HealthStatusBadge status={databaseHealth?.status ?? "unknown"} />
                <strong className="ts-lg mt-2 block text-text-strong">
                  {formatResponseTime(databaseHealth?.responseTimeMs ?? null)}
                </strong>
              </article>
            </section>
          </CardContent>
        </Card>
      <DashboardFilterBar
        canExport={canExport}
        filters={filters}
        isExporting={exportPdf.isPending}
        isRefreshing={isRefreshing}
        onApply={setFilters}
        onExport={() => exportPdf.mutate()}
        onRefresh={refreshDashboard}
        warehouses={warehousesQuery.data ?? []}
      />
      {metricCards}
      <section className="grid gap-3">
        <section className="flex items-center justify-between gap-3">
          <h2 className="ts-xl font-semibold text-text-strong">Alert Penting</h2>
          <Link className="ts-sm text-primary-blue hover:underline" href={ROUTES.NOTIFICATIONS}>
            Lihat Notifikasi
          </Link>
        </section>
        {alertContent}
      </section>
      <section className="ssp-monitoring-chart-grid">
        <Card>
          <CardHeader>
            <CardTitle>Tren Barang Masuk dan Keluar</CardTitle>
          </CardHeader>
          <CardContent>
            {trendRows.length > 0 ? (
              <section className="h-72">
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={trendRows}>
                    <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line dataKey="IN" name="IN" stroke={CHART_COLORS.inbound} strokeWidth={2} type="monotone" />
                    <Line dataKey="OUT" name="OUT" stroke={CHART_COLORS.outbound} strokeWidth={2} type="monotone" />
                    <Line dataKey="TRANSFER_IN" name="TRANSFER IN" stroke={CHART_COLORS.transferIn} strokeWidth={2} type="monotone" />
                    <Line dataKey="TRANSFER_OUT" name="TRANSFER OUT" stroke={CHART_COLORS.transferOut} strokeWidth={2} type="monotone" />
                  </LineChart>
                </ResponsiveContainer>
              </section>
            ) : (
              <ChartEmptyState title="Chart Kosong" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Nilai Inventaris per Gudang</CardTitle>
          </CardHeader>
          <CardContent>
            {inventoryRows.length > 0 ? (
              <section className="h-72">
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart data={inventoryRows}>
                    <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="warehouseName" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatRp(Number(value))} />
                    <Bar dataKey="inventoryValue" fill={CHART_COLORS.primary} name="Nilai Inventaris" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </section>
            ) : (
              <ChartEmptyState title="Nilai Inventaris Kosong" />
            )}
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Distribusi Stok per Gudang</CardTitle>
        </CardHeader>
        <CardContent>
          {warehouseRows.length > 0 ? (
            <section className="h-72">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={warehouseRows}>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="warehouseName" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalStock" fill={CHART_COLORS.transferIn} name="Total Stok" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lowStockCount" fill={CHART_COLORS.warning} name="Stok Rendah" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          ) : (
            <ChartEmptyState title="Data Gudang Kosong" />
          )}
        </CardContent>
      </Card>
      <section className="ssp-detail-layout">
        <Card>
          <CardHeader>
            <CardTitle>Produk Stok Rendah</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead>Gudang</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead>Minimum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{lowStockBody}</TableBody>
            </DataTable>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pergerakan Stok Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead>Gudang</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{movementBody}</TableBody>
            </DataTable>
          </CardContent>
        </Card>
      </section>
      <section className="ssp-monitoring-chart-grid">
        <Card>
          <CardHeader>
            <CardTitle>Transfer Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor</TableHead>
                  <TableHead>Asal</TableHead>
                  <TableHead>Tujuan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{transferBody}</TableBody>
            </DataTable>
          </CardContent>
        </Card>
        
      </section>
    </section>
  );
}
