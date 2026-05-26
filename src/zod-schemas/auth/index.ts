import { z } from "zod";

/**
 * Validation schemas for authentication routes.
 */
export class Auth {
  /**
   * Login request body.
   */
  static Login = z.object({
    email: z.string().trim().email("Email tidak valid.").toLowerCase(),
    password: z.string().min(1, "Password wajib diisi."),
  });

  /**
   * Logout request body.
   */
  static Logout = z.object({
    reason: z.string().max(80).optional(),
  });
}
