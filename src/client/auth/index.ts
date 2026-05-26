import { and, eq, isNull } from "drizzle-orm";

import {
  AUDIT_ACTIONS,
  CSRF_HEADER_NAME,
  type Permission,
} from "@/constants/auth";
import { sessions, users } from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import {
  AuthenticationError,
  CsrfError,
  ForbiddenError,
  InactiveAccountError,
  UnauthorizedError,
} from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createSecurityToken,
  getCsrfTokenFromRequest,
  getSessionTokenFromRequest,
  hashSecurityToken,
  safeCompareHash,
} from "@/lib/session";
import {
  createSessionExpiry,
  isSessionExpired,
  renewIdleExpiry,
} from "@/utils/sessionTimeout";
import { getPermissionsForRole, hasPermission } from "@/utils/permissions";

import { AuditLogs } from "../audit-logs";
import type { AuditContext, AuthSession, PublicUser } from "../types";
import { toPublicUser } from "../types";

type LoginInput = {
  email: string;
  password: string;
};

type LoginResult = {
  csrfToken: string;
  expiresAt: Date;
  idleExpiresAt: Date;
  sessionToken: string;
  user: PublicUser;
};

function withPermissions(user: PublicUser): PublicUser {
  return {
    ...user,
    permissions: getPermissionsForRole(user.role),
  };
}

/**
 * Business logic for authentication and session security.
 */
export class Auth {
  /**
   * Login with email and password, then create a secure server session.
   */
  static async login(
    input: LoginInput,
    context: AuditContext,
  ): Promise<LoginResult> {
    const email = input.email.toLowerCase();
    const [user] = await dbRead
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      await AuditLogs.create(
        {
          action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
          description: `Login gagal untuk ${email}.`,
          entityType: "auth",
          metadata: { email },
        },
        context,
      );

      throw new AuthenticationError();
    }

    if (!user.isActive) {
      await AuditLogs.create(
        {
          action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
          description: `Login gagal karena akun ${email} nonaktif.`,
          entityId: user.id,
          entityType: "user",
          metadata: { email, reason: "inactive_account" },
        },
        {
          ...context,
          actorUserId: user.id,
        },
      );

      throw new InactiveAccountError();
    }

    const isPasswordValid = await verifyPassword(
      user.passwordHash,
      input.password,
    );

    if (!isPasswordValid) {
      await AuditLogs.create(
        {
          action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
          description: `Login gagal untuk ${email}.`,
          entityId: user.id,
          entityType: "user",
          metadata: { email, reason: "invalid_password" },
        },
        context,
      );

      throw new AuthenticationError();
    }

    const now = new Date();
    const sessionToken = createSecurityToken();
    const csrfToken = createSecurityToken();
    const expiry = createSessionExpiry(now);
    const [session] = await db
      .insert(sessions)
      .values({
        csrfTokenHash: hashSecurityToken(csrfToken),
        expiresAt: expiry.expiresAt,
        idleExpiresAt: expiry.idleExpiresAt,
        ipAddress: context.ipAddress,
        sessionTokenHash: hashSecurityToken(sessionToken),
        userAgent: context.userAgent,
        userId: user.id,
      })
      .returning();

    await db
      .update(users)
      .set({
        lastLoginAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
        description: `${user.name} login ke SmartStock Pro.`,
        entityId: session.id,
        entityType: "session",
        metadata: { email },
      },
      {
        ...context,
        actorUserId: user.id,
      },
    );

    return {
      csrfToken,
      expiresAt: session.expiresAt,
      idleExpiresAt: session.idleExpiresAt,
      sessionToken,
      user: withPermissions(toPublicUser({ ...user, lastLoginAt: now })),
    };
  }

  /**
   * Validate session cookie and return authenticated user context.
   */
  static async authenticateRequest(request: Request): Promise<AuthSession> {
    const sessionToken = getSessionTokenFromRequest(request);

    if (!sessionToken) {
      throw new UnauthorizedError();
    }

    const [row] = await dbRead
      .select({
        session: sessions,
        user: users,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.sessionTokenHash, hashSecurityToken(sessionToken)),
          isNull(sessions.revokedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new UnauthorizedError();
    }

    const now = new Date();

    if (isSessionExpired(row.session, now)) {
      await db
        .update(sessions)
        .set({
          revokedAt: now,
          updatedAt: now,
        })
        .where(eq(sessions.id, row.session.id));

      throw new UnauthorizedError();
    }

    if (!row.user.isActive) {
      await db
        .update(sessions)
        .set({
          revokedAt: now,
          updatedAt: now,
        })
        .where(eq(sessions.id, row.session.id));

      throw new InactiveAccountError();
    }

    const idleExpiresAt = renewIdleExpiry(row.session.expiresAt, now);
    await db
      .update(sessions)
      .set({
        idleExpiresAt,
        updatedAt: now,
      })
      .where(eq(sessions.id, row.session.id));

    const publicUser = withPermissions(toPublicUser(row.user));

    return {
      csrfTokenHash: row.session.csrfTokenHash,
      expiresAt: row.session.expiresAt,
      id: row.session.id,
      idleExpiresAt,
      permissions: publicUser.permissions,
      user: publicUser,
      userId: row.user.id,
    };
  }

  /**
   * Verify CSRF token for a mutating request.
   */
  static verifyCsrf(request: Request, session: AuthSession): void {
    const csrfToken = getCsrfTokenFromRequest(request);

    if (!csrfToken) {
      throw new CsrfError();
    }

    const incomingHash = hashSecurityToken(csrfToken);

    if (!safeCompareHash(incomingHash, session.csrfTokenHash)) {
      throw new CsrfError();
    }
  }

  /**
   * Require one permission from an authenticated session.
   */
  static async requirePermission(
    session: AuthSession,
    permission: Permission,
    context: AuditContext,
  ): Promise<void> {
    if (hasPermission(session.user.role, permission)) {
      return;
    }

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.ACCESS_DENIED,
        description: `${session.user.name} ditolak saat mengakses ${permission}.`,
        entityType: "permission",
        metadata: { permission },
      },
      {
        ...context,
        actorUserId: session.user.id,
      },
    );

    throw new ForbiddenError();
  }

  /**
   * Logout by revoking current session.
   */
  static async logout(
    session: AuthSession,
    context: AuditContext,
  ): Promise<void> {
    const now = new Date();

    await db
      .update(sessions)
      .set({
        revokedAt: now,
        updatedAt: now,
      })
      .where(eq(sessions.id, session.id));

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.AUTH_LOGOUT,
        description: `${session.user.name} logout dari SmartStock Pro.`,
        entityId: session.id,
        entityType: "session",
      },
      {
        ...context,
        actorUserId: session.user.id,
      },
    );
  }

  /**
   * Hash password for seed and user-management flows.
   */
  static hashPassword(password: string): Promise<string> {
    return hashPassword(password);
  }
}
