import type {
  PublicCatalogResult,
  PublicCatalogWarning,
  PublicProduct,
  PublicProductImage,
  PublicProductVariant,
} from "@/types/storefront";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { emptyPublicSettings, normalizePublicSettings } from "@/lib/storefront/support";
import { isSafeCloudinaryUrl } from "@/lib/storefront/image";
import type { PublicStorefrontSettings } from "@/types/storefront";

export const PUBLIC_PRODUCT_SELECT = "id, brand_id, name, slug, description, audience, price_cop, featured, created_at, updated_at, brands(id, name, slug), product_images(id, product_id, secure_url, alt_text, position, width, height)";
export const PUBLIC_VARIANT_SELECT = "id, product_id, size, color, sku, available, stock_label";
export const PUBLIC_SETTINGS_SELECT = "whatsapp_phone, dispatch_origin_city, inventory_low_threshold, stock_display_mode";

interface PublicQueryResult {
  data: unknown;
  error: { message?: string } | null;
}

interface PublicQuery extends PromiseLike<PublicQueryResult> {
  eq(column: string, value: string): PublicQuery;
  order(column: string, options: { ascending: boolean }): Promise<PublicQueryResult>;
  maybeSingle(): Promise<PublicQueryResult>;
}

export interface PublicCatalogClient {
  from(table: string): { select(selection: string): PublicQuery };
}

export interface PublicCatalogRows {
  products: unknown[];
  variants: unknown[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : null;
}

function productAudience(value: unknown): PublicProduct["audience"] | null {
  return value === "men" || value === "women" || value === "unisex" ? value : null;
}

function warning(warnings: PublicCatalogWarning[], value: PublicCatalogWarning): void {
  warnings.push(value);
}

function mapBrand(value: unknown, warnings: PublicCatalogWarning[]): PublicProduct["brand"] {
  const raw = Array.isArray(value) ? value[0] : value;
  const item = record(raw);
  const id = text(item?.id);
  const name = text(item?.name);
  const slug = text(item?.slug);
  if (!id || !name || !slug) {
    if (raw !== undefined && raw !== null) warning(warnings, "invalid_brand");
    return null;
  }
  return { id, name, slug };
}

function mapImage(value: unknown, warnings: PublicCatalogWarning[]): PublicProductImage | null {
  const item = record(value);
  const id = text(item?.id);
  const productId = text(item?.product_id);
  const secureUrl = item?.secure_url;
  const altText = text(item?.alt_text);
  const position = Number.isSafeInteger(item?.position) && (item?.position as number) >= 0 ? item?.position as number : null;
  const width = positiveInteger(item?.width);
  const height = positiveInteger(item?.height);
  if (!id || !productId || !isSafeCloudinaryUrl(secureUrl) || !altText || position === null || width === null || height === null) {
    warning(warnings, "invalid_image");
    return null;
  }
  return { id, productId, secureUrl, altText, position, width, height };
}

const SAFE_STOCK_LABELS = new Set(["Disponible", "Pocas unidades", "Sin stock", "No disponible"]);

function mapVariant(value: unknown, warnings: PublicCatalogWarning[]): PublicProductVariant | null {
  const item = record(value);
  const id = text(item?.id);
  const productId = text(item?.product_id);
  const size = text(item?.size);
  const color = text(item?.color);
  const sku = text(item?.sku);
  const rawStockLabel = item?.stock_label;
  const stockLabel: string | null = rawStockLabel === null || rawStockLabel === undefined ? null : typeof rawStockLabel === "string" ? rawStockLabel.trim() || null : "__invalid__";
  if (!id || !productId || !size || !color || !sku || typeof item?.available !== "boolean" || (stockLabel !== null && !SAFE_STOCK_LABELS.has(stockLabel))) {
    warning(warnings, "invalid_variant");
    return null;
  }
  return {
    id,
    productId,
    size,
    color,
    sku,
    available: item.available,
    stockLabel,
  };
}

function mapProduct(value: unknown, warnings: PublicCatalogWarning[]): PublicProduct | null {
  const item = record(value);
  if (!item) {
    warning(warnings, "invalid_product");
    return null;
  }
  if (item.lifecycle !== undefined && item.lifecycle !== "published") return null;
  const id = text(item.id);
  const brandId = text(item.brand_id);
  const name = text(item.name);
  const slug = text(item.slug);
  const audience = productAudience(item.audience);
  const priceCop = item.price_cop;
  if (!id || !brandId || !name || !slug || !audience || !Number.isSafeInteger(priceCop) || (priceCop as number) < 0) {
    warning(warnings, "invalid_product");
    return null;
  }

  const imageRows = Array.isArray(item.product_images) ? item.product_images : [];
  const images = imageRows.map((image) => mapImage(image, warnings)).filter((image): image is PublicProductImage => image !== null);
  if (imageRows.length > 0 && images.length === 0) warning(warnings, "invalid_image");
  images.sort((left, right) => left.position - right.position);
  const brand = mapBrand(item.brands, warnings);
  return {
    id,
    brandId,
    name,
    slug,
    description: typeof item.description === "string" ? item.description.trim() : "",
    audience,
    priceCop: priceCop as number,
    featured: item.featured === true,
    createdAt: typeof item.created_at === "string" ? item.created_at : "",
    updatedAt: typeof item.updated_at === "string" ? item.updated_at : "",
    brand,
    image: images[0] ?? null,
    variants: [],
  };
}

export function mergePublicCatalogRows(productRows: unknown[], variantRows: unknown[]): { products: PublicProduct[]; warnings: PublicCatalogWarning[] } {
  const warnings: PublicCatalogWarning[] = [];
  const products: PublicProduct[] = [];
  const byId = new Map<string, PublicProduct>();
  for (const row of productRows) {
    const product = mapProduct(row, warnings);
    if (!product || byId.has(product.id)) {
      if (product && byId.has(product.id)) warning(warnings, "invalid_product");
      continue;
    }
    byId.set(product.id, product);
    products.push(product);
  }

  for (const row of variantRows) {
    const variant = mapVariant(row, warnings);
    if (!variant) continue;
    const product = byId.get(variant.productId);
    if (!product) {
      warning(warnings, "orphan_variant");
      continue;
    }
    product.variants.push(variant);
  }
  for (const product of products) {
    if (product.variants.length === 0) warning(warnings, "missing_variants");
  }
  return { products, warnings };
}

function hasError(result: PublicQueryResult): boolean {
  return Boolean(result.error);
}

function rows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function resultWith(status: PublicCatalogResult["status"], products: PublicProduct[], settings: PublicStorefrontSettings, warnings: PublicCatalogWarning[], message: string | null): PublicCatalogResult {
  return { status, products, settings, warnings, message };
}

export async function loadPublicCatalog(options: { client?: PublicCatalogClient } = {}): Promise<PublicCatalogResult> {
  let client: PublicCatalogClient;
  try {
    client = (options.client ?? createSupabasePublicClient()) as unknown as PublicCatalogClient;
  } catch {
    return resultWith("missing_environment", [], emptyPublicSettings(), [], "El catálogo no está disponible en este momento.");
  }

  try {
    const productRequest = client.from("products").select(PUBLIC_PRODUCT_SELECT).eq("lifecycle", "published").order("created_at", { ascending: false });
    const variantRequest = client.from("storefront_product_variants").select(PUBLIC_VARIANT_SELECT);
    const settingsRequest = client.from("storefront_settings").select(PUBLIC_SETTINGS_SELECT).maybeSingle();
    const [productResult, variantResult, settingsResult] = await Promise.all([productRequest, variantRequest, settingsRequest]);
    if (hasError(productResult) || hasError(variantResult) || hasError(settingsResult)) {
      return resultWith("database_error", [], emptyPublicSettings(), [], "No fue posible cargar el catálogo. Intenta de nuevo más tarde.");
    }

    const merged = mergePublicCatalogRows(rows(productResult.data), rows(variantResult.data));
    const warnings = [...merged.warnings];
    const settings = settingsResult.data === null || settingsResult.data === undefined
      ? (warning(warnings, "missing_settings"), emptyPublicSettings())
      : normalizePublicSettings(settingsResult.data);
    const status = merged.products.length === 0 ? "empty" : "ready";
    const message = status === "empty" ? "Aún no hay productos publicados." : null;
    return resultWith(status, merged.products, settings, warnings, message);
  } catch {
    return resultWith("database_error", [], emptyPublicSettings(), [], "No fue posible cargar el catálogo. Intenta de nuevo más tarde.");
  }
}
