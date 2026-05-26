import { Elysia } from "elysia";

import { Client } from "@/client";

import { requireReadPermission, requireSession } from "../middlewares/session";

/**
 * Versioned audit log controller.
 */
export const auditLogsController = new Elysia({ prefix: "/v1/audit-logs", detail: { tags: ["Audit Logs"] } })
  .get("/", async ({ query, request }) => {
    await requireReadPermission(request, "audit_log.read");

    return Client.AuditLogs.list(query);
  })
  .get("/me", async ({ query, request }) => {
    const { session } = await requireSession(request);

    return Client.AuditLogs.listForUser(session.user.id, query);
  });
