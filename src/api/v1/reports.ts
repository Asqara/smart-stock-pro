import { Elysia } from "elysia";

import { Client } from "@/client";
import { Schema } from "@/zod-schemas";

import {
  requireMutationPermission,
  requireReadPermission,
  requireSession,
} from "../middlewares/session";

/**
 * Versioned report generation controller.
 */
export const reportsController = new Elysia({
  detail: { tags: ["Reports"] },
  prefix: "/v1/reports",
})
  .get("/", async ({ query, request }) => {
    await requireReadPermission(request, "report.read");

    return Client.Report.list(query);
  })
  .get("/:id", async ({ params, request }) => {
    await requireReadPermission(request, "report.read");

    return Client.Report.getById(params.id);
  })
  .get("/:id/download", async ({ params, request, set }) => {
    await requireReadPermission(request, "report.download");

    const record = await Client.Report.getById(params.id);
    if (record.status !== "COMPLETED") {
      set.status = 400;

      return { error: "Laporan belum selesai diproses." };
    }

    const isCSV = record.fileName.endsWith(".csv");
    const filter = record.filter as Record<string, string | null | undefined>;
    const { session } = await requireSession(request);

    let buffer: Buffer;
    if (isCSV) {
      buffer = await Client.Report.buildCsv(record.type, filter);
    } else {
      buffer = await Client.Report.buildPdf(
        record.type,
        filter,
        session.user.name,
      );
    }

    set.headers["Content-Type"] = isCSV ? "text/csv" : "application/pdf";
    set.headers["Content-Disposition"] = `attachment; filename="${record.fileName}"`;

    return buffer;
  })
  .post(
    "/generate",
    async ({ body, request, set }) => {
      const { requestContext, session } = await requireMutationPermission(
        request,
        "report.generate",
      );
      const context = {
        ...requestContext,
        actorUserId: session.user.id,
      };

      const jobRecord = await Client.JobTracking.create({
        createdBy: session.user.id,
        payload: {
          filters: body.filters ?? {},
          outputFormat: body.outputFormat,
          reportType: body.reportType,
        },
        type:
          body.reportType === "STOCK_MOVEMENT"
            ? "GENERATE_MOVEMENT_REPORT"
            : "GENERATE_INVENTORY_REPORT",
      });

      const reportRecord = await Client.Report.createExportRecord(
        {
          filters: (body.filters ?? {}) as Record<string, string | null | undefined>,
          outputFormat: body.outputFormat as "PDF" | "CSV",
          reportType: body.reportType,
        },
        jobRecord.id,
        context,
      );

      const enqueued = await Client.Jobs.enqueueGenerateReport({
        createdBy: session.user.id,
        filters: (body.filters ?? {}) as Record<string, unknown>,
        jobId: jobRecord.id,
        outputFormat: body.outputFormat as "PDF" | "CSV",
        reportExportId: reportRecord.id,
        reportType: body.reportType,
      });

      if (!enqueued.queued) {
        Client.Report.buildPdf(
          body.reportType as any,
          (body.filters ?? {}) as any,
          session.user.name,
        ).then(async () => {
          await Client.Report.markCompleted(reportRecord.id);
          await Client.JobTracking.markCompleted(jobRecord.id, { reportId: reportRecord.id });
          await Client.Report.notifyCompleted(reportRecord.id, body.reportType as any, session.user.id);
        }).catch(async (error: unknown) => {
          const message = error instanceof Error ? error.message : "Laporan gagal dibuat.";
          await Client.Report.markFailed(reportRecord.id);
          await Client.JobTracking.markFailed(jobRecord.id, message);
          await Client.Report.notifyFailed(reportRecord.id, body.reportType as any, session.user.id);
        });
      }

      set.status = 201;

      return { jobId: jobRecord.id, reportId: reportRecord.id, queued: enqueued.queued };
    },
    { body: Schema.Report.GenerateReport },
  );
