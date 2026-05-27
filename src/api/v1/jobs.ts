import { Elysia } from "elysia";

import { Client } from "@/client";
import { ValidationAppError } from "@/lib/errors";

import {
  requireMutationPermission,
  requireReadPermission,
} from "../middlewares/session";

/**
 * Versioned background job controller.
 */
export const jobsController = new Elysia({
  detail: { tags: ["Jobs"] },
  prefix: "/v1/jobs",
})
  .get("/", async ({ query, request }) => {
    await requireReadPermission(request, "job.read");

    return Client.JobTracking.list(query);
  })
  .get("/:id", async ({ params, request }) => {
    await requireReadPermission(request, "job.read");

    return Client.JobTracking.getById(params.id);
  })
  .post("/:id/retry", async ({ params, request }) => {
    const { requestContext, session } = await requireMutationPermission(
      request,
      "job.retry",
    );
    const context = {
      ...requestContext,
      actorUserId: session.user.id,
    };

    const job = await Client.JobTracking.getById(params.id);
    if (job.status !== "FAILED") {
      throw new ValidationAppError("Hanya job yang gagal yang dapat diulang.");
    }

    const payload = job.payload as Record<string, unknown>;

    if (job.type === "IMPORT_PRODUCTS" && typeof payload.batchId === "string" && typeof payload.tmpPath === "string") {
      const newJob = await Client.JobTracking.create({
        createdBy: session.user.id,
        payload: job.payload,
        type: "IMPORT_PRODUCTS",
      });
      const enqueued = await Client.Jobs.enqueueImportProducts({
        batchId: payload.batchId,
        createdBy: session.user.id,
        jobId: newJob.id,
        tmpPath: payload.tmpPath,
      });

      return { job: newJob, queued: enqueued.queued };
    }

    if (
      (job.type === "GENERATE_INVENTORY_REPORT" || job.type === "GENERATE_MOVEMENT_REPORT") &&
      typeof payload.reportExportId === "string"
    ) {
      const newJob = await Client.JobTracking.create({
        createdBy: session.user.id,
        payload: job.payload,
        type: job.type,
      });
      const enqueued = await Client.Jobs.enqueueGenerateReport({
        createdBy: session.user.id,
        filters: (payload.filters as Record<string, unknown>) ?? {},
        jobId: newJob.id,
        outputFormat: (payload.outputFormat as "PDF" | "CSV") ?? "PDF",
        reportExportId: payload.reportExportId,
        reportType: (payload.reportType as string) ?? "INVENTORY_SUMMARY",
      });

      return { job: newJob, queued: enqueued.queued };
    }

    throw new ValidationAppError("Tipe job ini tidak dapat diulang secara otomatis.");
  });
