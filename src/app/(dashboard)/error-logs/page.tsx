"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye } from "lucide-react";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

import {
  ActionMenu,
  Card,
  CardContent,
  DataTable,
  DataTableShell,
  Dialog,
  Pagination,
  SelectInput,
  StatusBadge,
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

type ErrorLogRecord = {
  createdAt: Date | string;
  id: string;
  message: string;
  metadata: Record<string, unknown>;
  module: string;
  resolvedAt: Date | string | null;
  severity: "critical" | "warning" | "info";
  stack: string | null;
};

function useErrorLogs(page: number, severity: string, resolved: string) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api["error-logs"].get({
        query: {
          limit: "10",
          page: String(page),
          resolved,
          severity,
          sortBy: "createdAt",
          sortDir: "desc",
        },
      });

      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["error-logs", page, severity, resolved],
  });
}

function getSeverityTone(severity: ErrorLogRecord["severity"]) {
  if (severity === "critical") return "stockCritical";
  if (severity === "warning") return "warning";

  return "info";
}

/**
 * Error log dashboard page.
 */
export default function ErrorLogsPage() {
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState("");
  const [resolved, setResolved] = useState("");
  const [selectedError, setSelectedError] = useState<ErrorLogRecord | null>(null);
  const queryClient = useQueryClient();
  const errorLogsQuery = useErrorLogs(page, severity, resolved);
  const resolveError = useMutation({
    mutationFn: async (errorLog: ErrorLogRecord) => {
      const response = await eden.api["error-logs"]({ id: errorLog.id }).resolve.patch({
        note: "Diselesaikan dari dashboard.",
      });

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["error-logs"] });
      toast.success("Error log ditandai selesai.");
    },
  });
  const errorLogs = (errorLogsQuery.data?.data ?? []) as ErrorLogRecord[];
  const pagination = errorLogsQuery.data?.pagination ?? {
    limit: 10,
    page: 1,
    pageCount: 1,
    total: 0,
  };
  const rows = errorLogs.map((errorLog) => (
    <TableRow key={errorLog.id}>
      <TableCell className="ts-mono-xs">{formatDateTime(errorLog.createdAt)}</TableCell>
      <TableCell>{errorLog.module}</TableCell>
      <TableCell>
        <StatusBadge label={errorLog.severity} tone={getSeverityTone(errorLog.severity)} />
      </TableCell>
      <TableCell className="max-w-md truncate">{errorLog.message}</TableCell>
      <TableCell>
        <StatusBadge label={errorLog.resolvedAt ? "Selesai" : "Belum Selesai"} tone={errorLog.resolvedAt ? "success" : "warning"} />
      </TableCell>
      <TableCell>
        <ActionMenu
          items={[
            {
              icon: <Eye />,
              label: "Detail",
              onSelect: () => setSelectedError(errorLog),
            },
            {
              disabled: Boolean(errorLog.resolvedAt),
              icon: <CheckCircle2 />,
              label: "Tandai Selesai",
              onSelect: () => resolveError.mutate(errorLog),
            },
          ]}
        />
      </TableCell>
    </TableRow>
  ));
  let tableBody = rows;

  if (rows.length === 0) {
    tableBody = [
      <TableRow key="empty">
        <TableCell className="text-text-muted" colSpan={6}>
          Belum ada error log yang sesuai filter.
        </TableCell>
      </TableRow>,
    ];
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Error Log | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="grid gap-2">
        <h1 className="ts-3xl text-text-strong">Error Log</h1>
        <p className="ts-sm text-text-muted">
          Pantau exception aplikasi dengan severity critical, warning, dan info.
        </p>
      </header>
      <DataTableShell
        description={`Total ${pagination.total} error log tercatat.`}
        footer={<Pagination currentPage={pagination.page} onPageChange={setPage} pageCount={pagination.pageCount} />}
        title="Daftar Error"
        toolbar={
          <section className="grid gap-3 md:grid-cols-[200px_200px]">
            <SelectInput
              id="error-severity"
              label="Severity"
              onValueChange={(value) => {
                setPage(1);
                setSeverity(value);
              }}
              options={[
                { label: "Semua", value: "" },
                { label: "Critical", value: "critical" },
                { label: "Warning", value: "warning" },
                { label: "Info", value: "info" },
              ]}
              value={severity}
            />
            <SelectInput
              id="error-resolved"
              label="Status"
              onValueChange={(value) => {
                setPage(1);
                setResolved(value);
              }}
              options={[
                { label: "Semua", value: "" },
                { label: "Belum Selesai", value: "false" },
                { label: "Selesai", value: "true" },
              ]}
              value={resolved}
            />
          </section>
        }
      >
        <DataTable dense>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Pesan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{tableBody}</TableBody>
        </DataTable>
      </DataTableShell>
      <Dialog
        id="error-log-detail"
        onClose={() => setSelectedError(null)}
        open={Boolean(selectedError)}
        title="Detail Error"
      >
        <Card>
          <CardContent>
            <section className="grid gap-3">
              <p className="ts-sm font-medium text-text-strong">
                {selectedError?.message}
              </p>
              <p className="ts-mono-xs text-text-muted">
                {JSON.stringify(selectedError?.metadata ?? {}, null, 2)}
              </p>
              <pre className="ts-mono-xs max-h-64 overflow-auto rounded-lg bg-muted-surface p-3 text-text-muted">
                {selectedError?.stack ?? "Stack trace tidak tersedia."}
              </pre>
            </section>
          </CardContent>
        </Card>
      </Dialog>
    </section>
  );
}
