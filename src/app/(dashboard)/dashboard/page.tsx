"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  Database,
  Package,
  Warehouse,
} from "lucide-react";
import { Helmet } from "react-helmet-async";

import {
  AlertCard,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DashboardMetricCard,
  DataTable,
  HealthStatusBadge,
  Skeleton,
  StockStatusBadge,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { APP_META_DESCRIPTION } from "@/constants/app";
import type { ProductStockStatus } from "@/constants/inventory";
import { ROUTES } from "@/constants/routes";
import { eden } from "@/lib/eden";
import {
  formatDateTime,
  formatStockQuantity,
  toStockBadgeStatus,
} from "@/utils/inventoryDisplay";

type StockSummary = {
  inventoryValue: number;
  lowStockCount: number;
  lowStockProducts: Array<{
    currentStock: number;
    minimumStock: number;
    productId: string;
    productName: string;
    productSku: string;
    stockStatus: ProductStockStatus;
    unit: string;
  }>;
  outOfStockCount: number;
  recentMovements: Array<{
    createdAt: Date | string;
    id: string;
    productName: string;
    productSku: string;
    quantity: number;
    type: "IN" | "OUT";
    warehouseName: string;
  }>;
  totalProducts: number;
  totalStock: number;
  totalWarehouses: number;
};

type HealthMetric = {
  checkedAt: Date | string;
  responseTimeMs: number;
  serviceName: string;
  status: "healthy" | "degraded" | "down";
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function useStockSummary() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.stock.summary.get();

      if (response.error) {
        throw response.error;
      }

      return response.data as StockSummary;
    },
    queryKey: ["dashboard", "stock-summary"],
  });
}

function useHealthMetrics() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.monitoring.health.get();

      if (response.error) {
        throw response.error;
      }

      return response.data as HealthMetric[];
    },
    queryKey: ["dashboard", "monitoring-health"],
  });
}

/**
 * Inventory operations dashboard.
 */
export default function DashboardPage() {
  const stockSummary = useStockSummary();
  const healthMetrics = useHealthMetrics();
  const summary = stockSummary.data;
  const metrics = healthMetrics.data ?? [];
  const apiMetric = metrics.find((metric) => metric.serviceName === "api");
  const databaseMetric = metrics.find(
    (metric) => metric.serviceName === "database",
  );

  let alertNode = (
    <AlertCard
      message="Belum ada alert penting dari stok atau monitoring."
      severity="info"
      title="Operasional stabil"
    />
  );

  if (summary && summary.outOfStockCount > 0) {
    alertNode = (
      <AlertCard
        actionHref={ROUTES.PRODUCTS}
        actionLabel="Lihat Produk"
        message={`${summary.outOfStockCount} produk sudah habis dan perlu ditindaklanjuti.`}
        severity="critical"
        title="Stok habis"
      />
    );
  } else if (summary && summary.lowStockCount > 0) {
    alertNode = (
      <AlertCard
        actionHref={ROUTES.PRODUCTS}
        actionLabel="Lihat Produk"
        message={`${summary.lowStockCount} produk berada di bawah batas minimum.`}
        severity="warning"
        title="Stok rendah"
      />
    );
  } else if (apiMetric && apiMetric.responseTimeMs > 1000) {
    alertNode = (
      <AlertCard
        actionHref={ROUTES.MONITORING}
        actionLabel="Buka Monitoring"
        message={`Response time API ${apiMetric.responseTimeMs} ms.`}
        severity="warning"
        title="Response time lambat"
      />
    );
  }

  const lowStockRows =
    summary?.lowStockProducts.map((product) => (
      <TableRow key={product.productId}>
        <TableCell>
          <section className="grid gap-1">
            <span className="font-medium text-text-strong">
              {product.productName}
            </span>
            <span className="ts-mono-xs text-text-muted">
              {product.productSku}
            </span>
          </section>
        </TableCell>
        <TableCell>
          {formatStockQuantity(product.currentStock, product.unit)}
        </TableCell>
        <TableCell>
          {formatStockQuantity(product.minimumStock, product.unit)}
        </TableCell>
        <TableCell>
          <StockStatusBadge
            status={toStockBadgeStatus(product.stockStatus)}
          />
        </TableCell>
      </TableRow>
    )) ?? [];
  let lowStockBody = lowStockRows;

  if (lowStockRows.length === 0) {
    lowStockBody = [
      <TableRow key="empty">
        <TableCell className="text-text-muted" colSpan={4}>
          Tidak ada produk stok rendah.
        </TableCell>
      </TableRow>,
    ];
  }

  const movementRows =
    summary?.recentMovements.map((movement) => (
      <TableRow key={movement.id}>
        <TableCell className="ts-mono-xs">
          {formatDateTime(movement.createdAt)}
        </TableCell>
        <TableCell>
          <section className="grid gap-1">
            <span className="font-medium text-text-strong">
              {movement.productName}
            </span>
            <span className="ts-mono-xs text-text-muted">
              {movement.productSku}
            </span>
          </section>
        </TableCell>
        <TableCell>{movement.warehouseName}</TableCell>
        <TableCell>{movement.type}</TableCell>
        <TableCell>{formatNumber(movement.quantity)}</TableCell>
      </TableRow>
    )) ?? [];
  let movementBody = movementRows;

  if (movementRows.length === 0) {
    movementBody = [
      <TableRow key="empty">
        <TableCell className="text-text-muted" colSpan={5}>
          Belum ada stock movement.
        </TableCell>
      </TableRow>,
    ];
  }

  let dashboardContent = (
    <section className="grid gap-4">
      <Skeleton className="h-24" />
      <Skeleton className="h-48" />
    </section>
  );

  if (!stockSummary.isLoading) {
    dashboardContent = (
      <section className="grid gap-6">
        <section className="ssp-dashboard-grid">
          <DashboardMetricCard
            helperText="Master data aktif dan nonaktif"
            icon={<Package />}
            title="Total Produk"
            value={formatNumber(summary?.totalProducts ?? 0)}
          />
          <DashboardMetricCard
            helperText="Seluruh lokasi operasional"
            icon={<Warehouse />}
            title="Total Gudang"
            value={formatNumber(summary?.totalWarehouses ?? 0)}
          />
          <DashboardMetricCard
            helperText="Akumulasi batch tersedia"
            icon={<Boxes />}
            title="Total Stok"
            value={formatNumber(summary?.totalStock ?? 0)}
          />
          <DashboardMetricCard
            helperText="Berdasarkan unit cost batch"
            icon={<Database />}
            title="Nilai Inventaris"
            value={formatRupiah(summary?.inventoryValue ?? 0)}
          />
        </section>
        {alertNode}
        <section className="ssp-detail-layout">
          <Card>
            <CardHeader>
              <CardTitle>Produk Perlu Perhatian</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable dense>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead>Stok</TableHead>
                    <TableHead>Minimum</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{lowStockBody}</TableBody>
              </DataTable>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Stock Movement Terbaru</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable dense>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Produk</TableHead>
                    <TableHead>Gudang</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{movementBody}</TableBody>
              </DataTable>
            </CardContent>
          </Card>
        </section>
        <section className="ssp-monitoring-health-grid">
          <Card>
            <CardContent>
              <section className="flex items-center justify-between gap-3">
                <section className="grid gap-1">
                  <p className="ts-sm font-medium text-text-strong">API</p>
                  <p className="ts-xs text-text-muted">
                    {apiMetric ? `${apiMetric.responseTimeMs} ms` : "Belum dicek"}
                  </p>
                </section>
                <HealthStatusBadge status={apiMetric?.status ?? "unknown"} />
              </section>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <section className="flex items-center justify-between gap-3">
                <section className="grid gap-1">
                  <p className="ts-sm font-medium text-text-strong">Database</p>
                  <p className="ts-xs text-text-muted">
                    {databaseMetric
                      ? `${databaseMetric.responseTimeMs} ms`
                      : "Belum dicek"}
                  </p>
                </section>
                <HealthStatusBadge
                  status={databaseMetric?.status ?? "unknown"}
                />
              </section>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <section className="flex items-center gap-3">
                <AlertTriangle className="size-5 text-warning" />
                <p className="ts-sm text-text-muted">
                  Alert dashboard hanya menampilkan kondisi penting.
                </p>
              </section>
            </CardContent>
          </Card>
        </section>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Dashboard | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="grid gap-2">
        <h1 className="ts-3xl text-text-strong">Dashboard</h1>
        <p className="ts-sm text-text-muted">
          Ringkasan stok, alert penting, movement terbaru, dan status sistem.
        </p>
      </header>
      {dashboardContent}
    </section>
  );
}
