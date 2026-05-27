"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

import {
  Button,
  DataTable,
  DataTableShell,
  EmptyState,
  ErrorState,
  Pagination,
  StatusBadge,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { JOB_STATUS_LABELS, JOB_STATUS_TONES } from "@/constants/design";
import type { StatusTone } from "@/constants/design";
import { API_ROUTES, ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/useAuth";
import { eden } from "@/lib/eden";
import { formatDateTime } from "@/utils/inventoryDisplay";
import { hasPermission } from "@/utils/permissions";

type ReportExport = {
  completedAt: Date | string | null;
  createdAt: Date | string;
  fileName: string;
  id: string;
  status: string;
  type: string;
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  INVENTORY_SUMMARY: "Ringkasan Inventaris",
  LOW_STOCK_REPORT: "Laporan Stok Rendah",
  STOCK_MOVEMENT: "Pergerakan Stok",
  TRANSFER_REPORT: "Laporan Transfer",
};

function useReports(page: number) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.reports.get({
        query: { limit: "10", page: String(page) },
      });
      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["reports", page],
    refetchInterval: 5000,
  });
}

/**
 * Report list page.
 */
export default function ReportsPage() {
  const [page, setPage] = useState(1);
  const auth = useAuth();
  const user = auth.data?.user;
  const canGenerate = user ? hasPermission(user.role, "report.generate") : false;
  const canDownload = user ? hasPermission(user.role, "report.download") : false;
  const reportsQuery = useReports(page);
  const reports = (reportsQuery.data?.data ?? []) as ReportExport[];
  const pagination = reportsQuery.data?.pagination ?? { limit: 10, page: 1, pageCount: 1, total: 0 };

  let content = null;

  if (reportsQuery.isLoading) {
    content = (
      <TableBody>
        {Array.from({ length: 4 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: 5 }).map((_, j) => (
              <TableCell key={j}>
                <span className="block h-4 w-24 animate-pulse rounded bg-muted-surface" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    );
  } else if (reportsQuery.isError) {
    content = (
      <TableBody>
        <TableRow>
          <TableCell colSpan={5}>
            <ErrorState onRetry={() => reportsQuery.refetch()} />
          </TableCell>
        </TableRow>
      </TableBody>
    );
  } else if (reports.length === 0) {
    content = (
      <TableBody>
        <TableRow>
          <TableCell colSpan={5}>
            <EmptyState
              description="Belum ada laporan yang dibuat."
              title="Belum Ada Laporan"
            />
          </TableCell>
        </TableRow>
      </TableBody>
    );
  } else {
    const rows = reports.map((report) => {
      const statusKey = report.status.toLowerCase() as keyof typeof JOB_STATUS_LABELS;
      const statusLabel = JOB_STATUS_LABELS[statusKey] ?? report.status;
      const statusTone = (JOB_STATUS_TONES[statusKey] ?? "neutral") as StatusTone;
      const isCompleted = report.status === "COMPLETED";

      return (
        <TableRow key={report.id}>
          <TableCell>{REPORT_TYPE_LABELS[report.type] ?? report.type}</TableCell>
          <TableCell className="ts-sm">{report.fileName}</TableCell>
          <TableCell>
            <StatusBadge label={statusLabel} tone={statusTone} />
          </TableCell>
          <TableCell className="ts-xs text-text-muted">{formatDateTime(report.createdAt)}</TableCell>
          <TableCell>
            {isCompleted && canDownload ? (
              <a
                className="inline-flex items-center gap-1.5 ts-sm rounded-md border border-border-default px-3 py-1.5 text-text-strong hover:bg-muted-surface"
                href={API_ROUTES.REPORTS_DOWNLOAD(report.id)}
                download
              >
                <Download className="size-4" />
                Unduh
              </a>
            ) : (
              <span className="ts-sm text-text-disabled">
                {isCompleted ? "-" : "Menunggu..."}
              </span>
            )}
          </TableCell>
        </TableRow>
      );
    });
    content = <TableBody>{rows}</TableBody>;
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Laporan | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <section className="grid gap-2">
          <h1 className="ts-3xl text-text-strong">Laporan</h1>
          <p className="ts-sm text-text-muted">
            Generate dan unduh laporan inventaris dan pergerakan stok.
          </p>
        </section>
        {canGenerate ? (
          <Link href={ROUTES.REPORTS.CREATE}>
            <Button leftIcon={<Plus />}>Generate Laporan</Button>
          </Link>
        ) : null}
      </header>
      <DataTableShell
        description={`Total ${pagination.total} laporan tersimpan.`}
        footer={
          <Pagination currentPage={pagination.page} onPageChange={setPage} pageCount={pagination.pageCount} />
        }
        title="Daftar Laporan"
      >
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>Tipe Laporan</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          {content}
        </DataTable>
      </DataTableShell>
    </section>
  );
}
