import { openapi } from "@elysia/openapi";
import { Elysia } from "elysia";
import z from "zod";

import { Client } from "@/client";
import { ensureQueueRuntimeStarted } from "@/client/jobs";
import { AppError, UnauthorizedError } from "@/lib/errors";
import { createClearAuthCookies } from "@/lib/session";

import { internalController } from "./__internal__";
import { errorLogsController } from "./error-logs";
import { notificationsController } from "./notifications";
import { errorResponse } from "./response";
import { v1Controller } from "./v1";

const responseTimeStartMap = new WeakMap<Request, number>();

function getStatusCode(status: unknown, fallback: number) {
  if (typeof status === "number") {
    return status;
  }

  if (typeof status === "string") {
    const parsed = Number(status);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function recordApiResponseTime(request: Request, statusCode: number) {
  const start = responseTimeStartMap.get(request);

  if (start === undefined) {
    return;
  }

  responseTimeStartMap.delete(request);

  const url = new URL(request.url);
  const durationMs = performance.now() - start;

  void Client.Monitoring.recordResponseTime({
    durationMs,
    method: request.method,
    path: url.pathname,
    statusCode,
  }).catch((error) => {
    console.error("Response time metric gagal dicatat.", error);
  });
}

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
          { name: "Dashboard", description: "Dashboard, chart, alert, dan export PDF" },
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
  .onRequest(({ request }) => {
    responseTimeStartMap.set(request, performance.now());
    ensureQueueRuntimeStarted();
  })
  .onAfterHandle(({ request, set }) => {
    recordApiResponseTime(request, getStatusCode(set.status, 200));
  })
  .onError(async ({ error, request }) => {
    if (!(error instanceof AppError)) {
      try {
        await Client.ErrorLogs.logUnexpected(error, "api");
      } catch (logError) {
        console.error("Error log gagal dibuat.", logError);
      }
    }

    const response = errorResponse(error);
    recordApiResponseTime(request, response.status);

    if (error instanceof UnauthorizedError) {
      for (const cookie of createClearAuthCookies()) {
        response.headers.append("Set-Cookie", cookie);
      }
    }

    return response;
  })
  .use(internalController)
  .use(v1Controller)
  .use(notificationsController)
  .use(errorLogsController);

/**
 * Root app type used by Eden client.
 */
export type App = typeof app;
