import { describe, expect, it } from "vitest";

import {
  addToCart,
  cartItemFromProduct,
  getCartItemCount,
  getCartSubtotal,
  removeCartItem,
  setCartItemQuantity,
} from "@/lib/cart/domain";
import { parseCartStorage, readCart, serializeCart, writeCart } from "@/lib/cart/storage";
import type { CartItem } from "@/types/cart";
import type { PublicProduct } from "@/types/storefront";

const product: PublicProduct = {
  id: "p1",
  brandId: "b1",
  name: "Ritmo 01",
  slug: "ritmo-01",
  description: "Tenis para moverte.",
  audience: "women",
  priceCop: 249900,
  featured: false,
  createdAt: "2026-04-03T10:00:00.000Z",
  updatedAt: "2026-04-03T10:00:00.000Z",
  brand: { id: "b1", name: "Marca Uno", slug: "marca-uno" },
  image: { id: "image-1", productId: "p1", secureUrl: "https://res.cloudinary.com/demo/ritmo.jpg", altText: "Tenis Ritmo 01", position: 0, width: 800, height: 800 },
  variants: [
    { id: "v1", productId: "p1", size: "38", color: "Blanco", sku: "R1-38", available: true, stockLabel: null },
    { id: "v2", productId: "p1", size: "39", color: "Negro", sku: "R1-39", available: false, stockLabel: "No disponible" },
  ],
};

const item: CartItem = cartItemFromProduct(product, product.variants[0], 2);

function brokenStorage(): Storage {
  return {
    getItem: () => { throw new Error("read denied"); },
    setItem: () => { throw new Error("write denied"); },
    removeItem: () => { throw new Error("remove denied"); },
    clear: () => { throw new Error("clear denied"); },
    key: () => null,
    get length() { return 0; },
  };
}

describe("cart domain and browser persistence", () => {
  it("strictly accepts only the current version and safe display snapshots", () => {
    const serialized = serializeCart([item]);

    expect(parseCartStorage(serialized)).toEqual([item]);
    expect(parseCartStorage("not-json")).toEqual([]);
    expect(parseCartStorage(JSON.stringify({ version: 99, items: [item] }))).toEqual([]);
    expect(parseCartStorage(JSON.stringify({ version: 1, items: [{ ...item, buyer: { phone: "300" } }] }))).toEqual([]);
    expect(parseCartStorage(JSON.stringify({ version: 1, items: [{ ...item, imageUrl: "https://tracking.example/cart.jpg" }] }))).toEqual([]);
    expect(serialized).not.toMatch(/stockQuantity|stock_quantity|buyer|token|payment/i);
  });

  it("survives browser storage exceptions without throwing", () => {
    const storage = brokenStorage();

    expect(readCart(storage)).toEqual([]);
    expect(writeCart([item], storage)).toBe(false);
  });

  it("merges the same variant and clamps quantities to one through ninety-nine", () => {
    const first = addToCart([], product, product.variants[0], 98);
    const merged = addToCart(first.items, product, product.variants[0], 10);

    expect(first.items[0].quantity).toBe(98);
    expect(merged.items[0].quantity).toBe(99);
    expect(setCartItemQuantity(merged.items, "v1", 0)[0].quantity).toBe(1);
    expect(setCartItemQuantity(merged.items, "v1", 100)[0].quantity).toBe(99);
  });

  it("rejects unavailable variants without leaking exact stock", () => {
    const result = addToCart([], product, product.variants[1], 1);

    expect(result.error).toMatch(/no está disponible/i);
    expect(result.items).toEqual([]);
    expect(JSON.stringify(cartItemFromProduct(product, product.variants[0]))).not.toMatch(/stock|units|unidades/i);
  });

  it("computes informational subtotal, count, and removal", () => {
    const items = [item, { ...item, variantId: "v3", quantity: 1, displayPriceCop: 100000 }];

    expect(getCartItemCount(items)).toBe(3);
    expect(getCartSubtotal(items)).toBe(599800);
    expect(removeCartItem(items, "v1")).toHaveLength(1);
    expect(removeCartItem(items, "v3")).toHaveLength(1);
  });
});
