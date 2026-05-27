"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Filter, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useForm } from "@tanstack/react-form";

import {
  Button,
  DataTable,
  DataTableShell,
  DateInput,
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
  TextInput,
} from "@/components/ui";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { ROUTES } from "@/constants/routes";
import { TRANSFER_STATUS_LABELS, TRANSFER_STATUS_TONES } from "@/constants/design";
import type { StatusTone } from "@/constants/design";
import { useAuth } from "@/hooks/useAuth";
import { eden } from "@/lib/eden";
import { formatDateTime } from "@/utils/inventoryDisplay";
import { hasPermission } from "@/utils/permissions";
import { mc } from "@/utils/mc";

type TransferRecord = {
  cancelledAt: Date | string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  destinationWarehouseName: string;
  id: string;
  itemCount: number;
  requestedByName: string | null;
  sourceWarehouseName: string;
  status: string;
  transferNumber: string;
};

type TransferFilters = {
  dateFrom: string;
  dateTo: string;
  search: string;
  status: string;
};

const STATUS_OPTIONS = [
  { label: "Semua Status", value: "" },
  { label: "Menunggu", value: "PENDING" },
  { label: "Diproses", value: "PROCESSING" },
  { label: "Selesai", value: "COMPLETED" },
  { label: "Dibatalkan", value: "CANCELLED" },
  { label: "Gagal", value: "FAILED" },
];

function useTransfers(page: number, filters: TransferFilters) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.transfers.get({
        query: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          limit: "10",
          page: String(page),
          search: filters.search,
          sortBy: "createdAt",
          sortDir: "desc",
          status: filters.status,
        },
      });

      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["transfers", page, filters],
  });
}

function TransferFilterForm({
  filters,
  onApply,
  onReset,
}: {
  filters: TransferFilters;
  onApply: (filters: TransferFilters) => void;
  onReset: () => void;
}) {
  const form = useForm({
    defaultValues: {
      dateRange: { from: filters.dateFrom, to: filters.dateTo },
      search: filters.search,
      status: filters.status,
    },
    onSubmit: ({ value }) =>
      onApply({
        dateFrom: value.dateRange.from,
        dateTo: value.dateRange.to,
        search: value.search,
        status: value.status,
      }),
  });

  return (
    <form
      className="grid gap-3 md:grid-cols-[200px_180px_280px_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="search">
        {(field) => (
          <TextInput
            id="transfer-search"
            label="Cari nomor"
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder="TRF-..."
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="status">
        {(field) => (
          <SelectInput
            id="transfer-status-filter"
            label="Status"
            onBlur={field.handleBlur}
            onValueChange={field.handleChange}
            options={STATUS_OPTIONS}
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="dateRange">
        {(field) => (
          <DateInput
            id="transfer-date-filter"
            label="Rentang Tanggal"
            mode="range"
            onBlur={field.handleBlur}
            onValueChange={field.handleChange}
            value={field.state.value}
          />
        )}
      </form.Field>
      <section className="flex items-end gap-2">
        <Button leftIcon={<Filter />} type="submit">
          Terapkan
        </Button>
        <Button leftIcon={<RotateCcw />} onClick={onReset} type="button" variant="secondary" />
      </section>
    </form>
  );
}

/**
 * Warehouse transfer list page.
 */
export default function TransfersPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TransferFilters>({
    dateFrom: "",
    dateTo: "",
    search: "",
    status: "",
  });
  const auth = useAuth();
  const user = auth.data?.user;
  const canCreate = user ? hasPermission(user.role, "transfer.create") : false;
  const transfersQuery = useTransfers(page, filters);
  const transfers = (transfersQuery.data?.data ?? []) as TransferRecord[];
  const pagination = transfersQuery.data?.pagination ?? {
    limit: 10,
    page: 1,
    pageCount: 1,
    total: 0,
  };

  let content = null;

  if (transfersQuery.isLoading) {
    content = (
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: 7 }).map((_, j) => (
              <TableCell key={j}>
                <span className="block h-4 w-24 animate-pulse rounded bg-muted-surface" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    );
  } else if (transfersQuery.isError) {
    content = (
      <TableBody>
        <TableRow>
          <TableCell colSpan={7}>
            <ErrorState onRetry={() => transfersQuery.refetch()} />
          </TableCell>
        </TableRow>
      </TableBody>
    );
  } else if (transfers.length === 0) {
    content = (
      <TableBody>
        <TableRow>
          <TableCell colSpan={7}>
            <EmptyState
              description="Belum ada transfer yang sesuai filter."
              title="Belum Ada Transfer"
            />
          </TableCell>
        </TableRow>
      </TableBody>
    );
  } else {
    const rows = transfers.map((transfer) => {
      const statusLabel = TRANSFER_STATUS_LABELS[transfer.status.toLowerCase() as keyof typeof TRANSFER_STATUS_LABELS] ?? transfer.status;
      const statusTone = (TRANSFER_STATUS_TONES[transfer.status.toLowerCase() as keyof typeof TRANSFER_STATUS_TONES] ?? "neutral") as StatusTone;

      return (
        <TableRow key={transfer.id}>
          <TableCell className="ts-mono-xs font-medium">{transfer.transferNumber}</TableCell>
          <TableCell>{transfer.sourceWarehouseName}</TableCell>
          <TableCell>{transfer.destinationWarehouseName}</TableCell>
          <TableCell>{transfer.itemCount} item</TableCell>
          <TableCell>
            <StatusBadge label={statusLabel} tone={statusTone} />
          </TableCell>
          <TableCell>{transfer.requestedByName ?? "-"}</TableCell>
          <TableCell className="ts-xs text-text-muted">
            {formatDateTime(transfer.createdAt)}
          </TableCell>
          <TableCell>
            <Link
              className="ts-sm rounded-md border border-border-default px-3 py-1.5 text-text-strong hover:bg-muted-surface"
              href={ROUTES.TRANSFERS.DETAIL(transfer.id)}
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
        <title>Transfer | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <section className="grid gap-2">
          <h1 className="ts-3xl text-text-strong">Transfer Antar Gudang</h1>
          <p className="ts-sm text-text-muted">
            Kelola perpindahan stok antar gudang PT Maju Bersama Digital.
          </p>
        </section>
        {canCreate ? (
          <Link href={ROUTES.TRANSFERS.CREATE}>
            <Button leftIcon={<Plus />}>Buat Transfer</Button>
          </Link>
        ) : null}
      </header>
      <DataTableShell
        description={`Total ${pagination.total} transfer tercatat.`}
        footer={
          <Pagination
            currentPage={pagination.page}
            onPageChange={setPage}
            pageCount={pagination.pageCount}
          />
        }
        title="Daftar Transfer"
        toolbar={
          <TransferFilterForm
            filters={filters}
            onApply={(nextFilters) => {
              setPage(1);
              setFilters(nextFilters);
            }}
            onReset={() => {
              setPage(1);
              setFilters({ dateFrom: "", dateTo: "", search: "", status: "" });
            }}
          />
        }
      >
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>Nomor Transfer</TableHead>
              <TableHead>Gudang Asal</TableHead>
              <TableHead>Gudang Tujuan</TableHead>
              <TableHead>Jumlah Item</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dibuat Oleh</TableHead>
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
