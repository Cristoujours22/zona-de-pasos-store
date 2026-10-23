import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));

import ProductPage, { generateMetadata } from "@/app/products/[slug]/page";
import { loadPublicCatalog } from "@/lib/storefront/catalog";
import type { PublicCatalogResult, PublicProduct } from "@/types/storefront";

vi.mock("@/lib/storefront/catalog", () => ({
  loadPublicCatalog: vi.fn(),
}));

const product: PublicProduct = {
  id: "p1",
  brandId: "b1",
  name: "Ritmo 01",
  slug: "ritmo-01",
  description: "Tenis para moverte con comodidad.",
  audience: "women",
  priceCop: 249900,
  featured: false,
  createdAt: "2026-04-03T10:00:00.000Z",
  updatedAt: "2026-04-03T10:00:00.000Z",
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
  variants: [
    { id: "v1", productId: "p1", size: "38", color: "Blanco", sku: "R1-38", available: true, stockLabel: "Pocas unidades" },
    { id: "v2", productId: "p1", size: "39", color: "Negro", sku: "R1-39", available: false, stockLabel: "No disponible" },
  ],
};

const ready: PublicCatalogResult = {
  status: "ready",
  products: [product],
  settings: { whatsappPhone: "573001234567", supportUrl: "https://wa.me/573001234567?text=Hola", dispatchOriginCity: "Bogotá", inventoryLowThreshold: 3, stockDisplayMode: "detailed" },
  warnings: [],
  message: null,
};

beforeEach(() => {
  vi.mocked(loadPublicCatalog).mockResolvedValue(ready);
});

describe("public product detail", () => {
  it("shows safe published product details, visible variants, stock labels, and an honest next-step CTA", async () => {
    render(await ProductPage({ params: Promise.resolve({ slug: "ritmo-01" }) }));

    expect(screen.getByRole("heading", { name: /ritmo 01/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /tenis ritmo 01 blancos/i })).toBeInTheDocument();
    expect(screen.getByText("Marca Uno")).toBeInTheDocument();
    expect(screen.getByText(/mujer/i)).toBeInTheDocument();
    expect(screen.getByText(/249\.900/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /talla 38.*blanco/i })).toBeInTheDocument();
    expect(screen.getByText(/color: blanco/i)).toBeInTheDocument();
    expect(screen.getByText(/SKU: R1-38/i)).toBeInTheDocument();
    expect(screen.getByText("Pocas unidades")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /talla 39.*negro/i })).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: /cantidad/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /agregar al carrito/i })).toBeEnabled();
    expect(screen.getByRole("link", { name: /ver carrito/i })).toHaveAttribute("href", "/cart");
    expect(screen.queryByText(/\b\d+\s+unidades|stock_quantity/i)).not.toBeInTheDocument();
    expect(screen.getByText(/verificación humana/i)).toBeInTheDocument();
    expect(screen.getByText(/Bogotá/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /whatsapp/i })[0]).toHaveAttribute("href", expect.stringContaining("wa.me/573001234567"));
  });

  it("does not link to support when public settings have no valid phone", async () => {
    vi.mocked(loadPublicCatalog).mockResolvedValue({ ...ready, settings: { ...ready.settings, whatsappPhone: "", supportUrl: null } });

    render(await ProductPage({ params: Promise.resolve({ slug: "ritmo-01" }) }));

    expect(screen.queryByRole("link", { name: /whatsapp/i })).not.toBeInTheDocument();
    expect(screen.getByText(/whatsapp no está configurado/i)).toBeInTheDocument();
  });

  it("uses 404 behavior and safe metadata for a missing or unpublished product", async () => {
    vi.mocked(loadPublicCatalog).mockResolvedValue({ ...ready, status: "empty", products: [], message: "Aún no hay productos publicados." });

    await expect(ProductPage({ params: Promise.resolve({ slug: "borrador-secreto" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "borrador-secreto" }) });
    expect(metadata.title).toMatch(/producto no encontrado/i);
    expect(JSON.stringify(metadata)).not.toMatch(/borrador-secreto|stock_quantity|nequi_details/i);
  });
});
