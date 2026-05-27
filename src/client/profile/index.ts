import "server-only";

import { and, eq, isNull, ne } from "drizzle-orm";

import { AUDIT_ACTIONS } from "@/constants/auth";
import { sessions, users } from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import { NotFoundAppError, ValidationAppError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";

import { AuditLogs } from "../audit-logs";
import type { AuditContext, AuthSession } from "../types";
import { toPublicUser } from "../types";

type UpdateProfileInput = {
  name: string;
};

type ChangePasswordInput = {
  confirmPassword: string;
  currentPassword: string;
  newPassword: string;
};

/**
 * Business logic for self-service profile, password, and account activity.
 */
export class Profile {
  /**
   * Get current user profile.
   */
  static async getProfile(session: AuthSession) {
    const [user] = await dbRead
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      throw new NotFoundAppError("Profil tidak ditemukan.");
    }

    return toPublicUser(user);
  }

  /**
   * Update current user name. Email and role are not user-editable.
   */
  static async updateProfile(
    session: AuthSession,
    input: UpdateProfileInput,
    context: AuditContext,
  ) {
    const [current] = await dbRead
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!current) {
      throw new NotFoundAppError("Profil tidak ditemukan.");
    }

    const [updated] = await db
      .update(users)
      .set({
        name: input.name.trim(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id))
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.PROFILE_UPDATED,
        description: "Profil akun diperbarui.",
        entityId: updated.id,
        entityType: "user",
        metadata: {
          nameChanged: updated.name !== current.name,
        },
      },
      context,
    );

    return toPublicUser(updated);
  }

  /**
   * Change current user password after verifying the current password.
   */
  static async changePassword(
    session: AuthSession,
    input: ChangePasswordInput,
    context: AuditContext,
  ) {
    if (input.newPassword !== input.confirmPassword) {
      throw new ValidationAppError("Konfirmasi password tidak sama.");
    }

    const [current] = await dbRead
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!current) {
      throw new NotFoundAppError("Profil tidak ditemukan.");
    }

    const currentPasswordValid = await verifyPassword(
      current.passwordHash,
      input.currentPassword,
    );

    if (!currentPasswordValid) {
      throw new ValidationAppError("Password saat ini salah.");
    }

    const samePassword = await verifyPassword(
      current.passwordHash,
      input.newPassword,
    );

    if (samePassword) {
      throw new ValidationAppError("Password baru tidak boleh sama dengan password lama.");
    }

    const now = new Date();
    const [updated] = await db
      .update(users)
      .set({
        passwordHash: await hashPassword(input.newPassword),
        updatedAt: now,
      })
      .where(eq(users.id, session.user.id))
      .returning();

    await db
      .update(sessions)
      .set({
        revokedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(sessions.userId, session.user.id),
          ne(sessions.id, session.id),
          isNull(sessions.revokedAt),
        ),
      );

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.PASSWORD_CHANGED,
        description: "Password akun diperbarui.",
        entityId: updated.id,
        entityType: "user",
      },
      context,
    );

    return toPublicUser(updated);
  }
}
