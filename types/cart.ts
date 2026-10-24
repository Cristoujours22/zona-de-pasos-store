export const CART_SCHEMA_VERSION = 1 as const;
export const CART_MIN_QUANTITY = 1;
export const CART_MAX_QUANTITY = 99;

export interface CartItem {
  productId: string;
  variantId: string;
  productSlug: string;
  productName: string;
  brandName: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  size: string;
  color: string;
  sku: string;
  /** Informational browser snapshot only; server prices remain authoritative. */
  displayPriceCop: number;
  quantity: number;
}

export interface StoredCart {
  version: typeof CART_SCHEMA_VERSION;
  items: CartItem[];
}
