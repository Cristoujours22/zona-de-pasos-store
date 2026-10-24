import { describe, expect, it, vi } from "vitest";

import {
  CatalogAdminError,
  CatalogPersistenceError,
  createCatalogAdminService,
  type CatalogAdminAdapter,
} from "@/lib/catalog/admin/service";

const image = {
  cloudinaryPublicId: "zona-de-pasos/products/asset-1",
  secureUrl: "https://res.cloudinary.com/demo/image/upload/asset-1.jpg",
  altText: "Tenis urbanos",
  width: 900,
  height: 900,
};

const product = {
  brandId: "brand-1",
  name: "Air Runner",
  description: "Tenis para uso diario",
  audience: "men",
  priceCop: 249900,
  lifecycle: "draft",
  featured: true,
  image,
  variants: [
    { size: "39", color: "Negro", sku: "AIR-39-NEG", stockQuantity: 2 },
    { size: "40", color: "Negro", sku: "AIR-40-NEG", stockQuantity: 3 },
  ],
};

function adapter(overrides: Partial<CatalogAdminAdapter> = {}): CatalogAdminAdapter {
  return {
    listBrands: vi.fn().mockResolvedValue([]),
    createBrand: vi.fn().mockResolvedValue({ id: "brand-1", name: "Nike", slug: "nike" }),
    createProduct: vi.fn().mockResolvedValue({ id: "product-1" }),
    listProducts: vi.fn().mockResolvedValue([]),
    updateProduct: vi.fn().mockResolvedValue({ id: "product-1" }),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    adjustInventory: vi.fn().mockResolvedValue({ stockQuantity: 4 }),
    ...overrides,
  };
}

describe("catalog admin service", () => {
  it("leaves the adapter untouched for a malformed product", async () => {
    const db = adapter();
    await expect(createCatalogAdminService(db).createProduct({ ...product, priceCop: 249900.5 })).rejects.toMatchObject({ code: "invalid_price" });
    expect(db.createProduct).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...product, priceCop: -1 }, "invalid_price"],
    [{ ...product, variants: [{ ...product.variants[0], stockQuantity: -1 }] }, "invalid_stock"],
    [{ ...product, variants: [{ ...product.variants[0], sku: " " }] }, "invalid_variant"],
  ])("rejects invalid product data (%s)", async (payload, code) => {
    const db = adapter();
    await expect(createCatalogAdminService(db).createProduct(payload)).rejects.toMatchObject({ code });
    expect(db.createProduct).not.toHaveBeenCalled();
  });

  it("rejects duplicate size/color and SKU combinations", async () => {
    const db = adapter();
    await expect(createCatalogAdminService(db).createProduct({
      ...product,
      variants: [product.variants[0], { ...product.variants[1], size: "39" }],
    })).rejects.toMatchObject({ code: "duplicate_variant" });
    await expect(createCatalogAdminService(db).createProduct({
      ...product,
      variants: [product.variants[0], { ...product.variants[1], sku: product.variants[0].sku }],
    })).rejects.toMatchObject({ code: "duplicate_variant" });
    expect(db.createProduct).not.toHaveBeenCalled();
  });

  it("maps a valid product to one atomic persistence payload", async () => {
    const db = adapter();
    await expect(createCatalogAdminService(db).createProduct(product)).resolves.toEqual({ id: "product-1" });
    expect(db.createProduct).toHaveBeenCalledWith(expect.objectContaining({
      brandId: "brand-1",
      slug: "air-runner",
      image,
      variants: expect.arrayContaining([
        expect.objectContaining({ size: "39", color: "Negro", sku: "AIR-39-NEG", stockQuantity: 2, active: true }),
      ]),
    }));
  });

  it("validates settings before persistence and maps a valid update", async () => {
    const db = adapter({ updateSettings: vi.fn().mockResolvedValue({ stockDisplayMode: "detailed" }) });
    const service = createCatalogAdminService(db);
    await expect(service.updateSettings({ inventoryLowThreshold: -1 })).rejects.toMatchObject({ code: "invalid_threshold" });
    expect(db.updateSettings).not.toHaveBeenCalled();
    await service.updateSettings({ whatsappPhone: "  +57 300 123 4567 ", nequiDetails: "  Nequi: 3001234567 " });
    expect(db.updateSettings).toHaveBeenCalledWith({ whatsappPhone: "+57 300 123 4567", nequiDetails: "Nequi: 3001234567" });
  });

  it("returns a recoverable error for ambiguous product persistence without an asset deletion path", async () => {
    const db = adapter({ createProduct: vi.fn().mockRejectedValue(new CatalogPersistenceError("timeout", true)) });
    await expect(createCatalogAdminService(db).createProduct(product)).rejects.toMatchObject({ code: "ambiguous_persistence", status: 503 });
    expect(db.createProduct).toHaveBeenCalledTimes(1);
  });

  it("maps manual inventory adjustment through the adapter", async () => {
    const db = adapter();
    await expect(createCatalogAdminService(db).adjustInventory({ variantId: "variant-1", delta: -2, reason: "Venta confirmada", orderReference: "order-1" })).resolves.toEqual({ stockQuantity: 4 });
    expect(db.adjustInventory).toHaveBeenCalledWith({ variantId: "variant-1", delta: -2, reason: "Venta confirmada", orderReference: "order-1" });
    await expect(createCatalogAdminService(db).adjustInventory({ variantId: "variant-1", delta: 0, reason: "" })).rejects.toBeInstanceOf(CatalogAdminError);
  });
});
