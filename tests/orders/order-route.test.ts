import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createPublicClient: vi.fn(), createAdminClient: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/public", () => ({ createSupabasePublicClient: mocks.createPublicClient }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdminClient }));

import { POST } from "@/app/api/orders/route";

const idempotencyKey = "11111111-1111-4111-8111-111111111111";
const variantId = "22222222-2222-4222-8222-222222222222";
const itemSummary = { brandName: "Nike", productName: "Air Max", size: "38", color: "Negro", sku: "NK-38", quantity: 2, unitPriceCop: 249900, lineTotalCop: 499800 };

function requestBody() {
  return {
    idempotencyKey,
    buyer: { fullName: "María Gómez", colombianDocumentNumber: "1234567890", phone: "3001234567", email: "maria@example.com" },
    delivery: { department: "Cundinamarca", cityMunicipality: "Bogotá", address: "Calle 10 # 20-30", neighborhood: "La Soledad", deliveryInstructions: "Llamar" },
    items: [{ variantId, quantity: 2, priceCop: 1, productName: "Falso" }],
  };
}

function jsonRequest(body: unknown): Request {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as Request;
}

function client(options: { phone?: string; rpcData?: unknown; rpcError?: unknown } = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: options.rpcData ?? [{ order_id: "order-1", order_number: "ZP-20260402-ABCD1234", product_subtotal_cop: 499800, delivery_type: "local", replayed: false, item_summaries: [{ product_brand_name: "Nike", product_name: "Air Max", variant_size: "38", variant_color: "Negro", variant_sku: "NK-38", requested_quantity: 2, unit_price_cop: 249900, line_total_cop: 499800 }] }], error: options.rpcError ?? null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: { whatsapp_phone: options.phone ?? "3001234567" }, error: null });
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const from = vi.fn().mockReturnValue({ select });
  return { from, rpc, maybeSingle };
}

describe("POST /api/orders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates before creating the public client and RPC", async () => {
    const response = await POST(jsonRequest({ items: [] }));
    expect(response.status).toBe(400);
    expect(mocks.createPublicClient).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ error: "Los datos del pedido no son válidos." });
  });

  it.each([
    ["name", { buyer: { fullName: "María\nGómez" } }],
    ["department", { delivery: { department: "Cundinamarca\t" } }],
    ["city", { delivery: { cityMunicipality: "Bogotá\n" } }],
    ["address", { delivery: { address: "Calle 10\n# 20-30" } }],
    ["instructions", { delivery: { deliveryInstructions: "Llamar\t al llegar" } }],
  ])("rejects control characters in %s before creating either adapter", async (_field, partial) => {
    const base = requestBody();
    const body = {
      ...base,
      buyer: { ...base.buyer, ...(partial as { buyer?: object }).buyer },
      delivery: { ...base.delivery, ...(partial as { delivery?: object }).delivery },
    };
    const response = await POST(jsonRequest(body));
    expect(response.status).toBe(400);
    expect(mocks.createPublicClient).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("calls only the public RPC with database-owned product pricing and returns a safe handoff", async () => {
    const publicFake = client();
    const adminFake = client();
    mocks.createPublicClient.mockReturnValue(publicFake);
    mocks.createAdminClient.mockReturnValue(adminFake);
    const response = await POST(jsonRequest(requestBody()));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(publicFake.rpc).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).toHaveBeenCalledTimes(1);
    expect(adminFake.rpc).toHaveBeenCalledWith("create_guest_order_atomic", expect.objectContaining({
      p_idempotency_key: idempotencyKey,
      p_items: [{ variant_id: variantId, quantity: 2 }],
    }));
    expect(adminFake.rpc.mock.calls[0][1]).not.toHaveProperty("p_price_cop");
    expect(adminFake.rpc.mock.calls[0][1]).not.toHaveProperty("p_product_name");
    expect(body.order).toEqual({ id: "order-1", number: "ZP-20260402-ABCD1234", subtotalCop: 499800, deliveryType: "local", replayed: false, items: [itemSummary] });
    expect(body.whatsapp).toEqual(expect.objectContaining({ url: expect.stringContaining("https://wa.me/573001234567?text=") }));
    expect(body.whatsapp.message).toContain("Producto: Nike - Air Max | Talla: 38 | Color: Negro | SKU: NK-38 | Cantidad: 2 | Precio unitario: $249.900 COP | Total: $499.800 COP");
    expect(JSON.stringify(body)).not.toMatch(/1234567890|Calle 10|maria@example.com|nequi|internal/i);
  });

  it.each([
    ["variant_unavailable", "El producto seleccionado ya no está disponible."],
    ["insufficient_stock", "La cantidad solicitada supera la disponibilidad actual."],
  ])("maps %s to a stock conflict", async (code, message) => {
    const publicFake = client();
    const adminFake = client({ rpcError: { code: "P0001", message: code } });
    mocks.createPublicClient.mockReturnValue(publicFake);
    mocks.createAdminClient.mockReturnValue(adminFake);
    const response = await POST(jsonRequest(requestBody()));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: message });
  });

  it("maps order_rate_limited to sanitized HTTP 429", async () => {
    const publicFake = client();
    const adminFake = client({ rpcError: { code: "P0001", message: "order_rate_limited internal detail" } });
    mocks.createPublicClient.mockReturnValue(publicFake);
    mocks.createAdminClient.mockReturnValue(adminFake);
    const response = await POST(jsonRequest(requestBody()));
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toEqual({ error: "Has alcanzado el límite temporal de pedidos. Intenta más tarde." });
    expect(JSON.stringify(body)).not.toContain("internal detail");
  });

  it("maps an idempotent replay to the same safe order receipt", async () => {
    const publicFake = client();
    const adminFake = client({ rpcData: [{ order_id: "order-1", order_number: "ZP-20260402-ABCD1234", product_subtotal_cop: 499800, delivery_type: "national", replayed: true, item_summaries: [{ product_brand_name: "Adidas", product_name: "Forum", variant_size: "40", variant_color: "Blanco", variant_sku: "AD-40", requested_quantity: 1, unit_price_cop: 199900, line_total_cop: 199900 }] }] });
    mocks.createPublicClient.mockReturnValue(publicFake);
    mocks.createAdminClient.mockReturnValue(adminFake);
    const response = await POST(jsonRequest(requestBody()));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.order.replayed).toBe(true);
    expect(body.order.items).toEqual([{ brandName: "Adidas", productName: "Forum", size: "40", color: "Blanco", sku: "AD-40", quantity: 1, unitPriceCop: 199900, lineTotalCop: 199900 }]);
    expect(body.whatsapp.message).toContain("Envío nacional");
  });

  it("does not call the RPC when public WhatsApp is not configured", async () => {
    const fake = client({ phone: "" });
    mocks.createPublicClient.mockReturnValue(fake);
    const response = await POST(jsonRequest(requestBody()));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "El contacto de WhatsApp no está configurado." });
    expect(fake.rpc).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("sanitizes ambiguous database failures", async () => {
    const publicFake = client();
    const adminFake = client({ rpcError: { code: "XX000", message: "secret relation detail" } });
    mocks.createPublicClient.mockReturnValue(publicFake);
    mocks.createAdminClient.mockReturnValue(adminFake);
    const response = await POST(jsonRequest(requestBody()));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ error: "No fue posible confirmar el pedido. Intenta de nuevo." });
    expect(JSON.stringify(body)).not.toContain("secret relation detail");
  });
});
