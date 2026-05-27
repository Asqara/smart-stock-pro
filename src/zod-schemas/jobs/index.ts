import { z } from "zod";

/**
 * Validation schemas for job management.
 */
export class Jobs {
  /**
   * Retry job request body.
   */
  static RetryJob = z.object({
    jobId: z.string().uuid("ID job tidak valid."),
  });
}
