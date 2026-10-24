import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CartProvider } from "@/components/cart/cart-provider";
import { CartPageContent } from "@/components/cart/cart-page";
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
  image: { id: "image-1", productId: "p1", secureUrl: "https://res.cloudinary.com/demo/ritmo.jpg", altText: "Tenis Ritmo 01", position: 0, width: 800, height: 800 },
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

describe("cart review page", () => {
  it("shows display snapshots, informational COP subtotal, quantity controls, and authority warning", async () => {
    const storage = memoryStorage();
    storage.setItem("zona-de-pasos-store.cart", JSON.stringify({ version: 1, items: [cartItemFromProduct(product, product.variants[0], 2)] }));
    render(<CartProvider storage={storage}><CartPageContent /></CartProvider>);

    await waitFor(() => expect(screen.getByRole("heading", { name: /tu carrito/i })).toBeInTheDocument());
    expect(screen.getByRole("img", { name: /tenis ritmo 01/i })).toBeInTheDocument();
    expect(screen.getByText("Ritmo 01")).toBeInTheDocument();
    expect(screen.getByText("Marca Uno")).toBeInTheDocument();
    expect(screen.getByText(/talla 38/i)).toBeInTheDocument();
    expect(screen.getByText(/color: blanco/i)).toBeInTheDocument();
    expect(screen.getByText(/sku: R1-38/i)).toBeInTheDocument();
    expect(screen.getAllByText(/249\.900/).length).toBeGreaterThan(0);
    expect(screen.getByText(/subtotal informativo/i)).toBeInTheDocument();
    expect(screen.getByText(/disponibilidad.*sujeta a confirmación/i)).toBeInTheDocument();
    expect(screen.getByText(/backend.*autoritario|servidor.*autoridad/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ir al checkout/i })).toHaveAttribute("href", "/checkout");

    const quantity = screen.getByRole("spinbutton", { name: /cantidad.*ritmo 01/i });
    fireEvent.change(quantity, { target: { value: "3" } });
    expect(screen.getAllByText(/749\.700/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /quitar ritmo 01/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/carrito vacío/i);
  });

  it("renders an actionable empty state and can clear all items", async () => {
    const storage = memoryStorage();
    storage.setItem("zona-de-pasos-store.cart", JSON.stringify({ version: 1, items: [cartItemFromProduct(product, product.variants[0], 1)] }));
    render(<CartProvider storage={storage}><CartPageContent /></CartProvider>);

    await waitFor(() => expect(screen.getByRole("heading", { name: /tu carrito/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /vaciar carrito/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/carrito vacío/i);
    expect(screen.getByRole("link", { name: /ver catálogo/i })).toHaveAttribute("href", "/catalog");
  });
});
