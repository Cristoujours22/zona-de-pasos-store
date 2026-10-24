import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  loadPublicCatalog,
  mergePublicCatalogRows,
  type PublicCatalogClient,
} from "@/lib/storefront/catalog";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const productRow = {
  id: "product-1",
  brand_id: "brand-1",
  name: "Ritmo 01",
  slug: "ritmo-01",
  description: "Tenis para moverte.",
  audience: "unisex",
  price_cop: 249900,
  featured: true,
  created_at: "2026-04-03T10:00:00.000Z",
  updated_at: "2026-04-03T10:00:00.000Z",
  brands: { id: "brand-1", name: "Marca Uno", slug: "marca-uno" },
  product_images: [{
    id: "image-1",
    product_id: "product-1",
    secure_url: "https://res.cloudinary.com/demo/image/upload/v1/ritmo-01.jpg",
    alt_text: "Tenis Ritmo 01 negros",
    position: 0,
    width: 800,
    height: 800,
  }],
};

function mockClient(results: { products?: unknown; variants?: unknown; settings?: unknown }): { client: PublicCatalogClient; calls: string[] } {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      if (table === "products") {
        return {
          select(selection: string) {
            calls.push(`products.select:${selection}`);
            return {
              eq(column: string, value: string) {
                calls.push(`products.eq:${column}=${value}`);
                return {
                  order(columnName: string, options: { ascending: boolean }) {
                    calls.push(`products.order:${columnName}:${options.ascending}`);
                    return Promise.resolve({ data: results.products ?? [productRow], error: null });
                  },
                };
              },
            };
          },
        };
      }
      if (table === "storefront_product_variants") {
        return {
          select(selection: string) {
            calls.push(`variants.select:${selection}`);
            return Promise.resolve({ data: results.variants ?? [{ id: "variant-1", product_id: "product-1", size: "38", color: "Negro", sku: "R1-38", available: true, stock_label: "Disponible", stock_quantity: 99 }], error: null });
          },
        };
      }
      return {
        select(selection: string) {
          calls.push(`settings.select:${selection}`);
          return {
            maybeSingle() {
              return Promise.resolve({ data: results.settings ?? { whatsapp_phone: "+57 300 123 4567", dispatch_origin_city: "Bogotá", inventory_low_threshold: 3, stock_display_mode: "detailed", nequi_details: "NO PUBLICAR", dispatch_origin_address: "NO PUBLICAR" }, error: null });
            },
          };
        },
      };
    },
  } as unknown as PublicCatalogClient;
  return { client, calls };
}

afterEach(() => {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalAnonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
});

describe("public storefront catalog", () => {
  it("queries only published products and the safe variant projection", async () => {
    const { client, calls } = mockClient({});

    const result = await loadPublicCatalog({ client });

    expect(calls).toContain("products.eq:lifecycle=published");
    expect(calls).toContain("from:storefront_product_variants");
    expect(calls.find((call) => call.startsWith("variants.select:"))).not.toMatch(/stock_quantity|nequi|dispatch_origin_address/i);
    expect(calls.find((call) => call.startsWith("products.select:"))).not.toMatch(/lifecycle|stock_quantity|nequi|dispatch_origin_address/i);
    expect(result.status).toBe("ready");
    expect(result.products[0].variants).toEqual([expect.objectContaining({ available: true, stockLabel: "Disponible" })]);
  });

  it("merges safe variants by product and drops drafts, orphan rows, and malformed images", () => {
    const result = mergePublicCatalogRows([
      productRow,
      { ...productRow, id: "draft-1", lifecycle: "draft", slug: "draft-1" },
      { ...productRow, id: "product-2", slug: "partial-2", product_images: [{ ...productRow.product_images[0], secure_url: "http://unsafe.example/image.jpg" }] },
    ], [
      { id: "v-1", product_id: "product-1", size: "38", color: "Negro", sku: "R1-38", available: true, stock_label: "Disponible", stock_quantity: 7 },
      { id: "v-2", product_id: "product-1", size: "39", color: "Negro", sku: "R1-39", available: false, stock_label: "No disponible", stock_quantity: 0 },
      { id: "orphan", product_id: "missing", size: "40", color: "Rojo", sku: "ORPHAN", available: true, stock_label: "Disponible" },
      { id: "bad", product_id: "product-1", size: "", color: "Rojo", sku: "BAD", available: true, stock_label: "Disponible" },
    ]);

    expect(result.products.map((product) => product.id)).toEqual(["product-1", "product-2"]);
    expect(result.products[0].variants.map((variant) => variant.size)).toEqual(["38", "39"]);
    expect(result.products[1].image).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toMatch(/stock_quantity|nequi_details|dispatch_origin_address|lifecycle/);
  });

  it.each([
    ["detailed", "Pocas unidades", "No disponible"],
    ["availability_only", "Disponible", "No disponible"],
    ["hidden", null, null],
  ] as const)("keeps the %s stock mode label-safe", async (mode, availableLabel, unavailableLabel) => {
    const { client } = mockClient({
      settings: { whatsapp_phone: "", dispatch_origin_city: "", inventory_low_threshold: 3, stock_display_mode: mode },
      variants: [
        { id: "available", product_id: "product-1", size: "38", color: "Negro", sku: "A-38", available: true, stock_label: availableLabel },
        { id: "unavailable", product_id: "product-1", size: "39", color: "Negro", sku: "A-39", available: false, stock_label: unavailableLabel },
      ],
    });

    const result = await loadPublicCatalog({ client });

    expect(result.products[0].variants.map((variant) => variant.stockLabel)).toEqual([availableLabel, unavailableLabel]);
    expect(JSON.stringify(result)).not.toMatch(/stock_quantity|\b\d+\s+unidades/i);
  });

  it("normalizes support settings without exposing payment or dispatch address data", async () => {
    const { client } = mockClient({ settings: { whatsapp_phone: "+57 (300) 123-4567", dispatch_origin_city: "Bogotá", inventory_low_threshold: 2, stock_display_mode: "availability_only", nequi_details: "secret", dispatch_origin_address: "secret" } });

    const result = await loadPublicCatalog({ client });

    expect(result.settings).toMatchObject({ whatsappPhone: "573001234567", dispatchOriginCity: "Bogotá", inventoryLowThreshold: 2, stockDisplayMode: "availability_only" });
    expect(result.settings.supportUrl).toContain("https://wa.me/573001234567?text=");
    expect(result.settings.supportUrl).toContain("%C3%B3");
    expect(result.settings).not.toHaveProperty("nequiDetails");
    expect(result.settings).not.toHaveProperty("dispatchOriginAddress");
  });

  it("returns explicit empty, database-error, and missing-environment states", async () => {
    const empty = await loadPublicCatalog({ client: mockClient({ products: [], variants: [] }).client });
    expect(empty.status).toBe("empty");
    expect(empty.products).toEqual([]);

    const failingClient = {
      from: () => ({
        select: () => ({
          eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: "offline" } }) }),
          maybeSingle: () => Promise.resolve({ data: null, error: { message: "offline" } }),
        }),
      }),
    } as unknown as PublicCatalogClient;
    const failed = await loadPublicCatalog({ client: failingClient });
    expect(failed.status).toBe("database_error");
    expect(failed.products).toEqual([]);

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const missing = await loadPublicCatalog();
    expect(missing.status).toBe("missing_environment");
    expect(missing.products).toEqual([]);
  });
});
