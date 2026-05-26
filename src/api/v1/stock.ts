import { Elysia } from "elysia";

import { Client } from "@/client";
import { Schema } from "@/zod-schemas";

import {
  requireMutationPermission,
  requireReadPermission,
} from "../middlewares/session";

/**
 * Versioned stock ledger controller.
 */
export const stockController = new Elysia({ prefix: "/v1/stock", detail: { tags: ["Stock"] } })
  .get("/movements", async ({ query, request }) => {
    await requireReadPermission(request, "stock.read_movements");

    return Client.Inventory.Stock.listMovements(query);
  })
  .get("/summary", async ({ request }) => {
    await requireReadPermission(request, "stock.read");

    return Client.Inventory.Stock.getSummary();
  })
  .get("/products/:productId", async ({ params, request }) => {
    await requireReadPermission(request, "stock.read");

    return Client.Inventory.Stock.calculateStockByProduct(params.productId);
  })
  .get("/warehouses/:warehouseId", async ({ params, request }) => {
    await requireReadPermission(request, "stock.read");

    return Client.Inventory.Stock.calculateStockByWarehouse(params.warehouseId);
  })
  .post(
    "/in",
    async ({ body, request }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "stock.in",
      );

      return Client.Inventory.Stock.createStockIn(body, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Inventory.StockIn,
    },
  )
  .post(
    "/out",
    async ({ body, request }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "stock.out",
      );

      return Client.Inventory.Stock.createStockOut(body, {
        ...requestContext,
        actorUserId: session.user.id,
      });
    },
    {
      body: Schema.Inventory.StockOut,
    },
  );
