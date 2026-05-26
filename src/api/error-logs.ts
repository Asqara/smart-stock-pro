import { Elysia } from "elysia";

import { Client } from "@/client";
import { Schema } from "@/zod-schemas";

import {
  requireMutationPermission,
  requireReadPermission,
} from "./middlewares/session";

/**
 * Error log controller.
 */
export const errorLogsController = new Elysia({ prefix: "/error-logs", detail: { tags: ["Error Logs"] } })
  .get("/", async ({ query, request }) => {
    await requireReadPermission(request, "error_log.read");

    return Client.ErrorLogs.list(query);
  })
  .get("/:id", async ({ params, request }) => {
    await requireReadPermission(request, "error_log.read");

    return Client.ErrorLogs.getById(params.id);
  })
  .patch(
    "/:id/resolve",
    async ({ params, request }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "error_log.resolve",
      );

      return Client.ErrorLogs.resolve(params.id, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Alerts.ResolveError,
    },
  );
