import { describe, expect, it, vi } from "vitest";

import {
  deleteProductImage,
  ImageUploadError,
  MAX_PRODUCT_IMAGE_BYTES,
  normalizeAltText,
  PRODUCT_IMAGE_FOLDER,
  uploadProductImage,
  type ProductImageAdapter,
} from "@/lib/catalog/image-upload";

const file = (size: number, type = "image/jpeg") => new File([new Uint8Array(size)], "shoe.jpg", { type });
const provider = (overrides: Partial<ProductImageAdapter> = {}): ProductImageAdapter => ({
  upload: vi.fn().mockResolvedValue({
    publicId: `${PRODUCT_IMAGE_FOLDER}/asset-1`,
    secureUrl: "https://res.cloudinary.com/example/image/upload/v1/asset-1.jpg",
    width: 1200,
    height: 900,
  }),
  destroy: vi.fn().mockResolvedValue("ok"),
  ...overrides,
});

describe("product image upload boundary", () => {
  it.each([
    ["unsupported MIME", file(4, "application/pdf"), "unsupported_mime"],
    ["unsupported MIME", file(4, "image/gif"), "unsupported_mime"],
    ["empty file", file(0), "empty_file"],
    ["oversized file", file(MAX_PRODUCT_IMAGE_BYTES + 1), "file_too_large"],
  ])("rejects a $0 before calling the provider", async (_label, image, code) => {
    const adapter = provider();
    await expect(uploadProductImage(image, "Tenis", adapter)).rejects.toMatchObject({ code });
    expect(adapter.upload).not.toHaveBeenCalled();
  });

  it("normalizes safe alt text and returns only persistence metadata", async () => {
    const adapter = provider();
    await expect(uploadProductImage(file(4, "image/webp"), "  Tenis\tNike\n Air  ", adapter)).resolves.toEqual({
      publicId: `${PRODUCT_IMAGE_FOLDER}/asset-1`,
      secureUrl: "https://res.cloudinary.com/example/image/upload/v1/asset-1.jpg",
      altText: "Tenis Nike Air",
      width: 1200,
      height: 900,
    });
    expect(adapter.upload).toHaveBeenCalledWith(expect.objectContaining({ folder: PRODUCT_IMAGE_FOLDER, mimeType: "image/webp", data: expect.any(Buffer) }));
  });

  it("sanitizes provider failures without exposing provider details", async () => {
    const adapter = provider({ upload: vi.fn().mockRejectedValue(new Error("Cloudinary API secret leaked")) });
    const error = await uploadProductImage(file(4), "Tenis", adapter).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ImageUploadError);
    expect(error).toMatchObject({ code: "provider_failure" });
    expect((error as Error).message).toMatch(/No fue posible/);
    expect((error as Error).message).not.toContain("Cloudinary API secret");
  });

  it("normalizes control characters and whitespace in alt text", () => {
    expect(normalizeAltText("\u0000  Tenis\u0007 Nike\u000B ")).toBe("Tenis Nike");
  });

  it("deletes valid assets and reports a missing provider asset explicitly", async () => {
    const adapter = provider({ destroy: vi.fn().mockResolvedValueOnce("ok").mockResolvedValueOnce("not found") });
    const publicId = `${PRODUCT_IMAGE_FOLDER}/asset-1`;
    await expect(deleteProductImage(publicId, adapter)).resolves.toEqual({ deleted: true, publicId });
    await expect(deleteProductImage(publicId, adapter)).resolves.toEqual({ deleted: false, publicId });
  });

  it("rejects an out-of-prefix deletion without touching the provider", async () => {
    const adapter = provider();
    await expect(deleteProductImage("other-folder/asset-1", adapter)).rejects.toMatchObject({ code: "invalid_public_id" });
    expect(adapter.destroy).not.toHaveBeenCalled();
  });
});
