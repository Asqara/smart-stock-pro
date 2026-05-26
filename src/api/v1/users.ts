import { Elysia } from "elysia";

import { Client } from "@/client";
import { Schema } from "@/zod-schemas";

import { requireAdminMutation, requireAdminRead } from "../middlewares/admin";

/**
 * Versioned user management controller.
 */
export const usersController = new Elysia({ prefix: "/v1/users", detail: { tags: ["Users"] } })
  .get("/", async ({ query, request }) => {
    await requireAdminRead(request);

    return Client.Users.list(query);
  })
  .post(
    "/",
    async ({ body, request }) => {
      const { requestContext, session } = await requireAdminMutation(
        request,
        "user.create",
      );

      return Client.Users.create(body, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Users.Create,
    },
  )
  .patch(
    "/:id",
    async ({ body, params, request }) => {
      const { requestContext, session } = await requireAdminMutation(
        request,
        "user.update",
      );

      return Client.Users.update(params.id, body, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Users.Update,
    },
  )
  .patch(
    "/:id/role",
    async ({ body, params, request }) => {
      const { requestContext, session } = await requireAdminMutation(
        request,
        "user.change_role",
      );

      return Client.Users.changeRole(params.id, body.role, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Users.ChangeRole,
    },
  )
  .patch(
    "/:id/password",
    async ({ body, params, request }) => {
      const { requestContext, session } = await requireAdminMutation(
        request,
        "user.reset_password",
      );

      return Client.Users.resetPassword(params.id, body.password, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Users.ResetPassword,
    },
  )
  .patch(
    "/:id/status",
    async ({ body, params, request }) => {
      const { requestContext, session } = await requireAdminMutation(
        request,
        "user.delete",
      );

      return Client.Users.changeStatus(params.id, body.isActive, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Users.ChangeStatus,
    },
  )
  .post(
    "/bulk",
    async ({ body, request }) => {
      const { requestContext, session } = await requireAdminMutation(
        request,
        "user.create",
      );

      const buffer = Buffer.from(body.file, "base64");

      return Client.Users.importFromXlsx(buffer, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Users.BulkImport,
    },
  );
