import { Elysia } from "elysia";

import { Client } from "@/client";

/**
 * Internal API controller for app health checks and shared utilities.
 */
export const internalController = new Elysia({ prefix: "/__internal__" })
  .get("/health", () => ({
    ok: true,
    service: "SmartStock Pro API",
  }))
  .get("/users/template", async () => {
    const buffer = await Client.Users.generateXlsxTemplate();

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Disposition": 'attachment; filename="user-template.xlsx"',
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  });
