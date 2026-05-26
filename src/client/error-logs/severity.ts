import type { ErrorSeverity } from "@/constants/inventory";

/**
 * Categorize unexpected errors into operational severity.
 */
export function categorizeErrorSeverity(error: unknown): ErrorSeverity {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (
    message.includes("database") ||
    message.includes("connection") ||
    message.includes("stock transaction") ||
    message.includes("redis") ||
    message.includes("worker")
  ) {
    return "critical";
  }

  if (
    message.includes("email") ||
    message.includes("timeout") ||
    message.includes("job") ||
    message.includes("slow")
  ) {
    return "warning";
  }

  return "info";
}
