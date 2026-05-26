import { z } from "zod";

import { USER_ROLE_VALUES } from "@/constants/auth";
import { PASSWORD_STRENGTH_SCHEMA } from "@/utils/passwordPolicy";

/**
 * Validation schemas for user management.
 */
export class Users {
  /**
   * Create user request body.
   */
  static Create = z.object({
    email: z.string().trim().email("Email tidak valid.").toLowerCase(),
    isActive: z.boolean().optional(),
    name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
    password: PASSWORD_STRENGTH_SCHEMA,
    role: z.enum(USER_ROLE_VALUES),
  });

  /**
   * Update user request body.
   */
  static Update = z
    .object({
      email: z.string().trim().email("Email tidak valid.").toLowerCase().optional(),
      name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120).optional(),
    })
    .refine((value) => value.email || value.name, {
      message: "Minimal satu data user harus diubah.",
    });

  /**
   * Change role request body.
   */
  static ChangeRole = z.object({
    role: z.enum(USER_ROLE_VALUES),
  });

  /**
   * Reset password request body.
   */
  static ResetPassword = z.object({
    password: PASSWORD_STRENGTH_SCHEMA,
  });

  /**
   * Change active status request body.
   */
  static ChangeStatus = z.object({
    isActive: z.boolean(),
  });

  /**
   * Bulk import from XLSX — file sent as base64 string.
   */
  static BulkImport = z.object({
    file: z.string().min(1, "File XLSX wajib diisi."),
  });
}
