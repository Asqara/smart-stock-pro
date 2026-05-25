import "server-only";

import { Elysia } from "elysia";

import { validateSession } from "@/lib/auth";
import { COOKIES } from "@/constants/cookies";
import { USER_ROLE } from "@/constants/users";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

/**
 * Validates session AND checks admin/superadmin role in one resolve.
 * Self-contained — does not depend on `requireSessionMiddleware`.
 */
export const requireAdminMiddleware = new Elysia().resolve(
  { as: "scoped" },
  async ({ cookie: { [COOKIES.session]: token } }) => {
    if (!token.cookie.value) throw new UnauthorizedError();

    const result = await validateSession(token.cookie.value as string);
    if (!result) throw new UnauthorizedError();

    if (
      result.user.role !== USER_ROLE.ADMIN &&
      result.user.role !== USER_ROLE.SUPERADMIN
    ) {
      throw new ForbiddenError("Akses hanya untuk admin");
    }

    return { session: result.session, user: result.user };
  },
);
