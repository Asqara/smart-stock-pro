"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, RefreshCw } from "lucide-react";
import { Helmet } from "react-helmet-async";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  HealthStatusBadge,
  MonitoringHealthCard,
  QueueStatusCard,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { eden } from "@/lib/eden";
import { formatDateTime } from "@/utils/inventoryDisplay";

type HealthMetric = {
  checkedAt: Date | string;
  id: string;
  metadata: Record<string, unknown> | null;
  responseTimeMs: number;
  serviceName: string;
  status: "healthy" | "degraded" | "down";
  uptimeSeconds: number | null;
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

function useHealth() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.monitoring.health.get();

      if (response.error) throw response.error;

      return response.data as HealthMetric[];
    },
    queryKey: ["monitoring", "health"],
  });
}

function useMetrics() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.monitoring.metrics.get();

      if (response.error) throw response.error;

      return response.data as HealthMetric[];
    },
    queryKey: ["monitoring", "metrics"],
  });
}

function useQueues() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.monitoring.queues.get();

      if (response.error) throw response.error;

      return response.data as QueueMetric[];
    },
    queryKey: ["monitoring", "queues"],
  });
}

/**
 * System monitoring page.
 */
export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const healthQuery = useHealth();
  const metricsQuery = useMetrics();
  const queuesQuery = useQueues();
  const runCheck = useMutation({
    mutationFn: async () => {
      const response = await eden.api.monitoring.check.post({
        serviceName: "manual",
      });

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring"] });
      toast.success("Monitoring check selesai.");
    },
  });
  const health = healthQuery.data ?? [];
  const metrics = metricsQuery.data ?? [];
  const queues = queuesQuery.data ?? [];
  const healthCards = health.map((metric) => (
    <MonitoringHealthCard
      description="Health check terakhir tersimpan."
      key={metric.id}
      lastChecked={formatDateTime(metric.checkedAt)}
      metric={`${metric.responseTimeMs} ms`}
      serviceName={metric.serviceName}
      status={metric.status}
    />
  ));
  const metricRows = metrics.map((metric) => (
    <TableRow key={metric.id}>
      <TableCell>{metric.serviceName}</TableCell>
      <TableCell>
        <HealthStatusBadge status={metric.status} />
      </TableCell>
      <TableCell>{metric.responseTimeMs} ms</TableCell>
      <TableCell>{metric.uptimeSeconds ?? "-"} detik</TableCell>
      <TableCell className="ts-mono-xs">{formatDateTime(metric.checkedAt)}</TableCell>
      <TableCell className="ts-mono-xs">
        {JSON.stringify(metric.metadata ?? {})}
      </TableCell>
    </TableRow>
  ));
  let tableBody = metricRows;
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

  if (metricRows.length === 0) {
    tableBody = [
      <TableRow key="empty">
        <TableCell className="text-text-muted" colSpan={6}>
          Belum ada metric monitoring.
        </TableCell>
      </TableRow>,
    ];
  }

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
            Status API, database, Redis, worker, response time, dan uptime.
          </p>
        </section>
        <Button
          disabled={runCheck.isPending}
          leftIcon={<RefreshCw />}
          onClick={() => runCheck.mutate()}
        >
          Jalankan Check
        </Button>
      </header>
      <section className="ssp-monitoring-health-grid">{healthCards}</section>
      <section className="grid gap-4 md:grid-cols-3">{queueCards}</section>
      <Card>
        <CardHeader>
          <CardTitle>Recent Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable dense>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Response Time</TableHead>
                <TableHead>Uptime</TableHead>
                <TableHead>Checked At</TableHead>
                <TableHead>Metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{tableBody}</TableBody>
          </DataTable>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <section className="flex items-center gap-3">
            <Activity className="size-5 text-operational-cyan" />
            <p className="ts-sm text-text-muted">
              Warning otomatis dibuat jika response time melewati 1000 ms.
            </p>
          </section>
        </CardContent>
      </Card>
    </section>
  );
}
