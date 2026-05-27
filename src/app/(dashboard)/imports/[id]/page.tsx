"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

import {
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
import { IMPORT_STATUS_LABELS, IMPORT_STATUS_TONES } from "@/constants/design";
import type { StatusTone } from "@/constants/design";
import { eden } from "@/lib/eden";
import { formatDateTime } from "@/utils/inventoryDisplay";

function useImportBatch(id: string) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.imports({ id }).get();
      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["import-batch", id],
  });
}

function useImportRows(id: string, page: number) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.imports({ id }).rows.get({
        query: { limit: "20", page: String(page) },
      });
      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["import-rows", id, page],
  });
}

/**
 * Import batch detail page.
 */
export default function ImportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const batchQuery = useImportBatch(id);
  const rowsQuery = useImportRows(id, page);

  if (batchQuery.isLoading) {
    return (
      <section className="grid gap-6">
        <section className="h-8 w-48 animate-pulse rounded bg-muted-surface" />
        <section className="h-48 animate-pulse rounded-xl bg-muted-surface" />
      </section>
    );
  }

  if (batchQuery.isError || !batchQuery.data) {
    return <ErrorState onRetry={() => batchQuery.refetch()} />;
  }

  const batch = batchQuery.data as any;
  const rows = (rowsQuery.data?.data ?? []) as any[];
  const pagination = rowsQuery.data?.pagination ?? { limit: 20, page: 1, pageCount: 1, total: 0 };

  const statusKey = batch.status as keyof typeof IMPORT_STATUS_LABELS;
  const statusLabel = IMPORT_STATUS_LABELS[statusKey] ?? batch.status;
  const statusTone = (IMPORT_STATUS_TONES[statusKey] ?? "neutral") as StatusTone;

  const rowStatusTone: Record<string, StatusTone> = {
    FAILED: "danger",
    IMPORTED: "success",
    INVALID: "danger",
    SKIPPED: "neutral",
    VALID: "info",
  };

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Detail Import | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>

      <header className="flex flex-wrap items-start gap-4">
        <section className="grid gap-2">
          <section className="flex items-center gap-3">
            <h1 className="ts-2xl font-bold text-text-strong">{batch.fileName}</h1>
            <StatusBadge label={statusLabel} tone={statusTone} />
          </section>
          <p className="ts-sm text-text-muted">Diunggah {formatDateTime(batch.createdAt)}</p>
        </section>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-border-default bg-card-surface p-6 shadow-sm">
          <p className="ts-sm text-text-muted">Total Baris</p>
          <p className="ts-4xl font-bold text-text-strong">{batch.totalRows}</p>
        </article>
        <article className="rounded-xl border border-success-border bg-success-bg p-6 shadow-sm">
          <p className="ts-sm text-success">Berhasil</p>
          <p className="ts-4xl font-bold text-success">{batch.successRows}</p>
        </article>
        <article className="rounded-xl border border-danger-border bg-danger-bg p-6 shadow-sm">
          <p className="ts-sm text-danger">Gagal</p>
          <p className="ts-4xl font-bold text-danger">{batch.failedRows}</p>
        </article>
      </section>

      <DataTableShell
        description={`${pagination.total} baris import.`}
        footer={
          <Pagination currentPage={pagination.page} onPageChange={setPage} pageCount={pagination.pageCount} />
        }
        title="Detail Baris"
      >
        <DataTable dense>
          <TableHeader>
            <TableRow>
              <TableHead>Baris</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Nama Produk</TableHead>
              <TableHead>Gudang</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Keterangan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <span className="block h-4 w-20 animate-pulse rounded bg-muted-surface" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState description="Tidak ada baris import." title="Kosong" />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row: any) => {
                const raw = row.rawData as Record<string, string>;

                return (
                  <TableRow key={row.id}>
                    <TableCell className="ts-mono-xs">{row.rowNumber}</TableCell>
                    <TableCell className="ts-mono-xs">{raw.sku ?? "-"}</TableCell>
                    <TableCell>{raw.name ?? "-"}</TableCell>
                    <TableCell>{raw.warehouse_code ?? "-"}</TableCell>
                    <TableCell>
                      <StatusBadge
                        label={row.status}
                        tone={rowStatusTone[row.status] ?? "neutral"}
                      />
                    </TableCell>
                    <TableCell className="ts-xs text-text-muted">
                      {row.errorMessage ?? "-"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </DataTable>
      </DataTableShell>
    </section>
  );
}
