import { describe, expect, it } from "vitest";

import {
  buildCatalogQuery,
  parseCatalogQuery,
  type CatalogQuery,
} from "@/lib/storefront/query";

describe("public catalog query handling", () => {
  it("accepts supported filters, inclusive COP bounds, and sort values", () => {
    expect(parseCatalogQuery({
      audience: "women",
      brand: "marca-uno",
      size: "38",
      color: "Negro",
      min: "100000",
      max: "250000",
      sort: "price_desc",
    })).toEqual({
      audience: "women",
      brand: "marca-uno",
      size: "38",
      color: "Negro",
      minPriceCop: 100000,
      maxPriceCop: 250000,
      sort: "price_desc",
    });
  });

  it("falls back safely for hostile values and reversed bounds", () => {
    expect(parseCatalogQuery({
      audience: "children",
      brand: ["marca-uno", "javascript:alert(1)"],
      size: "<script>alert(1)</script>",
      min: "-1",
      max: "not-a-price",
      sort: "DROP TABLE products",
    })).toEqual({ sort: "featured" });

    expect(parseCatalogQuery({ min: "300000", max: "100000" })).toEqual({ sort: "featured" });
    expect(parseCatalogQuery({ min: "9007199254740992", max: "0" })).toEqual({ sort: "featured" });
  });

  it("builds a stable GET URL and can clear all selections", () => {
    const query: CatalogQuery = {
      audience: "men",
      brand: "marca-uno",
      size: "40",
      color: "Azul marino",
      minPriceCop: 120000,
      maxPriceCop: 220000,
      sort: "newest",
    };

    expect(buildCatalogQuery(query)).toBe("?audience=men&brand=marca-uno&size=40&color=Azul+marino&min=120000&max=220000&sort=newest");
    expect(buildCatalogQuery({ sort: "featured" })).toBe("");
  });
});
