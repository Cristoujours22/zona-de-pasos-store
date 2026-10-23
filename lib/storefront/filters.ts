import type { ProductAudience } from "@/types/catalog";
import type { PublicBrand, PublicFilterOptions, PublicProduct } from "@/types/storefront";

export interface PublicProductFilters {
  audience?: ProductAudience;
  brand?: string;
  size?: string;
  color?: string;
  minPriceCop?: number;
  maxPriceCop?: number;
}

export type PublicProductSort = "featured" | "new" | "newest" | "name" | "price" | "price_asc" | "price_desc";

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("es");
}

function matchesAudience(product: PublicProduct, audience: ProductAudience | undefined): boolean {
  if (!audience) return true;
  return product.audience === audience;
}

function matchesVariant(product: PublicProduct, field: "size" | "color", value: string | undefined): boolean {
  if (!value?.trim()) return true;
  const target = normalized(value);
  return product.variants.some((variant) => normalized(variant[field]) === target);
}

function matchesBrand(product: PublicProduct, value: string | undefined): boolean {
  if (!value?.trim()) return true;
  if (!product.brand) return false;
  const target = normalized(value);
  return [product.brand.id, product.brand.slug, product.brand.name].some((candidate) => normalized(candidate) === target);
}

export function filterPublicProducts(products: PublicProduct[], filters: PublicProductFilters = {}): PublicProduct[] {
  return products.filter((product) => {
    if (!matchesAudience(product, filters.audience)) return false;
    if (!matchesBrand(product, filters.brand)) return false;
    if (!matchesVariant(product, "size", filters.size)) return false;
    if (!matchesVariant(product, "color", filters.color)) return false;
    if (filters.minPriceCop !== undefined && product.priceCop < filters.minPriceCop) return false;
    if (filters.maxPriceCop !== undefined && product.priceCop > filters.maxPriceCop) return false;
    return true;
  });
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "es", { sensitivity: "base" });
}

export function sortPublicProducts(products: PublicProduct[], sort: PublicProductSort = "featured"): PublicProduct[] {
  return products
    .map((product, index) => ({ product, index }))
    .sort((left, right) => {
      let comparison = 0;
      if (sort === "featured") comparison = Number(right.product.featured) - Number(left.product.featured);
      else if (sort === "new" || sort === "newest") comparison = Date.parse(right.product.createdAt || "") - Date.parse(left.product.createdAt || "");
      else if (sort === "name") comparison = compareText(left.product.name, right.product.name);
      else if (sort === "price" || sort === "price_asc") comparison = left.product.priceCop - right.product.priceCop;
      else if (sort === "price_desc") comparison = right.product.priceCop - left.product.priceCop;
      return comparison || left.index - right.index;
    })
    .map(({ product }) => product);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

export function deriveFilterOptions(products: PublicProduct[]): PublicFilterOptions {
  const brands = new Map<string, PublicBrand>();
  const sizes: string[] = [];
  const colors: string[] = [];
  for (const product of products) {
    if (product.brand) brands.set(product.brand.id, product.brand);
    for (const variant of product.variants) {
      sizes.push(variant.size);
      colors.push(variant.color);
    }
  }
  const prices = products.map((product) => product.priceCop);
  const audiences: ProductAudience[] = ["men", "women", "unisex"].filter((audience): audience is ProductAudience => products.some((product) => product.audience === audience));
  return {
    audiences,
    brands: [...brands.values()].sort((left, right) => compareText(left.name, right.name)),
    sizes: uniqueSorted(sizes),
    colors: uniqueSorted(colors),
    minPriceCop: prices.length ? Math.min(...prices) : null,
    maxPriceCop: prices.length ? Math.max(...prices) : null,
  };
}
