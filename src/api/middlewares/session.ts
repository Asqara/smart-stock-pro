import type { Permission } from "@/constants/auth";
import { Client } from "@/client";
import type { AuthSession } from "@/client/types";
import { getRequestContext, type RequestContext } from "@/lib/request";

/**
 * Authenticated API context.
 */
export type ApiAuthContext = {
  requestContext: RequestContext;
  session: AuthSession;
};

/**
 * Require an active session from a request.
 */
export async function requireSession(request: Request): Promise<ApiAuthContext> {
  return {
    requestContext: getRequestContext(request),
    session: await Client.Auth.authenticateRequest(request),
  };
}

/**
 * Require session, CSRF token, and permission for a mutating request.
 */
export async function requireMutationPermission(
  request: Request,
  permission: Permission,
): Promise<ApiAuthContext> {
  const authContext = await requireSession(request);

  Client.Auth.verifyCsrf(request, authContext.session);
  await Client.Auth.requirePermission(authContext.session, permission, {
    ...authContext.requestContext,
    actorUserId: authContext.session.user.id,
  });

  return authContext;
}

/**
 * Require session and permission for a read request.
 */
export async function requireReadPermission(
  request: Request,
  permission: Permission,
): Promise<ApiAuthContext> {
  const authContext = await requireSession(request);

  await Client.Auth.requirePermission(authContext.session, permission, {
    ...authContext.requestContext,
    actorUserId: authContext.session.user.id,
  });

  return authContext;
}
