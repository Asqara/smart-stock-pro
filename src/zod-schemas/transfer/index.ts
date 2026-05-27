import { z } from "zod";

const UUID_SCHEMA = z.string().uuid("ID tidak valid.");
const OPTIONAL_TEXT_SCHEMA = z.string().trim().max(500).optional().nullable();

const TransferItemSchema = z.object({
  productId: UUID_SCHEMA,
  quantity: z.coerce.number().int().positive("Jumlah harus lebih dari 0."),
});

/**
 * Validation schemas for warehouse transfer operations.
 */
export class Transfer {
  /**
   * Create transfer request body.
   */
  static CreateTransfer = z.object({
    sourceWarehouseId: UUID_SCHEMA,
    destinationWarehouseId: UUID_SCHEMA,
    items: z
      .array(TransferItemSchema)
      .min(1, "Minimal satu item harus dipilih."),
    notes: OPTIONAL_TEXT_SCHEMA,
  });

  /**
   * Validate transfer stock request body.
   */
  static ValidateTransfer = z.object({
    sourceWarehouseId: UUID_SCHEMA,
    items: z
      .array(TransferItemSchema)
      .min(1, "Minimal satu item harus dipilih."),
  });
}
