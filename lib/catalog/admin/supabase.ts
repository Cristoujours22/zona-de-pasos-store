import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminProductSummary, Brand, CommerceSettings, ProductImage, ProductVariant } from "@/types/catalog";
import { CatalogPersistenceError, type CatalogAdminAdapter, type InventoryAdjustInput, type ProductCreateInput, type ProductUpdateInput, type SettingsUpdateInput } from "@/lib/catalog/admin/service";

type DbError = { code?: string; message?: string } | null;

function fail(error: DbError, ambiguous = false): void {
  if (error) throw new CatalogPersistenceError(error.message ?? "database failure", ambiguous);
}

function row(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CatalogPersistenceError("missing database row");
  return value as Record<string, unknown>;
}

function brand(value: unknown): Brand {
  const item = row(value);
  return { id: String(item.id), name: String(item.name), slug: String(item.slug) };
}

function image(value: unknown): ProductImage {
  const item = row(value);
  return { id: String(item.id), productId: String(item.product_id), cloudinaryPublicId: String(item.cloudinary_public_id), secureUrl: String(item.secure_url), altText: String(item.alt_text), position: Number(item.position), width: Number(item.width), height: Number(item.height) };
}

function variant(value: unknown): ProductVariant {
  const item = row(value);
  return { id: String(item.id), productId: String(item.product_id), size: String(item.size), color: String(item.color), sku: String(item.sku), active: Boolean(item.active), stockQuantity: Number(item.stock_quantity) };
}

function summary(value: unknown): AdminProductSummary {
  const item = row(value);
  const rawBrand = Array.isArray(item.brands) ? item.brands[0] : item.brands;
  const rawImages = Array.isArray(item.product_images) ? item.product_images : [];
  const rawVariants = Array.isArray(item.product_variants) ? item.product_variants : [];
  return {
    id: String(item.id), brandId: String(item.brand_id), name: String(item.name), slug: String(item.slug), description: String(item.description ?? ""),
    audience: item.audience as AdminProductSummary["audience"], priceCop: Number(item.price_cop), lifecycle: item.lifecycle as AdminProductSummary["lifecycle"], featured: Boolean(item.featured),
    createdAt: new Date(String(item.created_at)), updatedAt: new Date(String(item.updated_at)), brand: brand(rawBrand), image: rawImages[0] ? image(rawImages[0]) : null, variants: rawVariants.map(variant),
  };
}

function settings(value: unknown): CommerceSettings {
  const item = row(value);
  return { whatsappPhone: String(item.whatsapp_phone), nequiDetails: String(item.nequi_details), dispatchOriginCity: String(item.dispatch_origin_city), dispatchOriginAddress: String(item.dispatch_origin_address), inventoryLowThreshold: Number(item.inventory_low_threshold), stockDisplayMode: item.stock_display_mode as CommerceSettings["stockDisplayMode"] };
}

export function createSupabaseCatalogAdminAdapter(client: SupabaseClient): CatalogAdminAdapter {
  return {
    async listBrands() {
      const result = await client.from("brands").select("id, name, slug").order("name", { ascending: true });
      fail(result.error);
      return (result.data ?? []).map(brand);
    },
    async createBrand(input) {
      const result = await client.from("brands").insert({ name: input.name, slug: input.slug }).select("id, name, slug").single();
      fail(result.error);
      return brand(result.data);
    },
    async createProduct(input: ProductCreateInput) {
      const result = await client.rpc("create_product_atomic", {
        p_brand_id: input.brandId, p_name: input.name, p_slug: input.slug, p_description: input.description, p_audience: input.audience, p_price_cop: input.priceCop,
        p_lifecycle: input.lifecycle, p_featured: input.featured,
        p_image: { cloudinary_public_id: input.image.cloudinaryPublicId, secure_url: input.image.secureUrl, alt_text: input.image.altText, width: input.image.width, height: input.image.height },
        p_variants: input.variants.map((item) => ({ size: item.size, color: item.color, sku: item.sku, active: item.active, stock_quantity: item.stockQuantity })),
      });
      fail(result.error, Boolean(result.error && !["23505", "23514", "22P02", "23503"].includes(result.error.code ?? "")));
      if (typeof result.data !== "string") throw new CatalogPersistenceError("missing product id", true);
      return { id: result.data };
    },
    async listProducts() {
      const result = await client.from("products").select("id, brand_id, name, slug, description, audience, price_cop, lifecycle, featured, created_at, updated_at, brands(id, name, slug), product_images(id, product_id, cloudinary_public_id, secure_url, alt_text, position, width, height), product_variants(id, product_id, size, color, sku, active, stock_quantity)").order("created_at", { ascending: false });
      fail(result.error);
      return (result.data ?? []).map(summary);
    },
    async updateProduct(id: string, input: ProductUpdateInput) {
      const update = {
        ...(input.name === undefined ? {} : { name: input.name }), ...(input.slug === undefined ? {} : { slug: input.slug }), ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.audience === undefined ? {} : { audience: input.audience }), ...(input.priceCop === undefined ? {} : { price_cop: input.priceCop }), ...(input.lifecycle === undefined ? {} : { lifecycle: input.lifecycle }), ...(input.featured === undefined ? {} : { featured: input.featured }),
      };
      const result = await client.from("products").update(update).eq("id", id).select("id").single();
      fail(result.error);
      return result.data;
    },
    async getSettings() {
      const result = await client.from("commerce_settings").select("whatsapp_phone, nequi_details, dispatch_origin_city, dispatch_origin_address, inventory_low_threshold, stock_display_mode").eq("singleton", true).single();
      fail(result.error);
      return settings(result.data);
    },
    async updateSettings(input: SettingsUpdateInput) {
      const update = {
        ...(input.whatsappPhone === undefined ? {} : { whatsapp_phone: input.whatsappPhone }), ...(input.nequiDetails === undefined ? {} : { nequi_details: input.nequiDetails }),
        ...(input.dispatchOriginCity === undefined ? {} : { dispatch_origin_city: input.dispatchOriginCity }), ...(input.dispatchOriginAddress === undefined ? {} : { dispatch_origin_address: input.dispatchOriginAddress }),
        ...(input.inventoryLowThreshold === undefined ? {} : { inventory_low_threshold: input.inventoryLowThreshold }), ...(input.stockDisplayMode === undefined ? {} : { stock_display_mode: input.stockDisplayMode }),
      };
      const result = await client.from("commerce_settings").update(update).eq("singleton", true).select("whatsapp_phone, nequi_details, dispatch_origin_city, dispatch_origin_address, inventory_low_threshold, stock_display_mode").single();
      fail(result.error);
      return settings(result.data);
    },
    async adjustInventory(input: InventoryAdjustInput) {
      const result = await client.rpc("adjust_inventory", { p_variant_id: input.variantId, p_delta: input.delta, p_reason: input.reason, p_order_reference: input.orderReference ?? null });
      fail(result.error);
      if (!Number.isSafeInteger(result.data) || result.data < 0) throw new CatalogPersistenceError("missing stock result");
      return { stockQuantity: result.data };
    },
  };
}
