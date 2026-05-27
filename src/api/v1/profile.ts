import { Elysia } from "elysia";

import { Client } from "@/client";
import { Schema } from "@/zod-schemas";

import {
  requireMutationPermission,
  requireReadPermission,
} from "../middlewares/session";

/**
 * Versioned profile controller for current user self-service.
 */
export const profileController = new Elysia({
  detail: { tags: ["Profile"] },
  prefix: "/v1/profile",
})
  .get("/", async ({ request }) => {
    const { session } = await requireReadPermission(request, "profile.read");

    return Client.Profile.getProfile(session);
  })
  .get("/activity", async ({ query, request }) => {
    const { session } = await requireReadPermission(
      request,
      "profile.activity.read",
    );

    return Client.AuditLogs.listForUser(session.user.id, query);
  })
  .patch(
    "/",
    async ({ body, request }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "profile.update",
      );

      return Client.Profile.updateProfile(session, body, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Profile.Update,
    },
  )
  .patch(
    "/password",
    async ({ body, request }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "profile.change_password",
      );

      return Client.Profile.changePassword(session, body, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Profile.ChangePassword,
    },
  );
