import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import CatalogPage from "@/app/catalog/page";
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
  description: "Tenis para moverte.",
  audience: "women",
  priceCop: 150000,
  featured: true,
  createdAt: "2026-04-03T10:00:00.000Z",
  updatedAt: "2026-04-03T10:00:00.000Z",
  brand: { id: "b1", name: "Marca Uno", slug: "marca-uno" },
  image: null,
  variants: [{ id: "v1", productId: "p1", size: "38", color: "Negro", sku: "R1-38", available: true, stockLabel: "Disponible" }],
};

const ready: PublicCatalogResult = {
  status: "ready",
  products: [product],
  settings: { whatsappPhone: "573001234567", supportUrl: "https://wa.me/573001234567?text=Hola", dispatchOriginCity: "Bogotá", inventoryLowThreshold: 3, stockDisplayMode: "availability_only" },
  warnings: [],
  message: null,
};

function renderPage(query: Record<string, string | string[] | undefined> = {}) {
  return CatalogPage({ searchParams: Promise.resolve(query) });
}

beforeEach(() => {
  vi.mocked(loadPublicCatalog).mockResolvedValue(ready);
});

describe("public catalog page", () => {
  it("renders GET filters, selected values, result count, and a reset URL", async () => {
    render(await renderPage({ audience: "women", min: "150000", sort: "price_desc" }));

    expect(screen.getByRole("heading", { name: /catálogo/i })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: /filtrar catálogo/i })).toHaveAttribute("method", "get");
    expect(screen.getByRole("combobox", { name: /audiencia/i })).toHaveValue("women");
    expect(screen.getByRole("spinbutton", { name: /precio mínimo/i })).toHaveValue(150000);
    expect(screen.getByRole("combobox", { name: /ordenar/i })).toHaveValue("price_desc");
    expect(screen.getByText(/1 resultado/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /limpiar filtros/i })).toHaveAttribute("href", "/catalog");
    expect(screen.getByRole("link", { name: /ritmo 01/i })).toHaveAttribute("href", "/products/ritmo-01");
  });

  it("shows an honest empty-filter state with a clear action", async () => {
    render(await renderPage({ audience: "men" }));

    expect(screen.getByRole("status")).toHaveTextContent(/no encontramos pares/i);
    expect(screen.getByRole("link", { name: /quitar filtros/i })).toHaveAttribute("href", "/catalog");
  });

  it("shows the public data error without inventing products", async () => {
    vi.mocked(loadPublicCatalog).mockResolvedValue({ ...ready, status: "database_error", products: [], message: "No fue posible cargar el catálogo." });

    render(await renderPage());

    expect(screen.getByRole("alert")).toHaveTextContent(/no fue posible cargar el catálogo/i);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});
