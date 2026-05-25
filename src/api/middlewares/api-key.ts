import "server-only";

import { Elysia } from "elysia";

import { ApiKey } from "@/client/api-key";

/** Resolves merchant API key context from Authorization Bearer header. */
export const apiKeyMiddleware = new Elysia().resolve(
  { as: "scoped" },
  async ({ request }) => {
    return ApiKey.verifyBearer(request.headers.get("authorization"));
  },
);
