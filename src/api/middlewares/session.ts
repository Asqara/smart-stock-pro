import "server-only";

import { Elysia } from "elysia";

import { validateSession } from "@/lib/auth";
import { COOKIES } from "@/constants/cookies";
import { UnauthorizedError } from "@/lib/errors";

/**
 * Resolves the current session from the request cookie.
 * Attaches `session` and `user` to context, or `null` if absent/invalid.
 */
export const sessionMiddleware = new Elysia().resolve(
  { as: "scoped" },
  async ({ request, cookie: { [COOKIES.session]: token } }) => {
    if (!token.cookie.value) return { session: null, user: null };

    const result = await validateSession(token.cookie.value as string);
    if (!result) return { session: null, user: null };

    return { session: result.session, user: result.user };
  },
);

/**
 * Variant that throws `UnauthorizedError` when no valid session is present.
 */
export const requireSessionMiddleware = new Elysia().resolve(
  { as: "scoped" },
  async ({ request, cookie: { [COOKIES.session]: token } }) => {
    if (!token.cookie.value) throw new UnauthorizedError();

    const result = await validateSession(token.cookie.value as string);
    if (!result) throw new UnauthorizedError();

    return { session: result.session, user: result.user };
  },
);
