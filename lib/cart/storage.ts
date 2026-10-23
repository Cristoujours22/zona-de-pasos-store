import { clampCartQuantity } from "@/lib/cart/domain";
import { isSafeCloudinaryUrl } from "@/lib/storefront/image";
import { CART_MAX_QUANTITY, CART_MIN_QUANTITY, CART_SCHEMA_VERSION, type CartItem, type StoredCart } from "@/types/cart";

export const CART_STORAGE_KEY = "zona-de-pasos-store.cart";

const CART_ITEM_KEYS = new Set([
  "productId", "variantId", "productSlug", "productName", "brandName", "imageUrl", "imageAlt", "size", "color", "sku", "displayPriceCop", "quantity",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Set<string>): boolean {
  return Object.keys(value).every((key) => keys.has(key));
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nullableText(value: unknown): value is string | null {
  return value === null || text(value);
}

function validItem(value: unknown): value is CartItem {
  const item = record(value);
  if (!item || !hasOnlyKeys(item, CART_ITEM_KEYS)) return false;
  return text(item.productId) && text(item.variantId) && text(item.productSlug) && text(item.productName)
    && nullableText(item.brandName) && nullableText(item.imageUrl) && (item.imageUrl === null || isSafeCloudinaryUrl(item.imageUrl)) && nullableText(item.imageAlt)
    && text(item.size) && text(item.color) && text(item.sku)
    && Number.isSafeInteger(item.displayPriceCop) && (item.displayPriceCop as number) >= 0
    && Number.isSafeInteger(item.quantity) && (item.quantity as number) >= CART_MIN_QUANTITY && (item.quantity as number) <= CART_MAX_QUANTITY;
}

function cleanItem(item: CartItem): CartItem {
  return {
    productId: item.productId,
    variantId: item.variantId,
    productSlug: item.productSlug,
    productName: item.productName,
    brandName: item.brandName,
    imageUrl: item.imageUrl,
    imageAlt: item.imageAlt,
    size: item.size,
    color: item.color,
    sku: item.sku,
    displayPriceCop: item.displayPriceCop,
    quantity: clampCartQuantity(item.quantity),
  };
}

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function parseCartStorage(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const root = record(parsed);
    if (!root || root.version !== CART_SCHEMA_VERSION || !Array.isArray(root.items) || !hasOnlyKeys(root, new Set(["version", "items"]))) return [];

    const byVariant = new Map<string, CartItem>();
    for (const value of root.items) {
      if (!validItem(value)) continue;
      const item = cleanItem(value);
      const previous = byVariant.get(item.variantId);
      byVariant.set(item.variantId, previous ? { ...item, quantity: clampCartQuantity(previous.quantity + item.quantity) } : item);
    }
    return [...byVariant.values()];
  } catch {
    return [];
  }
}

export function serializeCart(items: CartItem[]): string {
  const data: StoredCart = {
    version: CART_SCHEMA_VERSION,
    items: items.map(cleanItem),
  };
  return JSON.stringify(data);
}

export function readCart(storage?: Storage | null): CartItem[] {
  const target = resolveStorage(storage);
  if (!target) return [];
  try {
    return parseCartStorage(target.getItem(CART_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[], storage?: Storage | null): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;
  try {
    target.setItem(CART_STORAGE_KEY, serializeCart(items));
    return true;
  } catch {
    return false;
  }
}

export { CART_MAX_QUANTITY, CART_MIN_QUANTITY };
