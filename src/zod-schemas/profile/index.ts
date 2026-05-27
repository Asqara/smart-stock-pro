import { z } from "zod";

import { PASSWORD_STRENGTH_SCHEMA } from "@/utils/passwordPolicy";

/**
 * Validation schemas for self-service profile flows.
 */
export class Profile {
  /**
   * Update current user profile.
   */
  static Update = z.object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
  });

  /**
   * Change current user password.
   */
  static ChangePassword = z.object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi."),
    newPassword: PASSWORD_STRENGTH_SCHEMA,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi."),
  });
}
