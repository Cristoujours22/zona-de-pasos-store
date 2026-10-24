import type { ProductAudience, StockDisplayMode } from "@/types/catalog";

export interface PublicBrand {
  id: string;
  name: string;
  slug: string;
}

export interface PublicProductImage {
  id: string;
  productId: string;
  secureUrl: string;
  altText: string;
  position: number;
  width: number;
  height: number;
}

export interface PublicProductVariant {
  id: string;
  productId: string;
  size: string;
  color: string;
  sku: string;
  available: boolean;
  stockLabel: string | null;
}

export interface PublicProduct {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  description: string;
  audience: ProductAudience;
  priceCop: number;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  brand: PublicBrand | null;
  image: PublicProductImage | null;
  variants: PublicProductVariant[];
}

export interface PublicStorefrontSettings {
  whatsappPhone: string;
  supportUrl: string | null;
  dispatchOriginCity: string;
  inventoryLowThreshold: number;
  stockDisplayMode: StockDisplayMode;
}

export type PublicCatalogWarning =
  | "invalid_product"
  | "invalid_brand"
  | "invalid_image"
  | "invalid_variant"
  | "orphan_variant"
  | "missing_variants"
  | "missing_settings";

export type PublicCatalogStatus = "ready" | "empty" | "missing_environment" | "database_error";

export interface PublicCatalogResult {
  status: PublicCatalogStatus;
  products: PublicProduct[];
  settings: PublicStorefrontSettings;
  warnings: PublicCatalogWarning[];
  message: string | null;
}

export interface PublicFilterOptions {
  audiences: ProductAudience[];
  brands: PublicBrand[];
  sizes: string[];
  colors: string[];
  minPriceCop: number | null;
  maxPriceCop: number | null;
}
