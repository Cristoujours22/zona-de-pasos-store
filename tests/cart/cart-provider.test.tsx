import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CartProvider, useCart } from "@/components/cart/cart-provider";
import { CART_STORAGE_KEY, serializeCart } from "@/lib/cart/storage";
import { cartItemFromProduct } from "@/lib/cart/domain";
import type { PublicProduct } from "@/types/storefront";

const product: PublicProduct = {
  id: "p1",
  brandId: "b1",
  name: "Ritmo 01",
  slug: "ritmo-01",
  description: "",
  audience: "women",
  priceCop: 249900,
  featured: false,
  createdAt: "2026-04-03T10:00:00.000Z",
  updatedAt: "2026-04-03T10:00:00.000Z",
  brand: { id: "b1", name: "Marca Uno", slug: "marca-uno" },
  image: null,
  variants: [{ id: "v1", productId: "p1", size: "38", color: "Blanco", sku: "R1-38", available: true, stockLabel: "Disponible" }],
};

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => { values.clear(); },
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

function Harness() {
  const cart = useCart();
  return (
    <>
      <output data-testid="hydrated">{String(cart.hydrated)}</output>
      <output data-testid="count">{cart.itemCount}</output>
      <output data-testid="subtotal">{cart.subtotalCop}</output>
      <button type="button" onClick={() => { cart.addItem(product, product.variants[0], 2); }}>Agregar</button>
      <button type="button" onClick={() => cart.clearCart()}>Limpiar</button>
    </>
  );
}

describe("CartProvider", () => {
  it("hydrates from local storage, persists a merge, and synchronizes across tabs", async () => {
    const storage = memoryStorage();
    const stored = cartItemFromProduct(product, product.variants[0], 1);
    storage.setItem(CART_STORAGE_KEY, serializeCart([stored]));
    render(<CartProvider storage={storage}><Harness /></CartProvider>);

    await waitFor(() => expect(screen.getByTestId("hydrated")).toHaveTextContent("true"));
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    expect(screen.getByTestId("count")).toHaveTextContent("3");
    expect(JSON.parse(storage.getItem(CART_STORAGE_KEY) ?? "").items[0].quantity).toBe(3);

    const remote = cartItemFromProduct(product, product.variants[0], 7);
    window.dispatchEvent(new StorageEvent("storage", { key: CART_STORAGE_KEY, newValue: serializeCart([remote]) }));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("7"));

    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("keeps the UI usable when storage reads and writes throw", async () => {
    const broken: Storage = {
      getItem: () => { throw new Error("read denied"); },
      setItem: () => { throw new Error("write denied"); },
      removeItem: () => { throw new Error("remove denied"); },
      clear: () => { throw new Error("clear denied"); },
      key: () => null,
      get length() { return 0; },
    };

    render(<CartProvider storage={broken}><Harness /></CartProvider>);
    await waitFor(() => expect(screen.getByTestId("hydrated")).toHaveTextContent("true"));
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Agregar" }))).not.toThrow();
    expect(screen.getByTestId("count")).toHaveTextContent("2");
  });
});
