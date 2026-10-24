import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import HomePage from "@/app/page";
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
  audience: "men",
  priceCop: 199900,
  featured: true,
  createdAt: "2026-04-03T10:00:00.000Z",
  updatedAt: "2026-04-03T10:00:00.000Z",
  brand: { id: "b1", name: "Marca Uno", slug: "marca-uno" },
  image: null,
  variants: [{ id: "v1", productId: "p1", size: "40", color: "Negro", sku: "R1-40", available: true, stockLabel: "Disponible" }],
};

const ready: PublicCatalogResult = {
  status: "ready",
  products: [product],
  settings: { whatsappPhone: "573001234567", supportUrl: "https://wa.me/573001234567?text=Hola", dispatchOriginCity: "Bogotá", inventoryLowThreshold: 3, stockDisplayMode: "availability_only" },
  warnings: [],
  message: null,
};

beforeEach(() => {
  vi.mocked(loadPublicCatalog).mockResolvedValue(ready);
});

describe("public storefront homepage", () => {
  it("leads with the live campaign, Colombia market, and featured product discovery", async () => {
    render(await HomePage());

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /carrito.*0/i })).toHaveAttribute("href", "/cart");
    expect(screen.getAllByText(/Zona de pasos store/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/solo para Colombia/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /tu próximo paso empieza aquí/i })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: /ritmo 01/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /ver catálogo/i })).toHaveAttribute("href", "/catalog");
    expect(screen.getAllByRole("link", { name: /ritmo 01/i })[0]).toHaveAttribute("href", "/products/ritmo-01");
  });

  it("provides audience entry points, payment/shipping explanations, and configurable support", async () => {
    render(await HomePage());

    expect(screen.getByRole("link", { name: /tenis para hombre/i })).toHaveAttribute("href", "/catalog?audience=men");
    expect(screen.getByRole("link", { name: /tenis para mujer/i })).toHaveAttribute("href", "/catalog?audience=women");
    expect(screen.getAllByText(/pago anticipado por Nequi/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/envíos locales y nacionales/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /whatsapp/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /whatsapp/i })[0]).toHaveAttribute("href", expect.stringContaining("wa.me/573001234567"));
  });

  it("shows an honest empty catalog state without placeholder promises", async () => {
    vi.mocked(loadPublicCatalog).mockResolvedValue({ ...ready, status: "empty", products: [], message: "Aún no hay productos publicados." });

    render(await HomePage());

    expect(screen.getByRole("status")).toHaveTextContent(/aún no hay productos publicados/i);
    expect(screen.getByText(/la selección se está preparando/i)).toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
  });

  it("shows a truthful catalog error and a non-link support fallback", async () => {
    vi.mocked(loadPublicCatalog).mockResolvedValue({ ...ready, status: "database_error", products: [], settings: { ...ready.settings, supportUrl: null, whatsappPhone: "" }, message: "No fue posible cargar el catálogo." });

    render(await HomePage());

    expect(screen.getByRole("alert")).toHaveTextContent(/no fue posible cargar el catálogo/i);
    expect(screen.queryByRole("link", { name: /whatsapp/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/whatsapp no está configurado/i).length).toBeGreaterThan(0);
  });
});
