import { z } from "zod";

import type { ProductStockStatus } from "@/constants/inventory";
import { ValidationAppError } from "@/lib/errors";

const UUID_SCHEMA = z.string().uuid();

/**
 * Parse and validate UUID route parameters.
 */
export function parseUuid(id: string, message = "ID tidak valid."): string {
  const result = UUID_SCHEMA.safeParse(id);

  if (!result.success) {
    throw new ValidationAppError(message);
  }

  return result.data;
}

/**
 * Build a standard pagination response.
 */
export function getPagination(page: number, limit: number, total: number) {
  return {
    limit,
    page,
    pageCount: Math.max(1, Math.ceil(total / limit)),
    total,
  };
}

/**
 * Resolve product stock status from current and minimum stock.
 */
export function getProductStockStatus(
  currentStock: number,
  minimumStock: number,
): ProductStockStatus {
  if (currentStock <= 0) {
    return "out_of_stock";
  }

  if (minimumStock > 0 && currentStock <= Math.max(1, Math.floor(minimumStock / 2))) {
    return "critical";
  }

  if (minimumStock > 0 && currentStock <= minimumStock) {
    return "low_stock";
  }

  return "available";
}
