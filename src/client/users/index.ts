import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";
import ExcelJS from "exceljs";
import { z } from "zod";

import {
  AUDIT_ACTIONS,
  DEMO_USER_PASSWORD,
  DEMO_USERS,
  USER_ROLE_LABELS,
  USER_ROLE_VALUES,
  type UserRole,
} from "@/constants/auth";
import { Schema } from "@/zod-schemas";
import { sessions, users } from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import {
  ConflictAppError,
  NotFoundAppError,
  ValidationAppError,
} from "@/lib/errors";
import { hashPassword } from "@/lib/password";
import { getFilters } from "@/utils/getFilters";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { AuditLogs } from "../audit-logs";
import type { AuditContext, PublicUser } from "../types";
import { toPublicUser } from "../types";

type CreateUserInput = {
  email: string;
  isActive?: boolean;
  name: string;
  password: string;
  role: UserRole;
};

type UpdateUserInput = {
  email?: string;
  name?: string;
};

type UserListResult = {
  data: PublicUser[];
  pagination: {
    limit: number;
    page: number;
    pageCount: number;
    total: number;
  };
};

type XlsxImportResult = {
  created: number;
  errors: Array<{ message: string; row: number }>;
  failed: number;
};

const USER_ID_SCHEMA = z.string().uuid("ID user tidak valid.");

function parseUserId(id: string): string {
  const result = USER_ID_SCHEMA.safeParse(id);

  if (!result.success) {
    throw new ValidationAppError("ID user tidak valid.");
  }

  return result.data;
}

function toUserResponse(user: typeof users.$inferSelect): PublicUser {
  return toPublicUser(user);
}

/**
 * Business logic for user management.
 */
export class Users {
  /**
   * List users with pagination, sorting, and filtering.
   */
  static async list(
    searchParams: Record<string, unknown>,
  ): Promise<UserListResult> {
    const filters = getFilters(searchParams);
    const where = filters.where;
    const conditions: SQL[] = [];

    if (filters.search) {
      conditions.push(
        or(
          ilike(users.name, `%${filters.search}%`),
          ilike(users.email, `%${filters.search}%`),
        )!,
      );
    }

    if (typeof where.role === "string" && where.role) {
      const role = USER_ROLE_VALUES.find((value) => value === where.role);

      if (role) {
        conditions.push(eq(users.role, role));
      }
    }

    if (typeof where.isActive === "string" && where.isActive) {
      conditions.push(eq(users.isActive, where.isActive === "true"));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ total }] = await dbRead
      .select({ total: count() })
      .from(users)
      .where(whereCondition);

    let sortColumn: AnyPgColumn = users.createdAt;

    if (filters.sortBy === "email") {
      sortColumn = users.email;
    }

    if (filters.sortBy === "name") {
      sortColumn = users.name;
    }

    if (filters.sortBy === "role") {
      sortColumn = users.role;
    }

    if (filters.sortBy === "updatedAt") {
      sortColumn = users.updatedAt;
    }

    const sortDirection = filters.sortDir === "asc" ? asc : desc;
    const data = await dbRead
      .select()
      .from(users)
      .where(whereCondition)
      .orderBy(sortDirection(sortColumn))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      data: data.map(toUserResponse),
      pagination: {
        limit: filters.limit,
        page: filters.page,
        pageCount: Math.max(1, Math.ceil(Number(total) / filters.limit)),
        total: Number(total),
      },
    };
  }

  /**
   * Create a user with hashed password.
   */
  static async create(
    input: CreateUserInput,
    context: AuditContext,
  ): Promise<PublicUser> {
    await this.ensureEmailAvailable(input.email);

    const [user] = await db
      .insert(users)
      .values({
        email: input.email,
        isActive: input.isActive ?? true,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        role: input.role,
      })
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.USER_CREATED,
        description: `User ${user.email} dibuat.`,
        entityId: user.id,
        entityType: "user",
        metadata: { email: user.email, role: user.role },
      },
      context,
    );

    return toUserResponse(user);
  }

  /**
   * Update basic user data.
   */
  static async update(
    id: string,
    input: UpdateUserInput,
    context: AuditContext,
  ): Promise<PublicUser> {
    const userId = parseUserId(id);
    const current = await this.getExistingUser(userId);

    if (input.email && input.email !== current.email) {
      await this.ensureEmailAvailable(input.email, userId);
    }

    const now = new Date();
    const [user] = await db
      .update(users)
      .set({
        email: input.email ?? current.email,
        name: input.name ?? current.name,
        updatedAt: now,
      })
      .where(eq(users.id, userId))
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.USER_UPDATED,
        description: `User ${user.email} diperbarui.`,
        entityId: user.id,
        entityType: "user",
        metadata: {
          emailChanged: input.email ? input.email !== current.email : false,
          nameChanged: input.name ? input.name !== current.name : false,
        },
      },
      context,
    );

    return toUserResponse(user);
  }

  /**
   * Change a user's role.
   */
  static async changeRole(
    id: string,
    role: UserRole,
    context: AuditContext,
  ): Promise<PublicUser> {
    const userId = parseUserId(id);
    const current = await this.getExistingUser(userId);
    const now = new Date();
    const [user] = await db
      .update(users)
      .set({
        role,
        updatedAt: now,
      })
      .where(eq(users.id, userId))
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
        description: `Role user ${user.email} diubah.`,
        entityId: user.id,
        entityType: "user",
        metadata: { from: current.role, to: role },
      },
      context,
    );

    return toUserResponse(user);
  }

  /**
   * Reset a user's password and revoke active sessions.
   */
  static async resetPassword(
    id: string,
    password: string,
    context: AuditContext,
  ): Promise<PublicUser> {
    const userId = parseUserId(id);
    const current = await this.getExistingUser(userId);
    const now = new Date();
    const [user] = await db
      .update(users)
      .set({
        passwordHash: await hashPassword(password),
        updatedAt: now,
      })
      .where(eq(users.id, userId))
      .returning();

    await db
      .update(sessions)
      .set({
        revokedAt: now,
        updatedAt: now,
      })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
        description: `Password user ${current.email} direset.`,
        entityId: user.id,
        entityType: "user",
        metadata: { email: current.email },
      },
      context,
    );

    return toUserResponse(user);
  }

  /**
   * Activate or deactivate a user.
   */
  static async changeStatus(
    id: string,
    isActive: boolean,
    context: AuditContext,
  ): Promise<PublicUser> {
    const userId = parseUserId(id);
    const current = await this.getExistingUser(userId);
    const now = new Date();
    const [user] = await db
      .update(users)
      .set({
        isActive,
        updatedAt: now,
      })
      .where(eq(users.id, userId))
      .returning();

    if (!isActive) {
      await db
        .update(sessions)
        .set({
          revokedAt: now,
          updatedAt: now,
        })
        .where(eq(sessions.userId, userId));
    }

    await AuditLogs.create(
      {
        action: isActive
          ? AUDIT_ACTIONS.USER_ACTIVATED
          : AUDIT_ACTIONS.USER_DEACTIVATED,
        description: `User ${current.email} ${isActive ? "diaktifkan" : "dinonaktifkan"}.`,
        entityId: user.id,
        entityType: "user",
        metadata: { email: current.email, isActive },
      },
      context,
    );

    return toUserResponse(user);
  }

  /**
   * Seed demo users for local development only.
   */
  static async seedDemoUsers(): Promise<PublicUser[]> {
    const result: PublicUser[] = [];

    for (const demoUser of DEMO_USERS) {
      const [existing] = await dbRead
        .select()
        .from(users)
        .where(eq(users.email, demoUser.email))
        .limit(1);

      const passwordHash = await hashPassword(DEMO_USER_PASSWORD);
      const now = new Date();

      if (existing) {
        const [updated] = await db
          .update(users)
          .set({
            isActive: true,
            name: demoUser.name,
            passwordHash,
            role: demoUser.role,
            updatedAt: now,
          })
          .where(eq(users.id, existing.id))
          .returning();

        result.push(toUserResponse(updated));
        continue;
      }

      const [created] = await db
        .insert(users)
        .values({
          email: demoUser.email,
          isActive: true,
          name: demoUser.name,
          passwordHash,
          role: demoUser.role,
        })
        .returning();

      result.push(toUserResponse(created));
    }

    return result;
  }

  /**
   * Generate a downloadable XLSX template for bulk user import.
   * Sheet 1: headers + example row. Sheet 2: role reference.
   */
  static async generateXlsxTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    const dataSheet = workbook.addWorksheet("Import User");
    dataSheet.columns = [
      { header: "nama", key: "nama", width: 30 },
      { header: "email", key: "email", width: 35 },
      { header: "role", key: "role", width: 22 },
      { header: "password", key: "password", width: 25 },
    ];

    const headerRow = dataSheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      fgColor: { argb: "FF2563EB" },
      pattern: "solid",
      type: "pattern",
    };
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.commit();

    dataSheet.addRow({
      email: "contoh@email.com",
      nama: "Contoh Nama",
      password: "Password123!",
      role: "VIEWER",
    });

    const roleSheet = workbook.addWorksheet("Referensi Role");
    roleSheet.columns = [
      { header: "Kode Role", key: "kode", width: 25 },
      { header: "Label", key: "label", width: 25 },
    ];

    const roleHeaderRow = roleSheet.getRow(1);
    roleHeaderRow.font = { bold: true };
    roleHeaderRow.commit();

    for (const role of USER_ROLE_VALUES) {
      roleSheet.addRow({ kode: role, label: USER_ROLE_LABELS[role] });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Parse + bulk-create users from a base64-encoded XLSX buffer.
   * Skips invalid rows and collects per-row errors.
   */
  static async importFromXlsx(
    buffer: Buffer,
    context: AuditContext,
  ): Promise<XlsxImportResult> {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;

    try {
      await workbook.xlsx.load(arrayBuffer);
    } catch {
      throw new ValidationAppError("File XLSX tidak dapat dibaca.");
    }

    const sheet = workbook.worksheets[0];

    if (!sheet) {
      throw new ValidationAppError("File XLSX tidak memiliki sheet.");
    }

    const rows: Array<{
      email: string;
      name: string;
      password: string;
      role: string;
      rowNumber: number;
    }> = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      rows.push({
        email: row.getCell(2).value?.toString().trim() ?? "",
        name: row.getCell(1).value?.toString().trim() ?? "",
        password: row.getCell(4).value?.toString().trim() ?? "",
        role: row.getCell(3).value?.toString().trim() ?? "",
        rowNumber,
      });
    });

    const result: XlsxImportResult = { created: 0, errors: [], failed: 0 };

    for (const rowData of rows) {
      const parsed = Schema.Users.Create.safeParse({
        email: rowData.email,
        name: rowData.name,
        password: rowData.password,
        role: rowData.role,
      });

      if (!parsed.success) {
        result.failed++;
        result.errors.push({
          message: parsed.error.issues[0]?.message ?? "Data tidak valid.",
          row: rowData.rowNumber,
        });
        continue;
      }

      try {
        await this.create(parsed.data, context);
        result.created++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          message: error instanceof Error ? error.message : "Gagal membuat user.",
          row: rowData.rowNumber,
        });
      }
    }

    return result;
  }

  private static async ensureEmailAvailable(
    email: string,
    exceptUserId?: string,
  ): Promise<void> {
    const [existing] = await dbRead
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!existing) {
      return;
    }

    if (exceptUserId && existing.id === exceptUserId) {
      return;
    }

    throw new ConflictAppError("Email sudah digunakan.");
  }

  private static async getExistingUser(id: string) {
    const [user] = await dbRead
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      throw new NotFoundAppError("User tidak ditemukan.");
    }

    return user;
  }
}
