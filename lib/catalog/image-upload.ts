export const PRODUCT_IMAGE_FOLDER = "zona-de-pasos/products";
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ALT_TEXT_LENGTH = 160;

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const PRODUCT_IMAGE_PREFIX = `${PRODUCT_IMAGE_FOLDER}/`;

export type ProductImageErrorCode =
  | "unsupported_mime"
  | "empty_file"
  | "file_too_large"
  | "invalid_alt_text"
  | "invalid_public_id"
  | "provider_failure";

export class ImageUploadError extends Error {
  readonly code: ProductImageErrorCode;

  constructor(code: ProductImageErrorCode, message: string) {
    super(message);
    this.name = "ImageUploadError";
    this.code = code;
  }
}

export interface ProductImageUploadInput {
  data: Buffer;
  folder: typeof PRODUCT_IMAGE_FOLDER;
  mimeType: string;
}

export interface ProductImageProviderMetadata {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
}

export interface ProductImageAdapter {
  upload(input: ProductImageUploadInput): Promise<ProductImageProviderMetadata>;
  destroy(publicId: string): Promise<"ok" | "not found">;
}

export interface ProductImageMetadata extends ProductImageProviderMetadata {
  altText: string;
}

export interface ProductImageDeletion {
  deleted: boolean;
  publicId: string;
}

function providerFailure(): ImageUploadError {
  return new ImageUploadError("provider_failure", "No fue posible procesar la imagen. Intenta de nuevo.");
}

export function normalizeAltText(value: unknown): string {
  if (typeof value !== "string") {
    throw new ImageUploadError("invalid_alt_text", "El texto alternativo de la imagen es obligatorio.");
  }

  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  if (!normalized || normalized.length > MAX_ALT_TEXT_LENGTH) {
    throw new ImageUploadError("invalid_alt_text", "El texto alternativo debe tener entre 1 y 160 caracteres.");
  }

  return normalized;
}

export function isProductImagePublicId(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith(PRODUCT_IMAGE_PREFIX)) return false;
  const suffix = value.slice(PRODUCT_IMAGE_PREFIX.length);
  if (!suffix || suffix.includes("\\")) return false;

  return suffix.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function assertProviderMetadata(metadata: ProductImageProviderMetadata): ProductImageProviderMetadata {
  if (
    !metadata ||
    typeof metadata.publicId !== "string" ||
    typeof metadata.secureUrl !== "string" ||
    !isProductImagePublicId(metadata.publicId) ||
    !metadata.secureUrl.startsWith("https://") ||
    !Number.isSafeInteger(metadata.width) ||
    !Number.isSafeInteger(metadata.height) ||
    metadata.width <= 0 ||
    metadata.height <= 0
  ) {
    throw providerFailure();
  }
  return metadata;
}

export async function uploadProductImage(file: File, altText: unknown, adapter: ProductImageAdapter): Promise<ProductImageMetadata> {
  const mimeType = file.type.toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new ImageUploadError("unsupported_mime", "El formato debe ser JPEG, PNG, WebP o AVIF.");
  }
  if (file.size <= 0) {
    throw new ImageUploadError("empty_file", "La imagen no puede estar vacía.");
  }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new ImageUploadError("file_too_large", "La imagen no puede superar 5 MiB.");
  }

  const normalizedAltText = normalizeAltText(altText);
  const data = Buffer.from(await file.arrayBuffer());
  if (data.length === 0) {
    throw new ImageUploadError("empty_file", "La imagen no puede estar vacía.");
  }
  if (data.length > MAX_PRODUCT_IMAGE_BYTES) {
    throw new ImageUploadError("file_too_large", "La imagen no puede superar 5 MiB.");
  }

  let metadata: ProductImageProviderMetadata;
  try {
    metadata = await adapter.upload({ data, folder: PRODUCT_IMAGE_FOLDER, mimeType });
  } catch {
    throw providerFailure();
  }

  return { ...assertProviderMetadata(metadata), altText: normalizedAltText };
}

export async function deleteProductImage(publicId: string, adapter: ProductImageAdapter): Promise<ProductImageDeletion> {
  if (!isProductImagePublicId(publicId)) {
    throw new ImageUploadError("invalid_public_id", "La imagen no pertenece a una ubicación permitida.");
  }

  let result: "ok" | "not found";
  try {
    result = await adapter.destroy(publicId);
  } catch {
    throw providerFailure();
  }

  if (result === "ok") return { deleted: true, publicId };
  if (result === "not found") return { deleted: false, publicId };
  throw providerFailure();
}
