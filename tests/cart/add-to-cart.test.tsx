import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CartProvider, useCart } from "@/components/cart/cart-provider";
import { ProductPurchase } from "@/components/cart/product-purchase";
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
  image: null,
  variants: [
    { id: "v1", productId: "p1", size: "38", color: "Blanco", sku: "R1-38", available: true, stockLabel: null },
    { id: "v2", productId: "p1", size: "39", color: "Negro", sku: "R1-39", available: false, stockLabel: null },
  ],
};

function CartCount() {
  return <span data-testid="cart-count">{useCart().itemCount}</span>;
}

describe("product add-to-cart selector", () => {
  it("shows safe variant details, disables unavailable variants, clamps quantity, and gives feedback", () => {
    render(
      <CartProvider>
        <ProductPurchase product={product} />
        <CartCount />
      </CartProvider>,
    );

    expect(screen.getByText("Talla 38")).toBeInTheDocument();
    expect(screen.getByText("Color: Blanco")).toBeInTheDocument();
    expect(screen.getByText("SKU: R1-38")).toBeInTheDocument();
    expect(screen.getByText("Disponible")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /talla 39.*negro/i })).toBeDisabled();
    expect(screen.getByText(/disponibilidad sujeta a confirmación/i)).toBeInTheDocument();
    expect(screen.queryByText(/\b\d+\s+unidades|stock_quantity|stockQuantity/i)).not.toBeInTheDocument();

    const quantity = screen.getByRole("spinbutton", { name: /cantidad/i });
    fireEvent.change(quantity, { target: { value: "100" } });
    expect(quantity).toHaveValue(99);
    fireEvent.change(quantity, { target: { value: "0" } });
    expect(quantity).toHaveValue(1);
    fireEvent.click(screen.getByRole("button", { name: /agregar al carrito/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/agregado al carrito/i);
    expect(screen.getByTestId("cart-count")).toHaveTextContent("1");
    expect(screen.getByRole("link", { name: /ver carrito/i })).toHaveAttribute("href", "/cart");
  });
});
