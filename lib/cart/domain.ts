import type { PublicProduct, PublicProductVariant } from "@/types/storefront";
import { CART_MAX_QUANTITY, CART_MIN_QUANTITY, type CartItem } from "@/types/cart";

export interface CartMutationResult {
  items: CartItem[];
  error?: string;
  merged?: boolean;
}

export function clampCartQuantity(value: number): number {
  if (!Number.isFinite(value)) return CART_MIN_QUANTITY;
  return Math.min(CART_MAX_QUANTITY, Math.max(CART_MIN_QUANTITY, Math.trunc(value)));
}

export function cartItemFromProduct(product: PublicProduct, variant: PublicProductVariant, quantity = CART_MIN_QUANTITY): CartItem {
  return {
    productId: product.id,
    variantId: variant.id,
    productSlug: product.slug,
    productName: product.name,
    brandName: product.brand?.name ?? null,
    imageUrl: product.image?.secureUrl ?? null,
    imageAlt: product.image?.altText ?? null,
    size: variant.size,
    color: variant.color,
    sku: variant.sku,
    displayPriceCop: product.priceCop,
    quantity: clampCartQuantity(quantity),
  };
}

export function addToCart(items: CartItem[], product: PublicProduct, variant: PublicProductVariant, quantity = CART_MIN_QUANTITY): CartMutationResult {
  if (variant.productId !== product.id || !variant.available) {
    return { items, error: "Esta variante no está disponible." };
  }

  const amount = clampCartQuantity(quantity);
  const existingIndex = items.findIndex((item) => item.variantId === variant.id);
  if (existingIndex < 0) return { items: [...items, cartItemFromProduct(product, variant, amount)] };

  const next = [...items];
  next[existingIndex] = { ...next[existingIndex], quantity: clampCartQuantity(next[existingIndex].quantity + amount) };
  return { items: next, merged: true };
}

export function setCartItemQuantity(items: CartItem[], variantId: string, quantity: number): CartItem[] {
  return items.map((item) => item.variantId === variantId ? { ...item, quantity: clampCartQuantity(quantity) } : item);
}

export function removeCartItem(items: CartItem[], variantId: string): CartItem[] {
  return items.filter((item) => item.variantId !== variantId);
}

export function getCartItemCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function getCartSubtotal(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.displayPriceCop * item.quantity, 0);
}
