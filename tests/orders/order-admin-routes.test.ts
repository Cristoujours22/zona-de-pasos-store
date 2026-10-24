import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveAdmin: vi.fn(),
  authErrorStatus: vi.fn((error: { code?: string }) => error.code === "unauthenticated" ? 401 : 403),
  createAdapter: vi.fn(),
  createService: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ requireActiveAdmin: mocks.requireActiveAdmin, authErrorStatus: mocks.authErrorStatus }));
vi.mock("@/lib/orders/admin/supabase", () => ({ createSupabaseOrderAdminAdapter: mocks.createAdapter }));
vi.mock("@/lib/orders/admin/service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/orders/admin/service")>("@/lib/orders/admin/service");
  return { ...actual, createOrderAdminService: mocks.createService };
});

import { AuthorizationError } from "@/lib/auth/authorization";
import { GET as listOrders } from "@/app/api/admin/orders/route";
import { GET as getOrder } from "@/app/api/admin/orders/[id]/route";
import { POST as transition } from "@/app/api/admin/orders/[id]/transition/route";
import { POST as confirmPayment } from "@/app/api/admin/orders/[id]/payment/route";
import { POST as updateShipping } from "@/app/api/admin/orders/[id]/shipping/route";
import { POST as cancelOrder } from "@/app/api/admin/orders/[id]/cancel/route";
import { GET as listCarriers, POST as createCarrier } from "@/app/api/admin/carriers/route";
import { PATCH as updateCarrier } from "@/app/api/admin/carriers/[id]/route";

const request = (body: unknown) => ({ json: vi.fn().mockResolvedValue(body) }) as unknown as Request;
const params = (id = "11111111-1111-4111-8111-111111111111") => ({ params: Promise.resolve({ id }) });

describe("order administration routes", () => {
  const service = {
    listOrders: vi.fn(), getOrder: vi.fn(), transitionOrder: vi.fn(), confirmPayment: vi.fn(), updateShipping: vi.fn(), cancelOrder: vi.fn(), listCarriers: vi.fn(), createCarrier: vi.fn(), updateCarrier: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveAdmin.mockResolvedValue({ client: {}, actor: { id: "admin-1", role: "admin", status: "active" } });
    mocks.createAdapter.mockReturnValue({});
    mocks.createService.mockReturnValue(service);
    service.listOrders.mockResolvedValue([]);
    service.getOrder.mockResolvedValue({ id: "order-1" });
    service.transitionOrder.mockResolvedValue({ id: "order-1", status: "awaiting_payment" });
    service.confirmPayment.mockResolvedValue({ id: "order-1", status: "payment_confirmed" });
    service.updateShipping.mockResolvedValue({ id: "order-1", trackingNumber: "ENV-1" });
    service.cancelOrder.mockResolvedValue({ id: "order-1", status: "canceled" });
    service.listCarriers.mockResolvedValue([]);
    service.createCarrier.mockResolvedValue({ id: "carrier-1" });
    service.updateCarrier.mockResolvedValue({ id: "carrier-1" });
  });

  it("authenticates before parsing every mutation", async () => {
    const body = request({});
    mocks.requireActiveAdmin.mockRejectedValueOnce(new AuthorizationError("unauthenticated"));
    expect((await transition(body, params())).status).toBe(401);
    expect(body.json).not.toHaveBeenCalled();

    mocks.requireActiveAdmin.mockRejectedValueOnce(new AuthorizationError("suspended"));
    expect((await confirmPayment(request({}), params())).status).toBe(403);
    expect(service.confirmPayment).not.toHaveBeenCalled();
  });

  it("routes order reads and each mutation through the authenticated service", async () => {
    expect((await listOrders()).status).toBe(200);
    expect((await getOrder(new Request("http://localhost"), params())).status).toBe(200);
    expect((await transition(request({ toStatus: "awaiting_payment" }), params())).status).toBe(200);
    expect((await confirmPayment(request({ confirmedAmountCop: 1 }), params())).status).toBe(200);
    expect((await updateShipping(request({ trackingNumber: "ENV-1" }), params())).status).toBe(200);
    expect((await cancelOrder(request({ reason: "Cliente" }), params())).status).toBe(200);
  });

  it("protects configurable carrier reads and writes", async () => {
    expect((await listCarriers()).status).toBe(200);
    expect((await createCarrier(request({ name: "Envía" }))).status).toBe(201);
    expect((await updateCarrier(request({ name: "Envía" }), params())).status).toBe(200);
    expect(service.createCarrier).toHaveBeenCalledWith({ name: "Envía" });
  });
});
