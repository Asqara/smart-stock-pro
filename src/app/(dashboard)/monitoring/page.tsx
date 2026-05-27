"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Cpu, HardDrive, RefreshCw, Server } from "lucide-react";
import { Helmet } from "react-helmet-async";
import {
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
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  ErrorState,
  HealthStatusBadge,
  MonitoringHealthCard,
  QueueStatusCard,
  StatusBadge,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { CHART_COLORS, JOB_STATUS_LABELS, JOB_STATUS_TONES } from "@/constants/design";
import type { StatusTone } from "@/constants/design";
import type { HealthCheckStatus } from "@/constants/inventory";
import { useAuth } from "@/hooks/useAuth";
import { eden } from "@/lib/eden";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatDateTime } from "@/utils/inventoryDisplay";
import { hasPermission } from "@/utils/permissions";

type HealthMetric = {
  checkedAt: Date | string;
  cpuUsage: number | null;
  id: string;
  memoryUsage: number | null;
  metadata: Record<string, unknown> | null;
  responseTimeMs: number;
  serviceName: string;
  status: HealthCheckStatus;
  uptimeSeconds: number | null;
};

type ResourceMetric = {
  appMemoryUsage: number;
  appRssBytes: number;
  averageResponseTimeMs: number | null;
  checkedAt: Date | string;
  cpuLabel: string;
  cpuSource: "process" | "system";
  cpuUsage: number;
  heapTotalBytes: number;
  heapUsedBytes: number;
  memoryUsage: number;
  p95ResponseTimeMs: number | null;
  responseTimeMs: number | null;
  slowestEndpoint: ResponseTimeLog | null;
  systemMemoryTotalBytes: number;
  systemMemoryUsage: number;
  systemMemoryUsedBytes: number;
  uptimeSeconds: number;
};

type ResponseTimeLog = {
  createdAt: Date | string;
  durationMs: number;
  id: string;
  method: string;
  path: string;
  statusCode: number;
};

type ResponseTimeMetric = {
  averageResponseTimeMs: number | null;
  latest: ResponseTimeLog | null;
  p95ResponseTimeMs: number | null;
  recent: ResponseTimeLog[];
  slowest: ResponseTimeLog | null;
};

type QueueMetric = {
  active: number;
  completed: number;
  delayed: number;
  failed: number;
  progressValue: number;
  queueName: string;
  status: "cancelled" | "completed" | "failed" | "pending" | "processing";
  waiting: number;
};

type ErrorLogRecord = {
  createdAt: Date | string;
  id: string;
  message: string;
  module: string;
  severity: "critical" | "info" | "warning";
};

type JobRecord = {
  createdAt: Date | string;
  errorMessage: string | null;
  id: string;
  progress: number;
  status: string;
  type: string;
};

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "Tidak tersedia";

  return `${Math.round(value)}%`;
}

function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined) return "Tidak tersedia";
  if (value >= 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024 / 1024).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} GB`;
  }

  return `${(value / 1024 / 1024).toLocaleString("id-ID", {
    maximumFractionDigits: 1,
  })} MB`;
}

function formatResponseTime(value: number | null | undefined) {
  if (value === null || value === undefined) return "Belum ada data";
  if (value >= 1000) return `${(value / 1000).toLocaleString("id-ID")} s`;

  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ms`;
}

function formatUptime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours} jam ${minutes} menit`;
  }

  return `${minutes} menit`;
}

function useHealth() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.monitoring.health.get();

      if (response.error) throw response.error;

      return response.data as HealthMetric[];
    },
    queryKey: ["monitoring", "health"],
    refetchInterval: 10_000,
  });
}

function useResources() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.monitoring.resources.get();

      if (response.error) throw response.error;

      return response.data as ResourceMetric;
    },
    queryKey: ["monitoring", "resources"],
    refetchInterval: 10_000,
  });
}

function useMetrics() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.monitoring.metrics.get();

      if (response.error) throw response.error;

      return response.data as HealthMetric[];
    },
    queryKey: ["monitoring", "metrics"],
    refetchInterval: 10_000,
  });
}

function useResponseTime() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.monitoring["response-time"].get();

      if (response.error) throw response.error;

      return response.data as ResponseTimeMetric;
    },
    queryKey: ["monitoring", "response-time"],
    refetchInterval: 10_000,
  });
}

function useQueues() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.monitoring.queues.get();

      if (response.error) throw response.error;

      return response.data as QueueMetric[];
    },
    queryKey: ["monitoring", "queues"],
    refetchInterval: 10_000,
  });
}

function useRecentErrors(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async () => {
      const response = await eden.api["error-logs"].get({
        query: {
          limit: "5",
          page: "1",
          resolved: "false",
          sortBy: "createdAt",
          sortDir: "desc",
        },
      });

      if (response.error) throw response.error;

      return response.data.data as ErrorLogRecord[];
    },
    queryKey: ["monitoring", "recent-errors"],
    refetchInterval: 10_000,
  });
}

function useFailedJobs(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async () => {
      const response = await eden.api.v1.jobs.get({
        query: {
          limit: "5",
          page: "1",
          status: "FAILED",
        },
      });

      if (response.error) throw response.error;

      return response.data.data as JobRecord[];
    },
    queryKey: ["monitoring", "failed-jobs"],
    refetchInterval: 10_000,
  });
}

/**
 * System monitoring page.
 */
export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const user = auth.data?.user;
  const canReadErrors = user ? hasPermission(user.role, "error_log.read") : false;
  const canReadJobs = user ? hasPermission(user.role, "job.read") : false;
  const healthQuery = useHealth();
  const resourcesQuery = useResources();
  const metricsQuery = useMetrics();
  const responseTimeQuery = useResponseTime();
  const queuesQuery = useQueues();
  const errorsQuery = useRecentErrors(canReadErrors);
  const jobsQuery = useFailedJobs(canReadJobs);
  const runCheck = useMutation({
    mutationFn: async () => {
      const response = await eden.api.v1.monitoring.check.post({
        serviceName: "manual",
      });

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring"] });
      toast.success("Monitoring check selesai.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Monitoring check gagal."));
    },
  });
  const health = healthQuery.data ?? [];
  const resources = resourcesQuery.data;
  const metrics = metricsQuery.data ?? [];
  const responseTime = [...(responseTimeQuery.data?.recent ?? [])].reverse();
  const queues = queuesQuery.data ?? [];
  const errors = errorsQuery.data ?? [];
  const failedJobs = jobsQuery.data ?? [];
  const healthCards = health.map((metric) => (
    <MonitoringHealthCard
      description="Health check terakhir tersimpan."
      key={metric.id}
      lastChecked={formatDateTime(metric.checkedAt)}
      metric={formatResponseTime(metric.responseTimeMs)}
      serviceName={metric.serviceName}
      status={metric.status}
    />
  ));
  const resourceCards = resources ? (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="p-4">
        <header className="flex items-start justify-between gap-3">
          <p className="ts-sm font-semibold text-text-strong">{resources.cpuLabel}</p>
          <Cpu className="size-5 text-operational-cyan" />
        </header>
        <strong className="ts-2xl mt-3 block text-text-strong">
          {formatPercent(resources.cpuUsage)}
        </strong>
        <p className="ts-xs text-text-muted">
          {resources.cpuSource === "system"
            ? "Delta /proc/stat host atau container."
            : "Fallback process.cpuUsage()."}
        </p>
      </Card>
      <Card className="p-4">
        <header className="flex items-start justify-between gap-3">
          <p className="ts-sm font-semibold text-text-strong">System Memory</p>
          <HardDrive className="size-5 text-operational-cyan" />
        </header>
        <strong className="ts-2xl mt-3 block text-text-strong">
          {formatPercent(resources.systemMemoryUsage)}
        </strong>
        <p className="ts-xs text-text-muted">
          {formatBytes(resources.systemMemoryUsedBytes)} dari {formatBytes(resources.systemMemoryTotalBytes)}
        </p>
      </Card>
      <Card className="p-4">
        <header className="flex items-start justify-between gap-3">
          <p className="ts-sm font-semibold text-text-strong">App RSS</p>
          <HardDrive className="size-5 text-operational-cyan" />
        </header>
        <strong className="ts-2xl mt-3 block text-text-strong">
          {formatBytes(resources.appRssBytes)}
        </strong>
        <p className="ts-xs text-text-muted">Resident set size proses aplikasi.</p>
      </Card>
      <Card className="p-4">
        <header className="flex items-start justify-between gap-3">
          <p className="ts-sm font-semibold text-text-strong">Heap Used</p>
          <HardDrive className="size-5 text-operational-cyan" />
        </header>
        <strong className="ts-2xl mt-3 block text-text-strong">
          {formatBytes(resources.heapUsedBytes)}
        </strong>
        <p className="ts-xs text-text-muted">Dari heap total {formatBytes(resources.heapTotalBytes)}.</p>
      </Card>
      <Card className="p-4">
        <header className="flex items-start justify-between gap-3">
          <p className="ts-sm font-semibold text-text-strong">Latest Response</p>
          <Activity className="size-5 text-operational-cyan" />
        </header>
        <strong className="ts-2xl mt-3 block text-text-strong">
          {formatResponseTime(resources.responseTimeMs)}
        </strong>
        <p className="ts-xs text-text-muted">
          Rata-rata {formatResponseTime(resources.averageResponseTimeMs)}, p95 {formatResponseTime(resources.p95ResponseTimeMs)}.
        </p>
      </Card>
      <Card className="p-4">
        <header className="flex items-start justify-between gap-3">
          <p className="ts-sm font-semibold text-text-strong">Uptime</p>
          <Server className="size-5 text-operational-cyan" />
        </header>
        <strong className="ts-2xl mt-3 block text-text-strong">
          {formatUptime(resources.uptimeSeconds)}
        </strong>
        <p className="ts-xs text-text-muted">Sejak proses server berjalan.</p>
      </Card>
    </section>
  ) : null;
  const queueCards = queues.map((queue) => (
    <QueueStatusCard
      key={queue.queueName}
      progressLabel={`${queue.completed} selesai, ${queue.failed} gagal`}
      progressValue={queue.progressValue}
      queueName={queue.queueName}
      status={queue.status}
      waitingCount={queue.waiting + queue.delayed}
    />
  ));
  const metricRows =
    metrics.length > 0 ? (
      metrics.map((metric) => (
        <TableRow key={metric.id}>
          <TableCell>{metric.serviceName}</TableCell>
          <TableCell>
            <HealthStatusBadge status={metric.status} />
          </TableCell>
          <TableCell>{formatResponseTime(metric.responseTimeMs)}</TableCell>
          <TableCell>{formatPercent(metric.cpuUsage)}</TableCell>
          <TableCell>{formatPercent(metric.memoryUsage)}</TableCell>
          <TableCell className="ts-mono-xs">{formatDateTime(metric.checkedAt)}</TableCell>
        </TableRow>
      ))
    ) : (
      <TableRow>
        <TableCell className="text-text-muted" colSpan={6}>
          Belum ada metric monitoring.
        </TableCell>
      </TableRow>
    );
  const errorRows =
    errors.length > 0 ? (
      errors.map((errorLog) => (
        <TableRow key={errorLog.id}>
          <TableCell className="ts-mono-xs">{formatDateTime(errorLog.createdAt)}</TableCell>
          <TableCell>{errorLog.module}</TableCell>
          <TableCell>
            <StatusBadge
              label={errorLog.severity}
              tone={errorLog.severity === "critical" ? "danger" : "warning"}
            />
          </TableCell>
          <TableCell>{errorLog.message}</TableCell>
        </TableRow>
      ))
    ) : (
      <TableRow>
        <TableCell className="text-text-muted" colSpan={4}>
          Belum ada error penting.
        </TableCell>
      </TableRow>
    );
  const jobRows =
    failedJobs.length > 0 ? (
      failedJobs.map((job) => {
        const statusKey = job.status.toLowerCase() as keyof typeof JOB_STATUS_LABELS;
        const statusTone = (JOB_STATUS_TONES[statusKey] ?? "danger") as StatusTone;

        return (
          <TableRow key={job.id}>
            <TableCell className="ts-mono-xs">{job.id.slice(0, 8)}</TableCell>
            <TableCell>{job.type}</TableCell>
            <TableCell>
              <StatusBadge label={JOB_STATUS_LABELS[statusKey] ?? job.status} tone={statusTone} />
            </TableCell>
            <TableCell>{job.progress}%</TableCell>
            <TableCell>{job.errorMessage ?? "-"}</TableCell>
          </TableRow>
        );
      })
    ) : (
      <TableRow>
        <TableCell className="text-text-muted" colSpan={5}>
          Tidak ada job gagal.
        </TableCell>
      </TableRow>
    );

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Monitoring | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <section className="grid gap-2">
          <h1 className="ts-3xl text-text-strong">Monitoring</h1>
          <p className="ts-sm text-text-muted">
            Status API, database, Redis, worker, resource server, response time, dan queue.
          </p>
        </section>
        <Button
          disabled={runCheck.isPending}
          leftIcon={<RefreshCw />}
          onClick={() => runCheck.mutate()}
        >
          {runCheck.isPending ? "Mengecek..." : "Jalankan Check"}
        </Button>
      </header>
      {healthQuery.isError ? (
        <ErrorState
          description={getErrorMessage(healthQuery.error, "Health check gagal dimuat.")}
          onRetry={() => healthQuery.refetch()}
        />
      ) : (
        <section className="ssp-monitoring-health-grid">{healthCards}</section>
      )}
      {resourcesQuery.isError ? (
        <ErrorState
          description={getErrorMessage(resourcesQuery.error, "Resource metric gagal dimuat.")}
          onRetry={() => resourcesQuery.refetch()}
        />
      ) : resourceCards}
      <section className="grid gap-4 md:grid-cols-3">{queueCards}</section>
      <section className="ssp-monitoring-chart-grid">
        <Card>
          <CardHeader>
            <CardTitle>Response Time API</CardTitle>
          </CardHeader>
          <CardContent>
            {responseTime.length > 0 ? (
              <section className="h-72">
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={responseTime}>
                    <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="createdAt"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => formatResponseTime(Number(value))}
                      labelFormatter={(value) => formatDateTime(value as string)}
                    />
                    <Legend />
                    <Line dataKey="durationMs" name="Response Time" stroke={CHART_COLORS.primary} strokeWidth={2} type="monotone" />
                  </LineChart>
                </ResponsiveContainer>
              </section>
            ) : (
              <EmptyState
                description="Belum ada metric response time."
                title="Chart Kosong"
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Response Log</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Durasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responseTime.length > 0 ? (
                  responseTime
                    .slice()
                    .reverse()
                    .slice(0, 10)
                    .map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="ts-mono-xs">{formatDateTime(row.createdAt)}</TableCell>
                        <TableCell>{row.method}</TableCell>
                        <TableCell className="ts-mono-xs">{row.path}</TableCell>
                        <TableCell>{row.statusCode}</TableCell>
                        <TableCell>{formatResponseTime(row.durationMs)}</TableCell>
                      </TableRow>
                    ))
                ) : (
                  <TableRow>
                    <TableCell className="text-text-muted" colSpan={5}>
                      Belum ada log response time.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </DataTable>
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Recent Health Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable dense>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>Memory</TableHead>
                <TableHead>Checked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{metricRows}</TableBody>
          </DataTable>
        </CardContent>
      </Card>
      <section className="ssp-monitoring-chart-grid">
        <Card>
          <CardHeader>
            <CardTitle>Recent Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Pesan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{errorRows}</TableBody>
            </DataTable>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Failed Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{jobRows}</TableBody>
            </DataTable>
          </CardContent>
        </Card>
      </section>
    </section>
  );
}
