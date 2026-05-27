import { Elysia } from "elysia";

import { Client } from "@/client";
import { ImportFileError } from "@/lib/errors";
import { Schema } from "@/zod-schemas";

import {
  requireMutationPermission,
  requireReadPermission,
} from "../middlewares/session";

/**
 * Versioned import controller.
 */
export const importsController = new Elysia({
  detail: { tags: ["Imports"] },
  prefix: "/v1/imports",
})
  .get("/template", async ({ request }) => {
    await requireReadPermission(request, "import.template_download");
    const buffer = await Client.Import.generateTemplate();

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Disposition": 'attachment; filename="smartstock-products-import-template.xlsx"',
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      status: 200,
    });
  })
  .get("/", async ({ query, request }) => {
    await requireReadPermission(request, "import.read");

    return Client.Import.list(query);
  })
  .get("/:id", async ({ params, request }) => {
    await requireReadPermission(request, "import.read");

    return Client.Import.getById(params.id);
  })
  .get("/:id/rows", async ({ params, query, request }) => {
    await requireReadPermission(request, "import.read");

    return Client.Import.listRows(params.id, query);
  })
  .get("/:id/job", async ({ params, request }) => {
    await requireReadPermission(request, "job.read");

    const batch = await Client.Import.getById(params.id);
    const jobs = await Client.JobTracking.list({
      createdBy: undefined,
      type: "IMPORT_PRODUCTS",
    });
    const relatedJob = jobs.data.find(
      (j) => (j.payload as Record<string, unknown>).batchId === params.id,
    );

    return { batch, job: relatedJob ?? null };
  })
  .post(
    "/upload",
    async ({ body, request, set }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "import.create",
      );
      const [, rawBase64 = body.dataBase64] = body.dataBase64.split(",");
      const buffer = Buffer.from(rawBase64, "base64");

      if (buffer.length !== body.fileSize) {
        throw new ImportFileError("Ukuran file import tidak sesuai.");
      }

      const context = {
        ...requestContext,
        actorUserId: session.user.id,
      };

      const { batch, tmpPath } = await Client.Import.createBatch(
        buffer,
        body.fileName,
        body.fileType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        context,
      );

      const jobRecord = await Client.JobTracking.create({
        createdBy: session.user.id,
        payload: { batchId: batch.id, tmpPath },
        type: "IMPORT_PRODUCTS",
      });

      const enqueued = await Client.Jobs.enqueueImportProducts({
        batchId: batch.id,
        createdBy: session.user.id,
        jobId: jobRecord.id,
        tmpPath,
      });

      if (!enqueued.queued) {
        Client.Import.processImport(batch.id, tmpPath, context, async (progress) => {
          await Client.JobTracking.updateProgress(jobRecord.id, progress);
        }).then(async () => {
          await Client.JobTracking.markCompleted(jobRecord.id, { batchId: batch.id });
        }).catch(async (error: unknown) => {
          const message = error instanceof Error ? error.message : "Import gagal.";
          await Client.JobTracking.markFailed(jobRecord.id, message);
        });
      }

      set.status = 201;

      return { batch, jobId: jobRecord.id, queued: enqueued.queued };
    },
    {
      body: Schema.Import.UploadImport,
    },
  );
