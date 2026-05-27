import { Elysia } from "elysia";

import { Client } from "@/client";
import { Schema } from "@/zod-schemas";

import {
  requireMutationPermission,
  requireReadPermission,
} from "../middlewares/session";

/**
 * Versioned warehouse controller.
 */
export const warehousesController = new Elysia({ prefix: "/v1/warehouses", detail: { tags: ["Inventory"] } })
  .get("/", async ({ query, request }) => {
    await requireReadPermission(request, "warehouse.read");

    return Client.Inventory.Warehouses.list(query);
  })
  .get("/map", async ({ request }) => {
    await requireReadPermission(request, "warehouse.read_map");

    return Client.Inventory.Warehouses.getWarehouseMapData();
  })
  .get("/:id/map-summary", async ({ params, request }) => {
    await requireReadPermission(request, "warehouse.read_stock");

    return Client.Inventory.Warehouses.getWarehouseStockSummaryForMap(params.id);
  })
  .get("/:id", async ({ params, request }) => {
    await requireReadPermission(request, "warehouse.read");

    return Client.Inventory.Warehouses.getById(params.id);
  })
  .get("/:id/stock", async ({ params, request }) => {
    await requireReadPermission(request, "stock.read");

    return Client.Inventory.Warehouses.getStockSummary(params.id);
  })
  .post(
    "/",
    async ({ body, request }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "warehouse.create",
      );

      return Client.Inventory.Warehouses.create(body, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Inventory.CreateWarehouse,
    },
  )
  .patch(
    "/:id",
    async ({ body, params, request }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "warehouse.update",
      );

      return Client.Inventory.Warehouses.update(params.id, body, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Inventory.UpdateWarehouse,
    },
  )
  .delete("/:id", async ({ params, request }) => {
    const { requestContext, session } = await requireMutationPermission(
      request,
      "warehouse.delete",
    );

    return Client.Inventory.Warehouses.deactivate(params.id, {
      ...requestContext,
      actorUserId: session.user.id,
    });
  });
