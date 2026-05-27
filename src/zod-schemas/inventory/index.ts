import { z } from "zod";

import { STOCK_VALUATION_METHOD_VALUES } from "@/constants/inventory";
import {
  PRODUCT_IMAGE_ALLOWED_MIME_TYPES,
  UPLOAD_FILE_LIMIT_BYTES,
} from "@/constants/upload";

const UUID_SCHEMA = z.string().uuid("ID tidak valid.");
const OPTIONAL_TEXT_SCHEMA = z.string().trim().max(500).optional().nullable();

/**
 * Validation schemas for inventory modules.
 */
export class Inventory {
  /**
   * Product create request body.
   */
  static CreateProduct = z.object({
    sku: z.string().trim().min(1, "SKU wajib diisi.").max(80).toUpperCase(),
    name: z.string().trim().min(1, "Nama produk wajib diisi.").max(160),
    description: OPTIONAL_TEXT_SCHEMA,
    categoryId: UUID_SCHEMA,
    supplierId: UUID_SCHEMA,
    unit: z.string().trim().min(1, "Unit wajib diisi.").max(40),
    minimumStock: z.coerce.number().int().min(0, "Stok minimum tidak boleh negatif.").default(0),
    price: z.coerce.number().int().min(0, "Harga tidak boleh negatif.").default(0),
    isActive: z.boolean().optional(),
  });

  /**
   * Product update request body.
   */
  static UpdateProduct = Inventory.CreateProduct.partial().refine(
    (value) => Object.keys(value).length > 0,
    { message: "Minimal satu data produk harus diubah." },
  );

  /**
   * Category create request body.
   */
  static CreateCategory = z.object({
    name: z.string().trim().min(1, "Nama kategori wajib diisi.").max(120),
    slug: z.string().trim().min(1, "Kode kategori wajib diisi.").max(80).toLowerCase(),
    description: OPTIONAL_TEXT_SCHEMA,
    isActive: z.boolean().optional(),
  });

  /**
   * Category update request body.
   */
  static UpdateCategory = Inventory.CreateCategory.partial().refine(
    (value) => Object.keys(value).length > 0,
    { message: "Minimal satu data kategori harus diubah." },
  );

  /**
   * Supplier create request body.
   */
  static CreateSupplier = z.object({
    name: z.string().trim().min(1, "Nama supplier wajib diisi.").max(160),
    contactName: z.string().trim().max(120).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
    email: z.string().trim().email("Email supplier tidak valid.").optional().nullable(),
    address: z.string().trim().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
  });

  /**
   * Supplier update request body.
   */
  static UpdateSupplier = Inventory.CreateSupplier.partial().refine(
    (value) => Object.keys(value).length > 0,
    { message: "Minimal satu data supplier harus diubah." },
  );

  /**
   * Warehouse create request body.
   */
  static CreateWarehouse = z.object({
    code: z.string().trim().min(1, "Kode gudang wajib diisi.").max(40).toUpperCase(),
    name: z.string().trim().min(1, "Nama gudang wajib diisi.").max(160),
    city: z.string().trim().min(1, "Kota wajib diisi.").max(120),
    address: z.string().trim().max(500).optional().nullable(),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    isActive: z.boolean().optional(),
  });

  /**
   * Warehouse update request body.
   */
  static UpdateWarehouse = Inventory.CreateWarehouse.partial().refine(
    (value) => Object.keys(value).length > 0,
    { message: "Minimal satu data gudang harus diubah." },
  );

  /**
   * Stock in request body.
   */
  static StockIn = z.object({
    productId: UUID_SCHEMA,
    warehouseId: UUID_SCHEMA,
    quantity: z.coerce.number().int().positive("Jumlah harus lebih dari 0."),
    unitCost: z.coerce.number().int().min(0, "Harga satuan tidak boleh negatif."),
    receivedAt: z.coerce.date(),
    notes: OPTIONAL_TEXT_SCHEMA,
  });

  /**
   * Stock out request body.
   */
  static StockOut = z.object({
    productId: UUID_SCHEMA,
    warehouseId: UUID_SCHEMA,
    quantity: z.coerce.number().int().positive("Jumlah harus lebih dari 0."),
    notes: OPTIONAL_TEXT_SCHEMA,
    valuationMethod: z.enum(STOCK_VALUATION_METHOD_VALUES).default("FIFO"),
  });

  /**
   * Product image upload request body.
   */
  static ProductImageUpload = z.object({
    dataBase64: z.string().min(1, "Data gambar wajib diisi."),
    fileName: z.string().trim().min(1, "Nama file wajib diisi.").max(180),
    fileSize: z.number().int().positive().max(
      UPLOAD_FILE_LIMIT_BYTES.product,
      "Ukuran gambar maksimal 2 MB.",
    ),
    fileType: z.enum(PRODUCT_IMAGE_ALLOWED_MIME_TYPES, {
      error: "Format gambar harus JPG, PNG, atau WebP.",
    }),
  });
}
