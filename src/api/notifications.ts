import { Elysia } from "elysia";

import { Client } from "@/client";
import { Schema } from "@/zod-schemas";

import {
  requireMutationPermission,
  requireReadPermission,
} from "./middlewares/session";

/**
 * In-app notification controller.
 */
export const notificationsController = new Elysia({ prefix: "/notifications", detail: { tags: ["Notifications"] } })
  .get("/", async ({ query, request }) => {
    const { session } = await requireReadPermission(
      request,
      "notification.read",
    );

    return Client.Notifications.list(query, {
      role: session.user.role,
      userId: session.user.id,
    });
  })
  .get("/unread-count", async ({ request }) => {
    const { session } = await requireReadPermission(
      request,
      "notification.read",
    );

    return Client.Notifications.getUnreadNotificationCount({
      role: session.user.role,
      userId: session.user.id,
    });
  })
  .patch(
    "/read-all",
    async ({ request }) => {
      const { session } = await requireMutationPermission(
        request,
        "notification.mark_read",
      );

      return Client.Notifications.markAllAsRead({
        role: session.user.role,
        userId: session.user.id,
      });
    },
    {
      body: Schema.Alerts.MarkNotificationRead,
    },
  )
  .patch(
    "/:id/read",
    async ({ params, request }) => {
      const { session } = await requireMutationPermission(
        request,
        "notification.mark_read",
      );

      return Client.Notifications.markAsRead(params.id, {
        role: session.user.role,
        userId: session.user.id,
      });
    },
    {
      body: Schema.Alerts.MarkNotificationRead,
    },
  );
