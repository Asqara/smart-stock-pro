import { openapi } from "@elysia/openapi";
import { Elysia } from "elysia";
import z from "zod";

import { Client } from "@/client";
import { ensureQueueRuntimeStarted } from "@/client/jobs";
import { AppError } from "@/lib/errors";

import { internalController } from "./__internal__";
import { errorLogsController } from "./error-logs";
import { monitoringController } from "./monitoring";
import { notificationsController } from "./notifications";
import { errorResponse } from "./response";
import { v1Controller } from "./v1";

/**
 * Root Elysia application. Mounted by the Next.js catch-all route handler.
 */
export const app = new Elysia({ prefix: "/api" })
  .use(
    openapi({
      path: "/v1/docs",
      documentation: {
        info: {
          title: "SmartStock Pro API",
          version: "1.0.0",
          description:
            "REST API SmartStock Pro — sistem manajemen inventaris PT Maju Bersama Digital.",
        },
        tags: [
          { name: "Auth", description: "Autentikasi dan session" },
          { name: "Users", description: "Manajemen user" },
          { name: "Inventory", description: "Produk, kategori, supplier, dan gudang" },
          { name: "Stock", description: "Pergerakan stok" },
          { name: "Notifications", description: "Notifikasi in-app" },
          { name: "Error Logs", description: "Log error aplikasi" },
          { name: "Audit Logs", description: "Jejak audit sistem" },
          { name: "Monitoring", description: "Kesehatan dan metrik sistem" },
        ],
        servers: [{ url: "http://localhost:3000" }],
      },
      mapJsonSchema: {
        zod: z.toJSONSchema,
      },
      scalar: {
        theme: "kepler",
        url: "/api/v1/docs/json",
        defaultHttpClient: {
          targetKey: "javascript",
          clientKey: "fetch",
        },
      },
    }),
  )
  .onRequest(() => {
    ensureQueueRuntimeStarted();
  })
  .onError(async ({ error }) => {
    if (!(error instanceof AppError)) {
      try {
        await Client.ErrorLogs.logUnexpected(error, "api");
      } catch (logError) {
        console.error("Error log gagal dibuat.", logError);
      }
    }

    return errorResponse(error);
  })
  .use(internalController)
  .use(v1Controller)
  .use(notificationsController)
  .use(errorLogsController)
  .use(monitoringController);

/**
 * Root app type used by Eden client.
 */
export type App = typeof app;
