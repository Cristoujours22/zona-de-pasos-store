import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrdersAdmin } from "@/components/admin/orders/orders-admin";

const order = {
  id: "11111111-1111-4111-8111-111111111111", number: "ZP-20260403-ABC", status: "awaiting_payment", buyerFullName: "Ana Pérez", phone: "573001234567", cityMunicipality: "Medellín", deliveryType: "national", productSubtotalCop: 249900, shippingCostCop: null, carrierName: null, trackingNumber: null, createdAt: "2026-04-03T10:00:00.000Z", updatedAt: "2026-04-03T10:00:00.000Z",
};
const detail = {
  ...order, colombianDocumentNumber: "1234567", email: "ana@example.com", department: "Antioquia", address: "Calle 10 # 20-30", neighborhood: "Laureles", deliveryInstructions: null,
  paymentConfirmedBy: null, paymentConfirmedAt: null, paymentConfirmedAmountCop: null, paymentInternalNote: null, carrierId: null, trackingUrl: null, shippedAt: null, deliveredAt: null, canceledAt: null, cancellationReason: null,
  items: [{ brandName: "Nike", productName: "Air", size: "39", color: "Negro", sku: "AIR-39", quantity: 1, unitPriceCop: 249900, lineTotalCop: 249900 }],
  history: [{ id: "h1", fromStatus: "pending_confirmation", toStatus: "awaiting_payment", actorUserId: "admin", note: null, createdAt: "2026-04-03T10:00:00.000Z" }],
};
const carrier = { id: "22222222-2222-4222-8222-222222222222", name: "Envía", slug: "envia", trackingUrlTemplate: "https://envia.co/rastreo?guia={trackingNumber}", active: true, position: 10, updatedAt: "2026-04-03T09:00:00.000Z" };

function response(body: unknown, ok = true, status = ok ? 200 : 500): Response { return { ok, status, json: async () => body } as Response; }

function setupFetch() {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/admin/orders" && !init) return Promise.resolve(response([order]));
    if (url === "/api/admin/carriers" && !init) return Promise.resolve(response([carrier]));
    if (url === `/api/admin/orders/${order.id}` && !init) return Promise.resolve(response(detail));
    if (url.endsWith("/payment") && init?.method === "POST") return Promise.resolve(response({ ...detail, status: "payment_confirmed", updatedAt: "2026-04-03T10:01:00.000Z", paymentConfirmedAmountCop: 249900 }));
    if (url.endsWith("/shipping") && init?.method === "POST") return Promise.resolve(response({ ...detail, shippingCostCop: 18000, carrierId: carrier.id, carrierName: carrier.name, trackingNumber: "ENV-123", updatedAt: "2026-04-03T10:02:00.000Z" }));
    if (url.endsWith("/cancel") && init?.method === "POST") return Promise.resolve(response({ ...detail, status: "canceled", cancellationReason: "Cliente desistió" }));
    if (url === "/api/admin/carriers" && init?.method === "POST") return Promise.resolve(response(carrier, true, 201));
    return Promise.reject(new Error(`unexpected ${url}`));
  }));
}

describe("admin order operations", () => {
  beforeEach(setupFetch);
  afterEach(() => vi.unstubAllGlobals());

  it("loads the queue, opens protected detail, and shows state history", async () => {
    render(<OrdersAdmin />);
    await waitFor(() => expect(screen.getByText("ZP-20260403-ABC")).toBeInTheDocument());
    expect(screen.queryByText("1234567")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /gestionar ZP-20260403-ABC/i }));
    await waitFor(() => expect(screen.getByText("1234567")).toBeInTheDocument());
    expect(screen.getByText(/Calle 10 # 20-30, Laureles/)).toBeInTheDocument();
    expect(screen.getAllByText(/pendiente de pago/i).length).toBeGreaterThan(0);
  });

  it("requires an explicit human payment confirmation and never accepts a screenshot", async () => {
    render(<OrdersAdmin />);
    await waitFor(() => screen.getByText("ZP-20260403-ABC"));
    fireEvent.click(screen.getByRole("button", { name: /gestionar/i }));
    await waitFor(() => screen.getByLabelText("Valor confirmado en Nequi"));
    expect(screen.queryByLabelText(/captura|comprobante/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Valor confirmado en Nequi"), { target: { value: "249900" } });
    fireEvent.change(screen.getByLabelText("Nota interna del pago (opcional)"), { target: { value: "Verificado manualmente" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pago verificado" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/pago confirmado/i));
    const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/payment"));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ expectedUpdatedAt: order.updatedAt, confirmedAmountCop: 249900, internalNote: "Verificado manualmente" });
  });

  it("records shipping and cancellation without touching inventory", async () => {
    render(<OrdersAdmin />);
    await waitFor(() => screen.getByText("ZP-20260403-ABC"));
    fireEvent.click(screen.getByRole("button", { name: /gestionar/i }));
    await waitFor(() => screen.getByLabelText("Transportador"));
    fireEvent.change(screen.getByLabelText("Costo de envío COP"), { target: { value: "18000" } });
    fireEvent.change(screen.getByLabelText("Transportador"), { target: { value: carrier.id } });
    fireEvent.change(screen.getByLabelText("Número de guía"), { target: { value: "ENV-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar envío" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/envío actualizado/i));

    fireEvent.change(screen.getByLabelText("Motivo de cancelación"), { target: { value: "Cliente desistió" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar pedido" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/pedido cancelado/i));
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("inventory"))).toBe(false);
  });

  it("lets administrators configure carrier tracking templates", async () => {
    render(<OrdersAdmin />);
    await waitFor(() => expect(screen.getByText(/Envía · Activo/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Nombre del transportador"), { target: { value: "Coordinadora" } });
    fireEvent.change(screen.getByLabelText("Plantilla HTTPS de seguimiento"), { target: { value: "https://www.coordinadora.com/rastreo/?guia={trackingNumber}" } });
    fireEvent.change(screen.getByLabelText("Posición"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar transportador" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/transportador guardado/i));
  });
});
