import { Elysia } from "elysia";

import { Client } from "@/client";
import { Schema } from "@/zod-schemas";

import {
  requireMutationPermission,
  requireReadPermission,
} from "../middlewares/session";

/**
 * Versioned product inventory controller.
 */
export const productsController = new Elysia({ prefix: "/v1/products", detail: { tags: ["Inventory"] } })
  .get("/search", async ({ query, request }) => {
    await requireReadPermission(request, "product.read");

    return Client.Inventory.Products.search(query);
  })
  .get("/", async ({ query, request }) => {
    await requireReadPermission(request, "product.read");

    return Client.Inventory.Products.list(query);
  })
  .get("/:id", async ({ params, request }) => {
    await requireReadPermission(request, "product.read");

    return Client.Inventory.Products.getById(params.id);
  })
  .get("/:id/stock", async ({ params, request }) => {
    await requireReadPermission(request, "stock.read");

    return Client.Inventory.Products.getStockSummary(params.id);
  })
  .post(
    "/",
    async ({ body, request }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "product.create",
      );

      return Client.Inventory.Products.create(body, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Inventory.CreateProduct,
    },
  )
  .patch(
    "/:id",
    async ({ body, params, request }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "product.update",
      );

      return Client.Inventory.Products.update(params.id, body, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Inventory.UpdateProduct,
    },
  )
  .delete("/:id", async ({ params, request }) => {
    const { requestContext, session } = await requireMutationPermission(
      request,
      "product.delete",
    );

    return Client.Inventory.Products.deactivate(params.id, {
      ...requestContext,
      actorUserId: session.user.id,
    });
  });
