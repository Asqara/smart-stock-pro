import { requireMutationPermission, requireReadPermission } from "./session";

/**
 * Require admin permission for read-only user management routes.
 */
export function requireAdminRead(request: Request) {
  return requireReadPermission(request, "user.read");
}

/**
 * Require admin permission for user mutation routes.
 */
export function requireAdminMutation(request: Request, permission: "user.create" | "user.update" | "user.change_role" | "user.reset_password" | "user.delete") {
  return requireMutationPermission(request, permission);
}
