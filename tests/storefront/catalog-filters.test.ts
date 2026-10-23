import { describe, expect, it } from "vitest";

import {
  deriveFilterOptions,
  filterPublicProducts,
  sortPublicProducts,
} from "@/lib/storefront/filters";
import type { PublicProduct } from "@/types/storefront";

function product(overrides: Partial<PublicProduct> = {}): PublicProduct {
  return {
    id: "p1",
    brandId: "b1",
    name: "Alpha",
    slug: "alpha",
    description: "",
    audience: "men",
    priceCop: 100000,
    featured: false,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    brand: { id: "b1", name: "Marca Uno", slug: "marca-uno" },
    image: null,
    variants: [{ id: "v1", productId: "p1", size: "38", color: "Negro", sku: "A-38", available: true, stockLabel: "Disponible" }],
    ...overrides,
  };
}

const products = [
  product(),
  product({ id: "p2", brandId: "b2", name: "Beta", slug: "beta", audience: "women", priceCop: 200000, featured: true, createdAt: "2026-04-03T00:00:00.000Z", brand: { id: "b2", name: "Marca Dos", slug: "marca-dos" }, variants: [{ id: "v2", productId: "p2", size: "39", color: "Blanco", sku: "B-39", available: false, stockLabel: "No disponible" }] }),
  product({ id: "p3", brandId: "b1", name: "Gamma", slug: "gamma", audience: "unisex", priceCop: 150000, featured: false, createdAt: "2026-04-02T00:00:00.000Z", variants: [{ id: "v3", productId: "p3", size: "40", color: "Negro", sku: "G-40", available: true, stockLabel: "Pocas unidades" }] }),
];

describe("public catalog filters and sorting", () => {
  it("filters audience, brand, size, color, and inclusive COP boundaries", () => {
    expect(filterPublicProducts(products, { audience: "women" }).map((item) => item.id)).toEqual(["p2"]);
    expect(filterPublicProducts(products, { audience: "men" }).map((item) => item.id)).toEqual(["p1"]);
    expect(filterPublicProducts(products, { brand: "marca-uno", size: "40", color: "negro" }).map((item) => item.id)).toEqual(["p3"]);
    expect(filterPublicProducts(products, { minPriceCop: 100000, maxPriceCop: 150000 }).map((item) => item.id)).toEqual(["p1", "p3"]);
    expect(filterPublicProducts(products, { minPriceCop: 150001, maxPriceCop: 199999 })).toEqual([]);
  });

  it("keeps stable input order for ties across featured, new, name, and price sorts", () => {
    expect(sortPublicProducts(products, "featured").map((item) => item.id)).toEqual(["p2", "p1", "p3"]);
    expect(sortPublicProducts(products, "new").map((item) => item.id)).toEqual(["p2", "p3", "p1"]);
    expect(sortPublicProducts(products, "name").map((item) => item.id)).toEqual(["p1", "p2", "p3"]);
    expect(sortPublicProducts(products, "price").map((item) => item.id)).toEqual(["p1", "p3", "p2"]);
    const ties = [product({ id: "first", name: "Igual", priceCop: 10 }), product({ id: "second", name: "Igual", priceCop: 10 })];
    expect(sortPublicProducts(ties, "name").map((item) => item.id)).toEqual(["first", "second"]);
  });

  it("derives unique sorted filter options from safe product data", () => {
    expect(deriveFilterOptions(products)).toEqual({
      audiences: ["men", "women", "unisex"],
      brands: [
        { id: "b2", name: "Marca Dos", slug: "marca-dos" },
        { id: "b1", name: "Marca Uno", slug: "marca-uno" },
      ],
      sizes: ["38", "39", "40"],
      colors: ["Blanco", "Negro"],
      minPriceCop: 100000,
      maxPriceCop: 200000,
    });
  });
});
