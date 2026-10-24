import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InventoryAdmin } from "@/components/admin/inventory/inventory-admin";

const settings = {
  whatsappPhone: "+57 300 123 4567",
  nequiDetails: "Nequi 3001234567",
  dispatchOriginCity: "Bogotá",
  dispatchOriginAddress: "Calle 10 # 20-30",
  inventoryLowThreshold: 2,
  stockDisplayMode: "detailed" as const,
};

const brand = { id: "brand-1", name: "Nike", slug: "nike" };
const products = [{
  id: "product-1", brandId: brand.id, name: "Air Runner", slug: "air-runner", description: "",
  audience: "men", priceCop: 249900, lifecycle: "published", featured: false,
  createdAt: "2026-04-02T12:00:00.000Z", updatedAt: "2026-04-02T12:00:00.000Z", brand, image: null,
  variants: [
    { id: "variant-1", productId: "product-1", size: "39", color: "Negro", sku: "AIR-39", active: true, stockQuantity: 2 },
    { id: "variant-2", productId: "product-1", size: "40", color: "Blanco", sku: "AIR-40", active: true, stockQuantity: 3 },
    { id: "variant-zero", productId: "product-1", size: "42", color: "Verde", sku: "AIR-42", active: true, stockQuantity: 0 },
    { id: "variant-inactive", productId: "product-1", size: "41", color: "Rojo", sku: "AIR-41", active: false, stockQuantity: 8 },
  ],
}];

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return { ok, status, json: async () => body } as Response;
}

function setupFetch() {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/api/admin/products") return Promise.resolve(jsonResponse(products));
    if (String(input) === "/api/admin/settings") return Promise.resolve(jsonResponse(settings));
    if (String(input) === "/api/admin/inventory" && init?.method === "POST") return Promise.resolve(jsonResponse({ stockQuantity: 1 }));
    return Promise.reject(new Error("unexpected request"));
  }));
}

describe("admin inventory dashboard", () => {
  beforeEach(setupFetch);
  afterEach(() => vi.unstubAllGlobals());

  it("loads active variants with the configured threshold and accessible status styling", async () => {
    render(<InventoryAdmin />);
    await waitFor(() => expect(screen.getByText("AIR-39")).toBeInTheDocument());

    expect(screen.queryByText("AIR-41")).not.toBeInTheDocument();
    expect(screen.getByTestId("inventory-status-variant-1")).toHaveClass("text-orange-700");
    expect(screen.getByTestId("inventory-status-variant-2")).toHaveClass("text-ink");
    expect(screen.getByTestId("inventory-status-variant-zero")).toHaveClass("text-red-700");
    expect(screen.getByText("2 unidades · Pocas unidades")).toBeInTheDocument();
  });

  it("rejects zero deltas and missing reasons before calling the API", async () => {
    render(<InventoryAdmin />);
    await waitFor(() => expect(screen.getByText("AIR-39")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Ajustar AIR-39" }));

    fireEvent.change(screen.getByLabelText("Delta de inventario"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    expect(screen.getByRole("alert")).toHaveTextContent("El ajuste debe ser un entero distinto de cero.");

    fireEvent.change(screen.getByLabelText("Delta de inventario"), { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Indica el motivo del ajuste.");
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });

  it("maps order references and updates quantity and status immediately after success", async () => {
    render(<InventoryAdmin />);
    await waitFor(() => expect(screen.getByText("AIR-39")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Ajustar AIR-39" }));
    fireEvent.change(screen.getByLabelText("Delta de inventario"), { target: { value: "+1" } });
    fireEvent.change(screen.getByLabelText("Motivo del ajuste"), { target: { value: "Venta confirmada" } });
    fireEvent.change(screen.getByLabelText("Referencia de orden (opcional)"), { target: { value: "ORD-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));

    await waitFor(() => expect(screen.getByText("Inventario actualizado correctamente.")).toBeInTheDocument());
    expect(screen.getByText("1 unidad · Pocas unidades")).toBeInTheDocument();
    const call = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ variantId: "variant-1", delta: 1, reason: "Venta confirmada", orderReference: "ORD-123" });
  });

  it("leaves the local quantity unchanged when the server rejects negative stock", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/products") return Promise.resolve(jsonResponse(products));
      if (String(input) === "/api/admin/settings") return Promise.resolve(jsonResponse(settings));
      if (String(input) === "/api/admin/inventory" && init?.method === "POST") return Promise.resolve(jsonResponse({ error: "El inventario no puede quedar negativo." }, false, 409));
      return Promise.reject(new Error("unexpected request"));
    });
    render(<InventoryAdmin />);
    await waitFor(() => expect(screen.getByText("AIR-39")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Ajustar AIR-39" }));
    fireEvent.change(screen.getByLabelText("Delta de inventario"), { target: { value: "-3" } });
    fireEvent.change(screen.getByLabelText("Motivo del ajuste"), { target: { value: "Corrección" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("El inventario no puede quedar negativo."));
    expect(screen.getByText("2 unidades · Pocas unidades")).toBeInTheDocument();
  });

  it("reports invalid JSON or network failures in Spanish", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    render(<InventoryAdmin />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No fue posible cargar el inventario."));
    cleanup();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => { throw new Error("invalid json"); } } as unknown as Response)));
    render(<InventoryAdmin />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No fue posible cargar el inventario."));
  });
});
