import { Elysia } from "elysia";

import { Client } from "@/client";
import { createAuthCookies, createClearAuthCookies } from "@/lib/session";
import { getRequestContext } from "@/lib/request";
import { UnauthorizedError } from "@/lib/errors";
import { Schema } from "@/zod-schemas";

import { jsonResponse } from "../response";
import { requireSession } from "../middlewares/session";

/**
 * Versioned auth controller.
 */
export const authController = new Elysia({ prefix: "/v1/auth", detail: { tags: ["Auth"] } })
  .post(
    "/login",
    async ({ body, request }) => {
      const result = await Client.Auth.login(body, getRequestContext(request));

      return jsonResponse(
        {
          csrfToken: result.csrfToken,
          expiresAt: result.expiresAt,
          idleExpiresAt: result.idleExpiresAt,
          user: result.user,
        },
        200,
        createAuthCookies(result.sessionToken, result.csrfToken),
      );
    },
    {
      body: Schema.Auth.Login,
    },
  )
  .post(
    "/logout",
    async ({ request }) => {
      try {
        const { requestContext, session } = await requireSession(request);

        Client.Auth.verifyCsrf(request, session);
        await Client.Auth.logout(session, {
          ...requestContext,
          actorUserId: session.user.id,
        });

        return jsonResponse(
          {
            message: "Logout berhasil.",
          },
          200,
          createClearAuthCookies(),
        );
      } catch (error) {
        if (!(error instanceof UnauthorizedError)) {
          throw error;
        }

        return jsonResponse(
          {
            message: "Logout berhasil.",
          },
          200,
          createClearAuthCookies(),
        );
      }
    },
    {
      body: Schema.Auth.Logout,
    },
  )
  .get("/me", async ({ request }) => {
    const { session } = await requireSession(request);

    return {
      expiresAt: session.expiresAt,
      idleExpiresAt: session.idleExpiresAt,
      user: session.user,
    };
  });
