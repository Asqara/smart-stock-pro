import { Elysia } from "elysia";

import { Client } from "@/client";
import { Schema } from "@/zod-schemas";

import {
  requireMutationPermission,
  requireReadPermission,
} from "../middlewares/session";

/**
 * Versioned category controller.
 */
export const categoriesController = new Elysia({ prefix: "/v1/categories", detail: { tags: ["Inventory"] } })
  .get("/", async ({ query, request }) => {
    await requireReadPermission(request, "category.read");

    return Client.Inventory.Categories.list(query);
  })
  .get("/:id", async ({ params, request }) => {
    await requireReadPermission(request, "category.read");

    return Client.Inventory.Categories.getById(params.id);
  })
  .post(
    "/",
    async ({ body, request }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "category.create",
      );

      return Client.Inventory.Categories.create(body, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Inventory.CreateCategory,
    },
  )
  .patch(
    "/:id",
    async ({ body, params, request }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "category.update",
      );

      return Client.Inventory.Categories.update(params.id, body, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Inventory.UpdateCategory,
    },
  )
  .delete("/:id", async ({ params, request }) => {
    const { requestContext, session } = await requireMutationPermission(
      request,
      "category.delete",
    );

    return Client.Inventory.Categories.deactivate(params.id, {
      ...requestContext,
      actorUserId: session.user.id,
    });
  });
