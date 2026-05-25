/**
 * Extract a readable message from an Eden treaty error or any unknown error.
 * Eden errors are status-keyed unions; this normalizes all known shapes:
 * - `{ value: { message } }` — app errors
 * - `{ value: { summary } }` — Elysia/Zod validation errors
 * - `{ value: string }` — plain text responses
 * - plain `Error` objects
 * - string errors
 */
export function getErrorMessage(error: unknown, fallback = "Terjadi kesalahan"): string {
  if (!error) return fallback;

  if (typeof error === "string" && error) return error;

  if (error instanceof Error && error.message) return error.message;

  if (typeof error === "object") {
    const e = error as Record<string, unknown>;

    if (typeof e.message === "string" && e.message) return e.message;

    if (typeof e.value === "string" && e.value) return e.value;

    if (typeof e.value === "object" && e.value) {
      const v = e.value as Record<string, unknown>;
      if (typeof v.message === "string" && v.message) return v.message;
      if (typeof v.summary === "string" && v.summary) return v.summary;
    }

    if (typeof e.error === "string" && e.error) return e.error;

    if (typeof e.error === "object" && e.error) {
      const v = e.error as Record<string, unknown>;
      if (typeof v.message === "string" && v.message) return v.message;
      if (typeof v.summary === "string" && v.summary) return v.summary;
    }

    for (const value of Object.values(e)) {
      if (typeof value === "string" && value) return value;
      if (typeof value !== "object" || !value) continue;
      const v = value as Record<string, unknown>;
      if (typeof v.message === "string" && v.message) return v.message;
      if (typeof v.summary === "string" && v.summary) return v.summary;
    }
  }

  return fallback;
}
