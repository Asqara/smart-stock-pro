import { Elysia } from "elysia";

import { Client } from "@/client";

import { requireReadPermission } from "../middlewares/session";

/**
 * Versioned warehouse sync log controller.
 */
export const syncController = new Elysia({
  detail: { tags: ["Sync"] },
  prefix: "/v1/sync",
})
  .get("/logs", async ({ query, request }) => {
    await requireReadPermission(request, "sync.read");

    return Client.WarehouseSync.list(query);
  })
  .get("/logs/:id", async ({ params, request }) => {
    await requireReadPermission(request, "sync.read");

    return Client.WarehouseSync.getById(params.id);
  });
