import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogAdmin } from "@/components/admin/catalog/catalog-admin";
import { formatCop } from "@/lib/catalog/presentation";

const brand = { id: "brand-1", name: "Nike", slug: "nike" };
const products = [
  {
    id: "product-1", brandId: brand.id, name: "Air Runner", slug: "air-runner", description: "Tenis urbanos",
    audience: "men", priceCop: 249900, lifecycle: "draft", featured: false,
    createdAt: "2026-04-02T12:00:00.000Z", updatedAt: "2026-04-02T12:00:00.000Z", brand,
    image: { id: "image-1", productId: "product-1", cloudinaryPublicId: "zona-de-pasos/products/air", secureUrl: "https://cdn.example/air.jpg", altText: "Tenis negros", position: 0, width: 900, height: 900 },
    variants: [
      { id: "variant-1", productId: "product-1", size: "39", color: "Negro", sku: "AIR-39", active: true, stockQuantity: 2 },
    ],
  },
  {
    id: "product-2", brandId: brand.id, name: "Court Low", slug: "court-low", description: "",
    audience: "unisex", priceCop: 399900, lifecycle: "published", featured: true,
    createdAt: "2026-04-01T12:00:00.000Z", updatedAt: "2026-04-01T12:00:00.000Z", brand,
    image: null,
    variants: [
      { id: "variant-2", productId: "product-2", size: "40", color: "Blanco", sku: "COURT-40", active: true, stockQuantity: 5 },
    ],
  },
];

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return { ok, status, json: async () => body };
}

describe("admin catalog dashboard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/brands" && init?.method === "POST") return Promise.resolve(jsonResponse({ id: "brand-2", name: "Adidas", slug: "adidas" }, true, 201));
      if (String(input) === "/api/admin/brands") return Promise.resolve(jsonResponse([brand]));
      if (String(input).startsWith("/api/admin/products/") && init?.method === "PATCH") return Promise.resolve(jsonResponse({ ok: true }));
      if (String(input) === "/api/admin/products") return Promise.resolve(jsonResponse(products));
      return Promise.reject(new Error("unexpected request"));
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("loads Spanish catalog details, COP prices, image alt text, and aggregate stock styling", async () => {
    render(<CatalogAdmin />);

    expect(screen.getByText("Cargando catálogo…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Air Runner")).toBeInTheDocument());

    expect(screen.getAllByText("Nike").length).toBeGreaterThan(0);
    expect(screen.getByText(/249\.900/)).toBeInTheDocument();
    expect(screen.getByText("Hombre")).toBeInTheDocument();
    expect(screen.getByText("Borrador")).toBeInTheDocument();
    expect(screen.getByText("Destacado")).toBeInTheDocument();
    expect(screen.getByAltText("Tenis negros")).toBeInTheDocument();
    expect(screen.getByText(/39 · Negro · AIR-39/)).toBeInTheDocument();
    expect(screen.getByTestId("stock-product-1")).toHaveClass("text-orange-700");
    expect(screen.getByTestId("stock-product-2")).toHaveClass("text-ink");
    expect(formatCop(249900)).toContain("249.900");
  });

  it("creates a brand with stable success feedback and updates publication controls without stock fields", async () => {
    render(<CatalogAdmin />);
    await waitFor(() => expect(screen.getByText("Air Runner")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Nueva marca"), { target: { value: "Adidas" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear marca" }));
    await waitFor(() => expect(screen.getByText("Marca creada correctamente.")).toBeInTheDocument());
    expect(screen.getByText("Adidas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Publicar Air Runner" }));
    await waitFor(() => expect(screen.getByText("Producto actualizado correctamente.")).toBeInTheDocument());
    const patchCall = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patchCall?.[0]).toBe("/api/admin/products/product-1");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({ lifecycle: "published" });
    expect(JSON.parse(String(patchCall?.[1]?.body))).not.toHaveProperty("stockQuantity");
    fireEvent.click(screen.getByRole("button", { name: "Destacar Air Runner" }));
    await waitFor(() => expect(screen.getByText("Producto actualizado correctamente.")).toBeInTheDocument());
    const patchBodies = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "PATCH").map(([, init]) => JSON.parse(String(init?.body)));
    expect(patchBodies.at(-1)).toEqual({ featured: true });
  });

  it("reports loading failures in Spanish", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    render(<CatalogAdmin />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No fue posible cargar el catálogo."));
  });
});
