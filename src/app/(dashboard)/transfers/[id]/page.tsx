"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Helmet } from "react-helmet-async";

import { Button, Dialog, ErrorState, StatusBadge } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { TRANSFER_STATUS_LABELS, TRANSFER_STATUS_TONES, SYNC_STATUS_LABELS, SYNC_STATUS_TONES } from "@/constants/design";
import type { StatusTone } from "@/constants/design";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/useAuth";
import { eden } from "@/lib/eden";
import { formatDateTime, formatStockQuantity } from "@/utils/inventoryDisplay";
import { hasPermission } from "@/utils/permissions";
import { mc } from "@/utils/mc";
import { useState } from "react";
import { getErrorMessage } from "@/utils/getErrorMessage";

function useTransfer(id: string) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.transfers({ id }).get();
      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["transfer", id],
  });
}

function useSyncLogs(id: string) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.transfers({ id })["sync-logs"].get();
      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["transfer-sync-logs", id],
  });
}

/**
 * Transfer detail page.
 */
export default function TransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const auth = useAuth();
  const user = auth.data?.user;
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const transferQuery = useTransfer(id);
  const syncLogsQuery = useSyncLogs(id);
  const canCancel = user ? hasPermission(user.role, "transfer.cancel") : false;

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await eden.api.v1.transfers({ id }).cancel.post({});
      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfer", id] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast.success("Transfer berhasil dibatalkan.");
      setCancelOpen(false);
    },
  });

  if (transferQuery.isLoading) {
    return (
      <section className="grid gap-6">
        <section className="h-8 w-48 animate-pulse rounded bg-muted-surface" />
        <section className="h-64 animate-pulse rounded-xl bg-muted-surface" />
      </section>
    );
  }

  if (transferQuery.isError || !transferQuery.data) {
    return <ErrorState onRetry={() => transferQuery.refetch()} />;
  }

  const transfer = transferQuery.data as any;
  const syncLogs = (syncLogsQuery.data ?? []) as any[];
  const statusKey = (transfer.status as string).toLowerCase() as keyof typeof TRANSFER_STATUS_LABELS;
  const statusLabel = TRANSFER_STATUS_LABELS[statusKey] ?? transfer.status;
  const statusTone = (TRANSFER_STATUS_TONES[statusKey] ?? "neutral") as StatusTone;
  const canBeCancelled = transfer.status === "PENDING" || transfer.status === "PROCESSING";

  const cancelError = cancelMutation.error
    ? getErrorMessage(cancelMutation.error, "Transfer gagal dibatalkan.")
    : null;

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>{transfer.transferNumber} | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <section className="grid gap-2">
          <section className="flex items-center gap-3">
            <h1 className="ts-3xl font-bold text-text-strong">{transfer.transferNumber}</h1>
            <StatusBadge label={statusLabel} tone={statusTone} />
          </section>
          <p className="ts-sm text-text-muted">
            Dibuat {formatDateTime(transfer.createdAt)} oleh {transfer.requestedBy ?? "-"}
          </p>
        </section>
        {canCancel && canBeCancelled ? (
          <Button onClick={() => setCancelOpen(true)} type="button" variant="secondary">
            Batalkan Transfer
          </Button>
        ) : null}
      </header>

      {transfer.errorMessage ? (
        <section className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3">
          <p className="ts-sm font-medium text-danger">{transfer.errorMessage}</p>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-border-default bg-card-surface p-6 shadow-sm">
          <h2 className="ts-lg mb-4 font-semibold text-text-strong">Gudang</h2>
          <section className="flex items-center gap-4">
            <section className="grid gap-1">
              <p className="ts-xs text-text-muted">Asal</p>
              <p className="font-medium text-text-strong">{transfer.sourceWarehouseName}</p>
              <p className="ts-xs text-text-muted">{transfer.sourceWarehouseCity}</p>
            </section>
            <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
            <section className="grid gap-1">
              <p className="ts-xs text-text-muted">Tujuan</p>
              <p className="font-medium text-text-strong">{transfer.destinationWarehouseName}</p>
              <p className="ts-xs text-text-muted">{transfer.destinationWarehouseCity}</p>
            </section>
          </section>
          {transfer.notes ? (
            <section className="mt-4 rounded-lg bg-muted-surface px-4 py-3">
              <p className="ts-xs text-text-muted">Catatan</p>
              <p className="ts-sm text-text-default">{transfer.notes}</p>
            </section>
          ) : null}
          {transfer.completedAt ? (
            <p className="ts-xs mt-4 text-text-muted">
              Selesai: {formatDateTime(transfer.completedAt)}
            </p>
          ) : null}
        </article>

        <article className="rounded-xl border border-border-default bg-card-surface p-6 shadow-sm">
          <h2 className="ts-lg mb-4 font-semibold text-text-strong">Item Transfer</h2>
          <section className="grid gap-3">
            {(transfer.items as any[]).map((item: any) => (
              <section
                className="flex items-center justify-between rounded-lg border border-border-default px-4 py-3"
                key={item.id}
              >
                <section className="grid gap-0.5">
                  <p className="ts-sm font-medium text-text-strong">{item.productName}</p>
                  <p className="ts-xs text-text-muted">{item.productSku}</p>
                </section>
                <p className="ts-sm font-semibold text-text-strong">
                  {formatStockQuantity(item.quantity, item.unit)}
                </p>
              </section>
            ))}
            {(transfer.items as any[]).length === 0 ? (
              <p className="ts-sm text-text-muted">Tidak ada item.</p>
            ) : null}
          </section>
        </article>
      </section>

      <article className="rounded-xl border border-border-default bg-card-surface shadow-sm">
        <header className="border-b border-border-default px-6 py-4">
          <h2 className="ts-lg font-semibold text-text-strong">Pergerakan Stok</h2>
        </header>
        <section className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-muted-surface">
                <th className="ts-sm px-4 py-3 text-left font-medium text-text-default">Tanggal</th>
                <th className="ts-sm px-4 py-3 text-left font-medium text-text-default">Produk</th>
                <th className="ts-sm px-4 py-3 text-left font-medium text-text-default">Gudang</th>
                <th className="ts-sm px-4 py-3 text-left font-medium text-text-default">Tipe</th>
                <th className="ts-sm px-4 py-3 text-left font-medium text-text-default">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {(transfer.movements as any[]).map((m: any) => (
                <tr className="border-b border-border-default" key={m.id}>
                  <td className="ts-xs px-4 py-3 text-text-muted">{formatDateTime(m.createdAt)}</td>
                  <td className="ts-sm px-4 py-3 text-text-strong">{m.productName}</td>
                  <td className="ts-sm px-4 py-3 text-text-default">{m.warehouseName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={m.type}
                      tone={m.type === "TRANSFER_OUT" ? "warning" : "success"}
                    />
                  </td>
                  <td className="ts-sm px-4 py-3 font-medium text-text-strong">{m.quantity}</td>
                </tr>
              ))}
              {(transfer.movements as any[]).length === 0 ? (
                <tr>
                  <td className="ts-sm px-4 py-6 text-center text-text-muted" colSpan={5}>
                    Belum ada movement tercatat.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </article>

      <article className="rounded-xl border border-border-default bg-card-surface shadow-sm">
        <header className="border-b border-border-default px-6 py-4">
          <h2 className="ts-lg font-semibold text-text-strong">Log Sinkronisasi</h2>
        </header>
        <section className="grid gap-3 p-6">
          {syncLogs.map((log: any) => {
            const syncStatusKey = (log.status as string).toUpperCase() as keyof typeof SYNC_STATUS_LABELS;
            const syncLabel = SYNC_STATUS_LABELS[syncStatusKey] ?? log.status;
            const syncTone = (SYNC_STATUS_TONES[syncStatusKey] ?? "neutral") as StatusTone;

            return (
              <section
                className="flex items-start justify-between gap-3 rounded-lg border border-border-default px-4 py-3"
                key={log.id}
              >
                <section className="grid gap-0.5">
                  <p className="ts-sm text-text-default">{log.message}</p>
                  <p className="ts-xs text-text-muted">{formatDateTime(log.createdAt)}</p>
                </section>
                <StatusBadge label={syncLabel} tone={syncTone} />
              </section>
            );
          })}
          {syncLogs.length === 0 ? (
            <p className="ts-sm text-text-muted">Belum ada log sinkronisasi.</p>
          ) : null}
        </section>
      </article>

      <Dialog
        description="Transfer yang sudah dibatalkan tidak dapat dikembalikan."
        id="cancel-transfer-dialog"
        onClose={() => setCancelOpen(false)}
        open={cancelOpen}
        title="Batalkan Transfer?"
      >
        <section className="grid gap-4">
          {cancelError ? (
            <section className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3">
              <p className="ts-sm text-danger">{cancelError}</p>
            </section>
          ) : null}
          <section className="flex gap-3">
            <Button
              className="flex-1"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
              type="button"
              variant="danger"
            >
              {cancelMutation.isPending ? "Membatalkan..." : "Ya, Batalkan"}
            </Button>
            <Button
              className="flex-1"
              onClick={() => setCancelOpen(false)}
              type="button"
              variant="secondary"
            >
              Tidak
            </Button>
          </section>
        </section>
      </Dialog>
    </section>
  );
}
