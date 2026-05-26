import { Elysia } from "elysia";

import { Client } from "@/client";
import { Schema } from "@/zod-schemas";

import {
  requireMutationPermission,
  requireReadPermission,
} from "./middlewares/session";

/**
 * Monitoring controller.
 */
export const monitoringController = new Elysia({ prefix: "/monitoring", detail: { tags: ["Monitoring"] } })
  .get("/health", async ({ request }) => {
    await requireReadPermission(request, "monitoring.read");

    return Client.Monitoring.getHealth();
  })
  .get("/metrics", async ({ request }) => {
    await requireReadPermission(request, "monitoring.read");

    return Client.Monitoring.listMetrics();
  })
  .get("/uptime", async ({ request }) => {
    await requireReadPermission(request, "monitoring.read_server");

    return Client.Monitoring.getUptime();
  })
  .get("/response-time", async ({ request }) => {
    await requireReadPermission(request, "monitoring.read");

    return Client.Monitoring.getResponseTime();
  })
  .get("/queues", async ({ request }) => {
    await requireReadPermission(request, "monitoring.read");

    return Client.Jobs.getQueueSummaries();
  })
  .post(
    "/check",
    async ({ request }) => {
      await requireMutationPermission(request, "monitoring.read");

      return Client.Monitoring.check();
    },
    {
      body: Schema.Alerts.MonitoringCheck,
    },
  );
