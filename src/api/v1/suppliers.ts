import { Elysia } from "elysia";

import { Client } from "@/client";
import { Schema } from "@/zod-schemas";

import {
  requireMutationPermission,
  requireReadPermission,
} from "../middlewares/session";

/**
 * Versioned supplier controller.
 */
export const suppliersController = new Elysia({ prefix: "/v1/suppliers", detail: { tags: ["Inventory"] } })
  .get("/", async ({ query, request }) => {
    await requireReadPermission(request, "supplier.read");

    return Client.Inventory.Suppliers.list(query);
  })
  .get("/:id", async ({ params, request }) => {
    await requireReadPermission(request, "supplier.read");

    return Client.Inventory.Suppliers.getById(params.id);
  })
  .post(
    "/",
    async ({ body, request }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "supplier.create",
      );

      return Client.Inventory.Suppliers.create(body, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Inventory.CreateSupplier,
    },
  )
  .patch(
    "/:id",
    async ({ body, params, request }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "supplier.update",
      );

      return Client.Inventory.Suppliers.update(params.id, body, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Inventory.UpdateSupplier,
    },
  )
  .delete("/:id", async ({ params, request }) => {
    const { requestContext, session } = await requireMutationPermission(
      request,
      "supplier.delete",
    );

    return Client.Inventory.Suppliers.deactivate(params.id, {
      ...requestContext,
      actorUserId: session.user.id,
    });
  });
