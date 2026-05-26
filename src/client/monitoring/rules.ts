import {
  RESPONSE_TIME_CRITICAL_THRESHOLD_MS,
  RESPONSE_TIME_WARNING_THRESHOLD_MS,
  type ErrorSeverity,
  type HealthCheckStatus,
} from "@/constants/inventory";

/**
 * Resolve health status from response time.
 */
export function getResponseTimeStatus(responseTimeMs: number): HealthCheckStatus {
  if (responseTimeMs > RESPONSE_TIME_CRITICAL_THRESHOLD_MS) {
    return "down";
  }

  if (responseTimeMs > RESPONSE_TIME_WARNING_THRESHOLD_MS) {
    return "degraded";
  }

  return "healthy";
}

/**
 * Resolve alert severity from response time.
 */
export function getResponseTimeSeverity(
  responseTimeMs: number,
): ErrorSeverity | null {
  if (responseTimeMs > RESPONSE_TIME_CRITICAL_THRESHOLD_MS) {
    return "critical";
  }

  if (responseTimeMs > RESPONSE_TIME_WARNING_THRESHOLD_MS) {
    return "warning";
  }

  return null;
}
