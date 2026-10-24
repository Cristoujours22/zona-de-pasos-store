import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { mergePublicCatalogRows } from "@/lib/storefront/catalog";
import type { PublicProduct, PublicStorefrontSettings } from "@/types/storefront";

describe("public data boundary", () => {
  it("keeps the public Supabase client limited to URL and anon key", () => {
    const source = readFileSync("lib/supabase/public.ts", "utf8");

    expect(source).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(source).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("service_role");
  });

  it("does not expose stock quantities, Nequi, addresses, or admin lifecycle fields", () => {
    const { products } = mergePublicCatalogRows([
      {
        id: "p1",
        brand_id: "b1",
        name: "Ritmo 01",
        slug: "ritmo-01",
        description: "",
        audience: "men",
        price_cop: 100000,
        lifecycle: "published",
        featured: false,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        brands: { id: "b1", name: "Marca Uno", slug: "marca-uno", internal_note: "admin" },
        product_images: [],
        nequi_details: "private",
        dispatch_origin_address: "private",
      },
    ], [{ id: "v1", product_id: "p1", size: "38", color: "Negro", sku: "R1-38", available: true, stock_label: "Disponible", stock_quantity: 12 }]);

    const value = { products } as { products: PublicProduct[] };
    const settings: PublicStorefrontSettings = {
      whatsappPhone: "573001234567",
      supportUrl: "https://wa.me/573001234567?text=Hola",
      dispatchOriginCity: "Bogotá",
      inventoryLowThreshold: 3,
      stockDisplayMode: "availability_only",
    };
    const serialized = JSON.stringify({ value, settings });

    expect(serialized).not.toMatch(/stock_quantity|nequi|dispatch_origin_address|internal_note|lifecycle/i);
    expect(products[0].variants[0]).toEqual({ id: "v1", productId: "p1", size: "38", color: "Negro", sku: "R1-38", available: true, stockLabel: "Disponible" });
  });
});
