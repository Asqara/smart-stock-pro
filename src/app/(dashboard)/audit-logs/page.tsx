"use client";

import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Filter, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

import {
  Button,
  DataTable,
  DataTableShell,
  DateInput,
  Pagination,
  SelectInput,
  StatusBadge,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextInput,
} from "@/components/ui/index";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { AUDIT_ACTIONS } from "@/constants/auth";
import { eden } from "@/lib/eden";

type AuditLogRecord = {
  action: string;
  createdAt: Date | string;
  description: string;
  entityId: string | null;
  entityType: string;
  id: string;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  userAgent: string | null;
  userId: string | null;
};

type AuditFilters = {
  action: string;
  dateFrom: string;
  dateTo: string;
  entityType: string;
  search: string;
  userId: string;
};

type AuditFilterFormProps = {
  onApply: (filters: AuditFilters) => void;
  onReset: () => void;
};

function formatLogDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function useAuditLogs(page: number, filters: AuditFilters) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1["audit-logs"].get({
        query: {
          action: filters.action,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          entityType: filters.entityType,
          limit: "10",
          page: String(page),
          search: filters.search,
          sortBy: "createdAt",
          sortDir: "desc",
          userId: filters.userId,
        },
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    queryKey: ["audit-logs", page, filters],
  });
}

function AuditFilterForm({ onApply, onReset }: AuditFilterFormProps) {
  const ACTION_OPTIONS = [
    { label: "Semua Action", value: "" },
    ...Object.values(AUDIT_ACTIONS).map((action) => ({
      label: action,
      value: action,
    })),
  ];

  const form = useForm({
    defaultValues: {
      action: "",
      entityType: "",
      search: "",
      userId: "",
      dateRange: {
        from: "",
        to: "",
      },
    },
    onSubmit: ({ value }) => {
      onApply({
        action: value.action,
        dateFrom: value.dateRange.from,
        dateTo: value.dateRange.to,
        entityType: value.entityType,
        search: value.search,
        userId: value.userId,
      });
    },
  });

  return (
    <form
      className="grid w-full min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1.2fr)_minmax(280px,1fr)_minmax(180px,1.5fr)_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="search">
        {(field) => (
          <TextInput
            id="audit-search"
            label="Cari"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            placeholder="Deskripsi"
            value={field.state.value}
          />
        )}
      </form.Field>
      
      <form.Field name="action">
        {(field) => (
          <SelectInput
            id="audit-action"
            label="Action"
            onBlur={field.handleBlur}
            onValueChange={field.handleChange}
            options={ACTION_OPTIONS}
            value={field.state.value}
          />
        )}
      </form.Field>
      
      {/* <form.Field name="entityType">
        {(field) => (
          <TextInput
            id="audit-entity"
            label="Entity"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            placeholder="user"
            value={field.state.value}
          />
        )}
      </form.Field> */}

      <form.Field name="dateRange">
        {(field) => (
          <DateInput
            mode="range"
            id="audit-date-range"
            label="Rentang Waktu"
            onBlur={field.handleBlur}
            onValueChange={field.handleChange}
            value={field.state.value}
          />
        )}
      </form.Field>

      <section className="flex items-end gap-2">
        <form.Subscribe selector={(state) => [state.isSubmitting]}>
          {([isSubmitting]) => (
            <Button disabled={isSubmitting} leftIcon={<Filter />} type="submit">
              Terapkan
            </Button>
          )}
        </form.Subscribe>
        <Button
          leftIcon={<RotateCcw />}
          onClick={() => {
            form.reset();
            onReset();
          }}
          type="button"
          variant="secondary"
        />
      </section>
    </form>
  );
}

/**
 * Admin audit log page.
 */
export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditFilters>({
    action: "",
    dateFrom: "",
    dateTo: "",
    entityType: "",
    search: "",
    userId: "",
  });
  const auditLogsQuery = useAuditLogs(page, filters);
  const logs: AuditLogRecord[] = auditLogsQuery.data?.data ?? [];
  const pagination = auditLogsQuery.data?.pagination ?? {
    limit: 10,
    page: 1,
    pageCount: 1,
    total: 0,
  };
  
  const rows = logs.map((log) => {
    const entityId = log.entityId ?? "-";
    const ipAddress = log.ipAddress ?? "-";
    const userAgent = log.userAgent ?? "-";

    return (
      <TableRow key={log.id}>
        <TableCell className="ts-mono-xs">
          {formatLogDate(log.createdAt)}
        </TableCell>
        <TableCell>
          <StatusBadge label={log.action} tone="info" />
        </TableCell>
        <TableCell>
          <section className="grid gap-1">
            <span className="font-medium text-text-strong">
              {log.description}
            </span>
            <span className="ts-mono-xs text-text-muted">
              {log.entityType}
              {" / "}
              {entityId}
            </span>
          </section>
        </TableCell>
        <TableCell className="ts-mono-xs">{ipAddress}</TableCell>
        <TableCell className="max-w-sm truncate">{userAgent}</TableCell>
        <TableCell className="ts-mono-xs">
          {JSON.stringify(log.metadata)}
        </TableCell>
      </TableRow>
    );
  });
  
  let tableBody = rows;

  if (rows.length === 0) {
    tableBody = [
      <TableRow key="empty">
        <TableCell className="text-text-muted" colSpan={6}>
          Belum ada audit log yang sesuai filter.
        </TableCell>
      </TableRow>,
    ];
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Audit Log | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="grid gap-2">
        <h1 className="ts-3xl text-text-strong">Audit Log</h1>
        <p className="ts-sm text-text-muted">
          Catatan aktivitas penting untuk login, logout, permission, dan
          perubahan user.
        </p>
      </header>
      <DataTableShell
        description={`Total ${pagination.total} audit log tercatat.`}
        footer={
          <Pagination
            currentPage={pagination.page}
            onPageChange={setPage}
            pageCount={pagination.pageCount}
          />
        }
        title="Riwayat Audit"
        toolbar={
          <AuditFilterForm
            onApply={(nextFilters) => {
              setPage(1);
              setFilters(nextFilters);
            }}
            onReset={() => {
              setPage(1);
              setFilters({
                action: "",
                dateFrom: "",
                dateTo: "",
                entityType: "",
                search: "",
                userId: "",
              });
            }}
          />
        }
      >
        <DataTable dense>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>User Agent</TableHead>
              <TableHead>Metadata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{tableBody}</TableBody>
        </DataTable>
      </DataTableShell>
    </section>
  );
}