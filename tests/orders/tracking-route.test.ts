import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn(), getTracking: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/orders/tracking-supabase", () => ({ getPublicOrderTracking: mocks.getTracking }));

import { GET } from "@/app/api/tracking/[token]/route";
import { createTrackingToken } from "@/lib/orders/tracking";

const secret = "a".repeat(64);
const orderId = "11111111-1111-4111-8111-111111111111";
const tracking = {
  number: "ZP-20260403-ABC", status: "shipped", deliveryType: "national", productSubtotalCop: 249900, shippingCostCop: 18000,
  carrierName: "Envía", trackingNumber: "ENV-123", trackingUrl: "https://envia.co/rastreo?guia=ENV-123", createdAt: "2026-04-03T10:00:00.000Z", updatedAt: "2026-04-03T11:00:00.000Z",
  items: [{ brandName: "Nike", productName: "Air", size: "39", color: "Negro", sku: "AIR-39", quantity: 1 }],
  history: [{ status: "pending_confirmation", createdAt: "2026-04-03T10:00:00.000Z" }, { status: "shipped", createdAt: "2026-04-03T11:00:00.000Z" }],
};

describe("public tracking API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ORDER_TRACKING_SECRET = secret;
    mocks.createAdminClient.mockReturnValue({});
    mocks.getTracking.mockResolvedValue(tracking);
  });

  it("rejects invalid tokens before creating a service client", async () => {
    const response = await GET(new Request("http://localhost/api/tracking/bad"), { params: Promise.resolve({ token: "bad" }) });
    expect(response.status).toBe(404);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("returns only the safe tracking projection for a valid signed token", async () => {
    const token = createTrackingToken(orderId, secret);
    const response = await GET(new Request(`http://localhost/api/tracking/${token}`), { params: Promise.resolve({ token }) });
    expect(response.status).toBe(200);
    expect(mocks.getTracking).toHaveBeenCalledWith({}, orderId);
    const json = await response.json();
    expect(json).toEqual(tracking);
    expect(JSON.stringify(json)).not.toMatch(/buyer|document|phone|email|address|neighborhood|actor|internal/i);
  });

  it("fails closed when the tracking secret is missing", async () => {
    delete process.env.ORDER_TRACKING_SECRET;
    const response = await GET(new Request("http://localhost/api/tracking/token"), { params: Promise.resolve({ token: "token" }) });
    expect(response.status).toBe(503);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
