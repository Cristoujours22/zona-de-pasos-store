import type { ProductAudience } from "@/types/catalog";
import type { PublicProductSort } from "@/lib/storefront/filters";
import type { PublicProductFilters } from "@/lib/storefront/filters";

export interface CatalogQuery extends PublicProductFilters {
  sort: PublicProductSort;
}

export type CatalogSearchParams = Record<string, string | string[] | undefined> | URLSearchParams;

const SORT_ALIASES: Record<string, PublicProductSort> = {
  featured: "featured",
  newest: "newest",
  new: "newest",
  name: "name",
  price: "price_asc",
  price_asc: "price_asc",
  price_desc: "price_desc",
};

function firstValue(params: CatalogSearchParams, key: string): string | null {
  if (params instanceof URLSearchParams) return params.get(key);
  const value = params[key];
  return typeof value === "string" ? value : null;
}

function safeText(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > 80 || !/^[\p{L}\p{N}][\p{L}\p{N}\s._-]*$/u.test(normalized)) return undefined;
  return normalized;
}

function safeAudience(value: string | null): ProductAudience | undefined {
  return value === "men" || value === "women" || value === "unisex" ? value : undefined;
}

function safePrice(value: string | null): number | undefined {
  if (!value || !/^\d{1,9}$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export function parseCatalogQuery(params: CatalogSearchParams = {}): CatalogQuery {
  const rawMin = firstValue(params, "min");
  const rawMax = firstValue(params, "max");
  const minPriceCop = safePrice(rawMin);
  const maxPriceCop = safePrice(rawMax);
  const sortValue = firstValue(params, "sort");
  const sort = sortValue ? SORT_ALIASES[sortValue] ?? "featured" : "featured";
  const invalidMin = rawMin !== null && rawMin.trim() !== "" && minPriceCop === undefined;
  const invalidMax = rawMax !== null && rawMax.trim() !== "" && maxPriceCop === undefined;

  if (invalidMin || invalidMax || (minPriceCop !== undefined && maxPriceCop !== undefined && minPriceCop > maxPriceCop)) return { sort };

  const audienceValue = firstValue(params, "audience");
  const brand = safeText(firstValue(params, "brand"));
  const size = safeText(firstValue(params, "size"));
  const color = safeText(firstValue(params, "color"));
  return {
    ...(safeAudience(audienceValue) ? { audience: safeAudience(audienceValue) } : {}),
    ...(brand ? { brand } : {}),
    ...(size ? { size } : {}),
    ...(color ? { color } : {}),
    ...(minPriceCop !== undefined ? { minPriceCop } : {}),
    ...(maxPriceCop !== undefined ? { maxPriceCop } : {}),
    sort,
  };
}

export function buildCatalogQuery(query: CatalogQuery): string {
  const params = new URLSearchParams();
  if (query.audience) params.set("audience", query.audience);
  if (query.brand) params.set("brand", query.brand);
  if (query.size) params.set("size", query.size);
  if (query.color) params.set("color", query.color);
  if (query.minPriceCop !== undefined) params.set("min", String(query.minPriceCop));
  if (query.maxPriceCop !== undefined) params.set("max", String(query.maxPriceCop));
  if (query.sort !== "featured") params.set("sort", query.sort === "new" ? "newest" : query.sort);
  const value = params.toString();
  return value ? `?${value}` : "";
}

export const serializeCatalogQuery = buildCatalogQuery;

export function catalogFilters(query: CatalogQuery): PublicProductFilters {
  return {
    ...(query.audience ? { audience: query.audience } : {}),
    ...(query.brand ? { brand: query.brand } : {}),
    ...(query.size ? { size: query.size } : {}),
    ...(query.color ? { color: query.color } : {}),
    ...(query.minPriceCop !== undefined ? { minPriceCop: query.minPriceCop } : {}),
    ...(query.maxPriceCop !== undefined ? { maxPriceCop: query.maxPriceCop } : {}),
  };
}
