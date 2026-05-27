"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Helmet } from "react-helmet-async";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  Skeleton,
  StatusBadge,
} from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { ALERT_SEVERITY_TONES } from "@/constants/design";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/useAuth";
import { eden } from "@/lib/eden";
import { formatDateTime } from "@/utils/inventoryDisplay";
import { hasPermission } from "@/utils/permissions";
import { getErrorMessage } from "@/utils/getErrorMessage";

type ErrorLogDetail = {
  createdAt: Date | string;
  id: string;
  message: string;
  metadata: Record<string, unknown> | null;
  module: string;
  resolvedAt: Date | string | null;
  severity: "critical" | "warning" | "info";
  stack: string | null;
  updatedAt: Date | string;
};

function useErrorLog(id: string) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api["error-logs"]({ id }).get();
      if (response.error) throw response.error;

      return response.data as ErrorLogDetail;
    },
    queryKey: ["error-log", id],
  });
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <section className="grid gap-1">
      <p className="ts-xs font-medium text-text-muted">{label}</p>
      <p className="ts-sm text-text-strong">{value}</p>
    </section>
  );
}

/**
 * Error log detail page.
 */
export default function ErrorLogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const auth = useAuth();
  const user = auth.data?.user;
  const queryClient = useQueryClient();
  const canResolve = user ? hasPermission(user.role, "error_log.resolve") : false;
  const errorLogQuery = useErrorLog(id);

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const response = await eden.api["error-logs"]({ id }).resolve.patch({
        note: "Diselesaikan dari halaman detail.",
      });
      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["error-log", id] });
      queryClient.invalidateQueries({ queryKey: ["error-logs"] });
      toast.success("Error log ditandai selesai.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal menyelesaikan error log."));
    },
  });

  if (errorLogQuery.isLoading) {
    return (
      <section className="grid gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </section>
    );
  }

  if (errorLogQuery.isError) {
    return (
      <ErrorState
        description={getErrorMessage(errorLogQuery.error, "Error log gagal dimuat.")}
        onRetry={() => errorLogQuery.refetch()}
      />
    );
  }

  const errorLog = errorLogQuery.data;

  if (!errorLog) return null;

  const isResolved = Boolean(errorLog.resolvedAt);
  const metadataText =
    errorLog.metadata && Object.keys(errorLog.metadata).length > 0
      ? JSON.stringify(errorLog.metadata, null, 2)
      : null;

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Detail Error Log | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <section className="grid gap-2">
          <Link
            className="ts-sm inline-flex items-center gap-1 text-text-muted hover:text-text-strong"
            href={ROUTES.ERROR_LOGS}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Kembali ke Error Log
          </Link>
          <section className="flex flex-wrap items-center gap-3">
            <h1 className="ts-3xl text-text-strong">Detail Error</h1>
            <StatusBadge
              label={errorLog.severity}
              tone={ALERT_SEVERITY_TONES[errorLog.severity]}
            />
            <StatusBadge
              label={isResolved ? "Selesai" : "Belum Selesai"}
              tone={isResolved ? "success" : "warning"}
            />
          </section>
          <p className="ts-sm font-mono text-text-muted">{errorLog.id}</p>
        </section>
        {canResolve && !isResolved && (
          <Button
            disabled={resolveMutation.isPending}
            leftIcon={<CheckCircle2 />}
            onClick={() => resolveMutation.mutate()}
            variant="secondary"
          >
            {resolveMutation.isPending ? "Menyimpan..." : "Tandai Selesai"}
          </Button>
        )}
      </header>

      <section className="ssp-detail-layout">
        <section className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Pesan Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="ts-sm text-text-strong">{errorLog.message}</p>
            </CardContent>
          </Card>

          {errorLog.stack && (
            <Card>
              <CardHeader>
                <CardTitle>Stack Trace</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="ts-mono-xs max-h-96 overflow-auto rounded-lg bg-muted-surface p-4 text-text-muted">
                  {errorLog.stack}
                </pre>
              </CardContent>
            </Card>
          )}

          {metadataText && (
            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="ts-mono-xs max-h-64 overflow-auto rounded-lg bg-muted-surface p-4 text-text-muted">
                  {metadataText}
                </pre>
              </CardContent>
            </Card>
          )}
        </section>

        <aside className="grid gap-4 self-start">
          <Card>
            <CardHeader>
              <CardTitle>Informasi</CardTitle>
            </CardHeader>
            <CardContent>
              <section className="grid gap-4">
                <MetaRow label="Module" value={errorLog.module} />
                <MetaRow label="Severity" value={errorLog.severity} />
                <MetaRow label="Waktu Terjadi" value={formatDateTime(errorLog.createdAt)} />
                <MetaRow
                  label="Diselesaikan"
                  value={errorLog.resolvedAt ? formatDateTime(errorLog.resolvedAt) : "Belum diselesaikan"}
                />
                <MetaRow label="Terakhir Diperbarui" value={formatDateTime(errorLog.updatedAt)} />
              </section>
            </CardContent>
          </Card>
        </aside>
      </section>
    </section>
  );
}
