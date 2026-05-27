"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
  SelectInput,
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
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/useAuth";
import { eden } from "@/lib/eden";
import { formatDateTime } from "@/utils/inventoryDisplay";
import { hasPermission } from "@/utils/permissions";

type ImportBatch = {
  createdAt: Date | string;
  failedRows: number;
  fileName: string;
  id: string;
  status: string;
  successRows: number;
  totalRows: number;
};

const STATUS_OPTIONS = [
  { label: "Semua Status", value: "" },
  { label: "Diunggah", value: "UPLOADED" },
  { label: "Divalidasi", value: "VALIDATING" },
  { label: "Diproses", value: "PROCESSING" },
  { label: "Selesai", value: "COMPLETED" },
  { label: "Selesai dengan Error", value: "COMPLETED_WITH_ERRORS" },
  { label: "Gagal", value: "FAILED" },
  { label: "Di-rollback", value: "ROLLED_BACK" },
];

function useImports(page: number, status: string) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.imports.get({
        query: { limit: "10", page: String(page), status },
      });
      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["imports", page, status],
  });
}

/**
 * Import list page.
 */
export default function ImportsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const auth = useAuth();
  const user = auth.data?.user;
  const canCreate = user ? hasPermission(user.role, "import.create") : false;
  const importsQuery = useImports(page, status);
  const batches = (importsQuery.data?.data ?? []) as ImportBatch[];
  const pagination = importsQuery.data?.pagination ?? { limit: 10, page: 1, pageCount: 1, total: 0 };

  let content = null;

  if (importsQuery.isLoading) {
    content = (
      <TableBody>
        {Array.from({ length: 4 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: 7 }).map((_, j) => (
              <TableCell key={j}>
                <span className="block h-4 w-20 animate-pulse rounded bg-muted-surface" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    );
  } else if (importsQuery.isError) {
    content = (
      <TableBody>
        <TableRow>
          <TableCell colSpan={7}>
            <ErrorState onRetry={() => importsQuery.refetch()} />
          </TableCell>
        </TableRow>
      </TableBody>
    );
  } else if (batches.length === 0) {
    content = (
      <TableBody>
        <TableRow>
          <TableCell colSpan={7}>
            <EmptyState
              description="Belum ada import yang dilakukan."
              title="Belum Ada Import"
            />
          </TableCell>
        </TableRow>
      </TableBody>
    );
  } else {
    const rows = batches.map((batch) => {
      const statusKey = batch.status as keyof typeof IMPORT_STATUS_LABELS;
      const statusLabel = IMPORT_STATUS_LABELS[statusKey] ?? batch.status;
      const statusTone = (IMPORT_STATUS_TONES[statusKey] ?? "neutral") as StatusTone;

      return (
        <TableRow key={batch.id}>
          <TableCell className="max-w-[200px] truncate ts-sm">{batch.fileName}</TableCell>
          <TableCell>
            <StatusBadge label={statusLabel} tone={statusTone} />
          </TableCell>
          <TableCell>{batch.totalRows}</TableCell>
          <TableCell className="text-success">{batch.successRows}</TableCell>
          <TableCell className="text-danger">{batch.failedRows}</TableCell>
          <TableCell className="ts-xs text-text-muted">{formatDateTime(batch.createdAt)}</TableCell>
          <TableCell>
            <Link
              className="ts-sm rounded-md border border-border-default px-3 py-1.5 text-text-strong hover:bg-muted-surface"
              href={ROUTES.IMPORTS.DETAIL(batch.id)}
            >
              Detail
            </Link>
          </TableCell>
        </TableRow>
      );
    });
    content = <TableBody>{rows}</TableBody>;
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Import | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <section className="grid gap-2">
          <h1 className="ts-3xl text-text-strong">Import Produk</h1>
          <p className="ts-sm text-text-muted">
            Import data produk dan stok dari template Excel.
          </p>
        </section>
        {canCreate ? (
          <Link href={ROUTES.IMPORTS.CREATE}>
            <Button leftIcon={<Plus />}>Import Baru</Button>
          </Link>
        ) : null}
      </header>
      <DataTableShell
        description={`Total ${pagination.total} import tercatat.`}
        footer={
          <Pagination currentPage={pagination.page} onPageChange={setPage} pageCount={pagination.pageCount} />
        }
        title="Riwayat Import"
        toolbar={
          <SelectInput
            id="import-status-filter"
            label="Status"
            onValueChange={(v) => { setPage(1); setStatus(v); }}
            options={STATUS_OPTIONS}
            value={status}
          />
        }
      >
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total Baris</TableHead>
              <TableHead>Berhasil</TableHead>
              <TableHead>Gagal</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          {content}
        </DataTable>
      </DataTableShell>
    </section>
  );
}
