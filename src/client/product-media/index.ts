import "server-only";

import { AwsClient } from "aws4fetch";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { extname } from "node:path";

import { AUDIT_ACTIONS } from "@/constants/auth";
import {
  CLOUDFLARE_R2_ENV_KEYS,
  CLOUDFLARE_R2_REGION,
  PRODUCT_IMAGE_ALLOWED_EXTENSIONS,
  PRODUCT_IMAGE_ALLOWED_MIME_TYPES,
  UPLOAD_FILE_LIMIT_BYTES,
} from "@/constants/upload";
import { products } from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import {
  ConfigurationError,
  NotFoundAppError,
  ProductImageUploadError,
} from "@/lib/errors";

import { AuditLogs } from "../audit-logs";
import { ErrorLogs } from "../error-logs";
import { Products } from "../inventory/products";
import { parseUuid } from "../inventory/shared";
import type { AuditContext } from "../types";

type ValidatedProductImage = {
  buffer: Buffer;
  extension: string;
  mimeType: (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number];
};

type ProductImageUploadInput = {
  dataBase64: string;
  fileName: string;
  fileSize: number;
  fileType: (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number];
};

type CloudflareR2Config = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  publicUrl: string;
  secretAccessKey: string;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getExtensionFromMime(
  mimeType: (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number],
) {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";

  return ".jpg";
}

function isAllowedExtension(extension: string) {
  return PRODUCT_IMAGE_ALLOWED_EXTENSIONS.includes(
    extension.toLowerCase() as never,
  );
}

function getCloudflareR2Config(): CloudflareR2Config {
  const accountId = process.env[CLOUDFLARE_R2_ENV_KEYS.accountId];
  const accessKeyId = process.env[CLOUDFLARE_R2_ENV_KEYS.accessKeyId];
  const secretAccessKey = process.env[CLOUDFLARE_R2_ENV_KEYS.secretAccessKey];
  const bucket = process.env[CLOUDFLARE_R2_ENV_KEYS.bucket];
  const publicUrl = process.env[CLOUDFLARE_R2_ENV_KEYS.publicUrl];
  const endpoint =
    process.env[CLOUDFLARE_R2_ENV_KEYS.endpoint] ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl || !endpoint) {
    throw new ConfigurationError("Credential Cloudflare R2 belum lengkap.");
  }

  return {
    accessKeyId,
    bucket,
    endpoint: trimTrailingSlash(endpoint),
    publicUrl: trimTrailingSlash(publicUrl),
    secretAccessKey,
  };
}

/**
 * Business logic for product image validation, Cloudflare R2 storage, and product updates.
 */
export class ProductMedia {
  /**
   * List product gallery records with pagination and filters.
   */
  static getProductGallery(searchParams: Record<string, unknown>) {
    return Products.list({
      ...searchParams,
      limit: searchParams.limit ?? "24",
    });
  }

  /**
   * Validate product image file type, extension, size, and detected binary MIME type.
   */
  static async validateProductImage(
    input: ProductImageUploadInput,
  ): Promise<ValidatedProductImage> {
    if (input.fileSize > UPLOAD_FILE_LIMIT_BYTES.product) {
      throw new ProductImageUploadError("Ukuran gambar maksimal 2 MB.");
    }

    if (!PRODUCT_IMAGE_ALLOWED_MIME_TYPES.includes(input.fileType as never)) {
      throw new ProductImageUploadError("Format gambar harus JPG, PNG, atau WebP.");
    }

    const originalExtension = extname(input.fileName).toLowerCase();
    if (!isAllowedExtension(originalExtension)) {
      throw new ProductImageUploadError("Ekstensi gambar harus .jpg, .jpeg, .png, atau .webp.");
    }

    const [, rawBase64] = input.dataBase64.split(",");

    if (!rawBase64) {
      throw new ProductImageUploadError("Data gambar tidak valid.");
    }

    const buffer = Buffer.from(rawBase64, "base64");

    if (buffer.length !== input.fileSize) {
      throw new ProductImageUploadError("Ukuran gambar tidak sesuai.");
    }

    const { fileTypeFromBuffer } = await import("file-type");
    const detectedType = await fileTypeFromBuffer(buffer);

    if (!detectedType) {
      throw new ProductImageUploadError("Tipe gambar tidak dapat diverifikasi.");
    }

    if (!PRODUCT_IMAGE_ALLOWED_MIME_TYPES.includes(detectedType.mime as never)) {
      throw new ProductImageUploadError("Isi file bukan gambar JPG, PNG, atau WebP.");
    }

    return {
      buffer,
      extension: getExtensionFromMime(
        detectedType.mime as (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number],
      ),
      mimeType: detectedType.mime as (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number],
    };
  }

  /**
   * Generate a safe Cloudflare R2 object key for a product image.
   */
  static generateSafeObjectKey(productId: string, extension: string) {
    return `products/${productId}/${Date.now()}-${randomBytes(8).toString("hex")}${extension}`;
  }

  /**
   * Resolve a public image URL from an R2 object key.
   */
  static getProductImagePublicUrl(objectKey: string) {
    const config = getCloudflareR2Config();

    return `${config.publicUrl}/${objectKey}`;
  }

  /**
   * Upload or replace one product image through Cloudflare R2.
   */
  static async uploadProductImage(
    productId: string,
    input: ProductImageUploadInput,
    context: AuditContext,
  ) {
    const id = parseUuid(productId, "ID produk tidak valid.");
    const [product] = await dbRead
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      throw new NotFoundAppError("Produk tidak ditemukan.");
    }

    const validated = await this.validateProductImage(input);
    const imageKey = this.generateSafeObjectKey(product.id, validated.extension);
    const imageUrl = this.getProductImagePublicUrl(imageKey);

    await this.putProductImage(imageKey, validated).catch(async (error) => {
      await ErrorLogs.log({
        message: "Upload gambar produk ke Cloudflare R2 gagal.",
        metadata: {
          productId: product.id,
          sku: product.sku,
        },
        module: "product-media.r2",
        severity: "warning",
        stack: error instanceof Error ? error.stack : null,
      }).catch(() => null);

      throw error;
    });

    const [updated] = await db
      .update(products)
      .set({
        imageKey,
        imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    if (product.imageKey) {
      await this.deleteProductImageObject(product.imageKey).catch(async (error) => {
        await ErrorLogs.log({
          message: "Gambar produk lama gagal dihapus dari Cloudflare R2.",
          metadata: {
            imageKey: product.imageKey,
            productId: product.id,
          },
          module: "product-media.r2",
          severity: "warning",
          stack: error instanceof Error ? error.stack : null,
        }).catch(() => null);
      });
    }

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.PRODUCT_IMAGE_UPDATED,
        description: `Gambar produk ${product.sku} diperbarui.`,
        entityId: product.id,
        entityType: "product",
        metadata: {
          imageKey,
          imageUrl,
          mimeType: validated.mimeType,
          size: validated.buffer.length,
        },
      },
      context,
    );

    return updated;
  }

  /**
   * Delete product image reference and R2 object when available.
   */
  static async deleteProductImage(productId: string, context: AuditContext) {
    const id = parseUuid(productId, "ID produk tidak valid.");
    const [product] = await dbRead
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      throw new NotFoundAppError("Produk tidak ditemukan.");
    }

    if (product.imageKey) {
      await this.deleteProductImageObject(product.imageKey).catch(async (error) => {
        await ErrorLogs.log({
          message: "Gambar produk gagal dihapus dari Cloudflare R2.",
          metadata: {
            imageKey: product.imageKey,
            productId: product.id,
          },
          module: "product-media.r2",
          severity: "warning",
          stack: error instanceof Error ? error.stack : null,
        }).catch(() => null);

        throw error;
      });
    }

    const [updated] = await db
      .update(products)
      .set({
        imageKey: null,
        imageUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.PRODUCT_IMAGE_REMOVED,
        description: `Gambar produk ${product.sku} dihapus.`,
        entityId: product.id,
        entityType: "product",
        metadata: {
          previousImageKey: product.imageKey,
          previousImageUrl: product.imageUrl,
        },
      },
      context,
    );

    return updated;
  }

  private static getR2Client(config: CloudflareR2Config) {
    return new AwsClient({
      accessKeyId: config.accessKeyId,
      region: CLOUDFLARE_R2_REGION,
      secretAccessKey: config.secretAccessKey,
      service: "s3",
    });
  }

  private static async putProductImage(
    objectKey: string,
    image: ValidatedProductImage,
  ) {
    const config = getCloudflareR2Config();
    const body = new Uint8Array(image.buffer);
    const response = await this.getR2Client(config).fetch(
      `${config.endpoint}/${config.bucket}/${objectKey}`,
      {
        body,
        headers: {
          "content-length": String(body.byteLength),
          "content-type": image.mimeType,
        },
        method: "PUT",
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new ProductImageUploadError(
        `Upload gambar ke Cloudflare R2 gagal. Status: ${response.status}${detail ? ` - ${detail}` : ""}`,
      );
    }
  }

  private static async deleteProductImageObject(objectKey: string) {
    const config = getCloudflareR2Config();
    const response = await this.getR2Client(config).fetch(
      `${config.endpoint}/${config.bucket}/${objectKey}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new ProductImageUploadError("Gambar lama gagal dihapus dari Cloudflare R2.");
    }
  }
}
