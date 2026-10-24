import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrderTracking } from "@/components/tracking/order-tracking";

const tracking = {
  number: "ZP-20260403-ABC", status: "shipped", deliveryType: "national", productSubtotalCop: 249900, shippingCostCop: 18000,
  carrierName: "Envía", trackingNumber: "ENV-123", trackingUrl: "https://envia.co/rastreo?guia=ENV-123", createdAt: "2026-04-03T10:00:00.000Z", updatedAt: "2026-04-03T11:00:00.000Z",
  items: [{ brandName: "Nike", productName: "Air", size: "39", color: "Negro", sku: "AIR-39", quantity: 1 }],
  history: [{ status: "pending_confirmation", createdAt: "2026-04-03T10:00:00.000Z" }, { status: "shipped", createdAt: "2026-04-03T11:00:00.000Z" }],
};

afterEach(() => vi.unstubAllGlobals());

describe("public order tracking page", () => {
  it("renders only safe order, item, shipping, and status-history data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => tracking }));
    render(<OrderTracking token="signed-token" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "ZP-20260403-ABC" })).toBeInTheDocument());
    expect(screen.getAllByText("Enviado").length).toBeGreaterThan(0);
    expect(screen.getByText(/Nike · Air · Talla 39 · Negro · AIR-39 × 1/)).toBeInTheDocument();
    expect(screen.getByText(/18\.000/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /seguir con Envía/i })).toHaveAttribute("href", tracking.trackingUrl);
    expect(document.body.textContent).not.toMatch(/1234567|573001234567|ana@example\.com|Calle 10|Laureles|admin-user|nota interna secreta/i);
  });

  it("shows a neutral not-found state without leaking provider errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: "secret detail" }) }));
    render(<OrderTracking token="bad" />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No encontramos ese seguimiento"));
    expect(screen.queryByText(/secret detail/i)).not.toBeInTheDocument();
  });
});
