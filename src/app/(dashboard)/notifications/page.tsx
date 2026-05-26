"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

import {
  Button,
  Card,
  CardContent,
  Pagination,
  SelectInput,
  StatusBadge,
} from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { eden } from "@/lib/eden";
import { formatDateTime } from "@/utils/inventoryDisplay";

type NotificationRecord = {
  createdAt: Date | string;
  id: string;
  isRead: boolean;
  message: string;
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  type: string;
};

function useNotifications(page: number, severity: string, isRead: string) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.notifications.get({
        query: {
          isRead,
          limit: "10",
          page: String(page),
          severity,
          sortBy: "createdAt",
          sortDir: "desc",
        },
      });

      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["notifications", page, severity, isRead],
  });
}

function getSeverityTone(severity: NotificationRecord["severity"]) {
  if (severity === "critical") return "stockCritical";
  if (severity === "warning") return "warning";
  if (severity === "success") return "success";

  return "info";
}

/**
 * Notification center page.
 */
export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState("");
  const [isRead, setIsRead] = useState("");
  const queryClient = useQueryClient();
  const notificationsQuery = useNotifications(page, severity, isRead);
  const notifications =
    (notificationsQuery.data?.data ?? []) as NotificationRecord[];
  const pagination = notificationsQuery.data?.pagination ?? {
    limit: 10,
    page: 1,
    pageCount: 1,
    total: 0,
  };
  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const response = await eden.api.notifications({ id }).read.patch({
        isRead: true,
      });

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notifikasi ditandai dibaca.");
    },
  });
  const markAllRead = useMutation({
    mutationFn: async () => {
      const response = await eden.api.notifications["read-all"].patch({
        isRead: true,
      });

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Semua notifikasi ditandai dibaca.");
    },
  });
  const notificationNodes = notifications.map((notification) => (
    <Card
      className={notification.isRead ? "opacity-70" : undefined}
      key={notification.id}
    >
      <CardContent>
        <section className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <section className="grid gap-2">
            <section className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={notification.severity}
                tone={getSeverityTone(notification.severity)}
              />
              <span className="ts-xs text-text-muted">
                {formatDateTime(notification.createdAt)}
              </span>
            </section>
            <section className="grid gap-1">
              <h2 className="ts-lg font-semibold text-text-strong">
                {notification.title}
              </h2>
              <p className="ts-sm text-text-muted">{notification.message}</p>
            </section>
          </section>
          <Button
            disabled={notification.isRead}
            leftIcon={<CheckCheck />}
            onClick={() => markRead.mutate(notification.id)}
            variant="secondary"
          >
            Tandai Dibaca
          </Button>
        </section>
      </CardContent>
    </Card>
  ));
  let content = notificationNodes;

  if (notificationNodes.length === 0) {
    content = [
      <Card key="empty">
        <CardContent>
          <p className="ts-sm text-text-muted">Belum ada notifikasi.</p>
        </CardContent>
      </Card>,
    ];
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Notifikasi | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <section className="grid gap-2">
          <h1 className="ts-3xl text-text-strong">Notifikasi</h1>
          <p className="ts-sm text-text-muted">
            Alert stok rendah, error sistem, dan monitoring penting.
          </p>
        </section>
        <Button leftIcon={<CheckCheck />} onClick={() => markAllRead.mutate()} variant="secondary">
          Tandai Semua Dibaca
        </Button>
      </header>
      <section className="ssp-filter-bar md:grid-cols-[200px_200px]">
        <SelectInput
          id="notification-severity"
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
            { label: "Success", value: "success" },
          ]}
          value={severity}
        />
        <SelectInput
          id="notification-read"
          label="Status"
          onValueChange={(value) => {
            setPage(1);
            setIsRead(value);
          }}
          options={[
            { label: "Semua", value: "" },
            { label: "Belum Dibaca", value: "false" },
            { label: "Dibaca", value: "true" },
          ]}
          value={isRead}
        />
      </section>
      <section className="grid gap-3">{content}</section>
      <Pagination
        currentPage={pagination.page}
        onPageChange={setPage}
        pageCount={pagination.pageCount}
      />
    </section>
  );
}
