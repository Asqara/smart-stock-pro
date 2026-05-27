import { describe, expect, it } from "vitest";

import { UPLOAD_FILE_LIMIT_BYTES } from "@/constants/upload";

import { ProductMedia } from ".";

describe("ProductMedia.validateProductImage", () => {
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  const pngDataUrl = `data:image/png;base64,${pngBase64}`;
  const pngSize = Buffer.from(pngBase64, "base64").length;

  it("accepts a valid PNG upload payload", async () => {
    await expect(
      ProductMedia.validateProductImage({
        dataBase64: pngDataUrl,
        fileName: "stock-camera.png",
        fileSize: pngSize,
        fileType: "image/png",
      }),
    ).resolves.toMatchObject({
      extension: ".png",
    });
  });

  it("rejects unsupported extensions", async () => {
    await expect(
      ProductMedia.validateProductImage({
        dataBase64: pngDataUrl,
        fileName: "stock-camera.svg",
        fileSize: pngSize,
        fileType: "image/png",
      }),
    ).rejects.toThrow("Ekstensi gambar harus .jpg, .jpeg, .png, atau .webp.");
  });

  it("rejects files above the MVP size limit", async () => {
    await expect(
      ProductMedia.validateProductImage({
        dataBase64: pngDataUrl,
        fileName: "stock-camera.png",
        fileSize: UPLOAD_FILE_LIMIT_BYTES.product + 1,
        fileType: "image/png",
      }),
    ).rejects.toThrow("Ukuran gambar maksimal 2 MB.");
  });
});
