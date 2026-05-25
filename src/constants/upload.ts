export const UPLOAD_IMAGE_TYPES = {
  banner: "banner",
  logo: "logo",
  product: "product",
} as const;

export type UploadImageType = (typeof UPLOAD_IMAGE_TYPES)[keyof typeof UPLOAD_IMAGE_TYPES];

export const UPLOAD_FILE_LIMIT_BYTES = {
  banner: 2 * 1024 * 1024,
  logo: 1 * 1024 * 1024,
  product: 1 * 1024 * 1024,
} as const;

export const UPLOAD_IMAGE_RATIO = {
  banner: [16 / 9, 4 / 3],
  logo: [1],
  product: [1],
} as const;

export const UPLOAD_RATIO_TOLERANCE = 0.03;
