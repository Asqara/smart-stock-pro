import { Elysia } from "elysia";

import { Client } from "@/client";
import { Schema } from "@/zod-schemas";

import {
  requireMutationPermission,
  requireReadPermission,
} from "../middlewares/session";

/**
 * Versioned warehouse transfer controller.
 */
export const transfersController = new Elysia({
  detail: { tags: ["Transfers"] },
  prefix: "/v1/transfers",
})
  .get("/", async ({ query, request }) => {
    await requireReadPermission(request, "transfer.read");

    return Client.Transfer.list(query);
  })
  .get("/:id", async ({ params, request }) => {
    await requireReadPermission(request, "transfer.read");

    return Client.Transfer.getById(params.id);
  })
  .get("/:id/sync-logs", async ({ params, request }) => {
    await requireReadPermission(request, "sync.read");

    return Client.WarehouseSync.listByTransfer(params.id);
  })
  .post(
    "/validate",
    async ({ body, request }) => {
      await requireReadPermission(request, "transfer.validate");

      return Client.Transfer.validateTransferStock({
        items: body.items,
        sourceWarehouseId: body.sourceWarehouseId,
      });
    },
    { body: Schema.Transfer.ValidateTransfer },
  )
  .post(
    "/",
    async ({ body, request }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "transfer.create",
      );
      const context = {
        ...requestContext,
        actorUserId: session.user.id,
      };

      const result = await Client.Transfer.createAndComplete(body, context);

      const jobRecord = await Client.JobTracking.create({
        createdBy: session.user.id,
        payload: {
          destinationWarehouseId: body.destinationWarehouseId,
          sourceWarehouseId: body.sourceWarehouseId,
          transferId: result.completedTransfer.id,
        },
        type: "WAREHOUSE_SYNC",
      });

      const syncLog = await Client.WarehouseSync.createLog({
        destinationWarehouseId: body.destinationWarehouseId,
        jobId: jobRecord.id,
        message: "Sinkronisasi gudang dimulai.",
        metadata: {
          itemCount: result.createdItems.length,
          transferNumber: result.completedTransfer.transferNumber,
        },
        sourceWarehouseId: body.sourceWarehouseId,
        status: "PENDING",
        transferId: result.completedTransfer.id,
      });

      const enqueued = await Client.Jobs.enqueueWarehouseSync({
        destinationWarehouseId: body.destinationWarehouseId,
        itemCount: result.createdItems.length,
        jobId: jobRecord.id,
        sourceWarehouseId: body.sourceWarehouseId,
        syncLogId: syncLog.id,
        transferId: result.completedTransfer.id,
        transferNumber: result.completedTransfer.transferNumber,
      });

      if (!enqueued.queued) {
        await Client.WarehouseSync.markCompleted(
          syncLog.id,
          "Sinkronisasi selesai (queue tidak aktif, langsung diselesaikan).",
        );
        await Client.JobTracking.markCompleted(jobRecord.id, { fallback: true });
      }

      return {
        ...result.completedTransfer,
        items: result.createdItems,
        syncJobId: jobRecord.id,
      };
    },
    { body: Schema.Transfer.CreateTransfer },
  )
  .post("/:id/cancel", async ({ params, request }) => {
    const { requestContext, session } = await requireMutationPermission(
      request,
      "transfer.cancel",
    );

    return Client.Transfer.cancel(params.id, {
      ...requestContext,
      actorUserId: session.user.id,
    });
  });
