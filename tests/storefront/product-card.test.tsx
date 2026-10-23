import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AudienceLabel,
  Price,
  ProductCard,
  StockLabel,
} from "@/components/storefront";
import type { PublicProduct } from "@/types/storefront";

const item: PublicProduct = {
  id: "p1",
  brandId: "b1",
  name: "Ritmo 01",
  slug: "ritmo-01",
  description: "Tenis para moverte.",
  audience: "women",
  priceCop: 249900,
  featured: true,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
  brand: { id: "b1", name: "Marca Uno", slug: "marca-uno" },
  image: {
    id: "image-1",
    productId: "p1",
    secureUrl: "https://res.cloudinary.com/demo/image/upload/v1/ritmo-01.jpg",
    altText: "Tenis Ritmo 01 blancos",
    position: 0,
    width: 800,
    height: 800,
  },
  variants: [{ id: "v1", productId: "p1", size: "38", color: "Blanco", sku: "R1-38", available: true, stockLabel: "Pocas unidades" }],
};

describe("storefront presentation primitives", () => {
  it("formats COP and presents Spanish audience and safe stock labels", () => {
    render(<><Price value={249900} /><AudienceLabel audience="women" /><StockLabel available label="Pocas unidades" /></>);

    expect(screen.getByText(/249\.900/)).toBeInTheDocument();
    expect(screen.getByText("Mujer")).toBeInTheDocument();
    expect(screen.getByText("Pocas unidades")).toBeInTheDocument();
    expect(screen.queryByText(/249900|\b\d+\s+unidades|stock/i)).not.toBeInTheDocument();
  });

  it("renders an accessible card with safe Cloudinary image and no exact quantity", () => {
    render(<ProductCard product={item} />);

    expect(screen.getByRole("article", { name: /ritmo 01/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /tenis ritmo 01 blancos/i })).toHaveAttribute("src", expect.stringContaining("res.cloudinary.com"));
    expect(screen.getByText("Marca Uno")).toBeInTheDocument();
    expect(screen.getByText("Mujer")).toBeInTheDocument();
    expect(screen.getByText("Pocas unidades")).toBeInTheDocument();
    expect(screen.queryByText(/stock_quantity|\b\d+\s+unidades|sku/i)).not.toBeInTheDocument();
  });

  it("uses an honest image fallback and unavailable label", () => {
    render(<ProductCard product={{ ...item, image: null, variants: [{ ...item.variants[0], available: false, stockLabel: "No disponible" }] }} />);

    expect(screen.getByLabelText("Imagen no disponible")).toBeInTheDocument();
    expect(screen.getByText("No disponible")).toBeInTheDocument();
  });
});
