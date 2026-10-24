import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveAdmin: vi.fn(),
  authErrorStatus: vi.fn((error: { code?: string }) => error.code === "unauthenticated" ? 401 : 403),
  createAdapter: vi.fn(),
  createService: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ requireActiveAdmin: mocks.requireActiveAdmin, authErrorStatus: mocks.authErrorStatus }));
vi.mock("@/lib/catalog/admin/supabase", () => ({ createSupabaseCatalogAdminAdapter: mocks.createAdapter }));
vi.mock("@/lib/catalog/admin/service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/catalog/admin/service")>("@/lib/catalog/admin/service");
  return { ...actual, createCatalogAdminService: mocks.createService };
});

import { AuthorizationError } from "@/lib/auth/authorization";
import { GET as getBrands, POST as postBrand } from "@/app/api/admin/brands/route";
import { POST as postProduct } from "@/app/api/admin/products/route";
import { PATCH as patchSettings } from "@/app/api/admin/settings/route";
import { POST as postInventory } from "@/app/api/admin/inventory/route";

const jsonRequest = (body: unknown) => {
  const json = vi.fn().mockResolvedValue(body);
  return { json } as unknown as Request;
};

describe("catalog admin routes", () => {
  const service = {
    listBrands: vi.fn(),
    createBrand: vi.fn(),
    createProduct: vi.fn(),
    updateSettings: vi.fn(),
    adjustInventory: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveAdmin.mockResolvedValue({ client: {}, actor: { id: "admin-1", role: "admin", status: "active" } });
    mocks.createAdapter.mockReturnValue({});
    mocks.createService.mockReturnValue(service);
    service.listBrands.mockResolvedValue([]);
    service.createBrand.mockResolvedValue({ id: "brand-1" });
    service.createProduct.mockResolvedValue({ id: "product-1" });
    service.updateSettings.mockResolvedValue({ stockDisplayMode: "detailed" });
    service.adjustInventory.mockResolvedValue({ stockQuantity: 2 });
  });

  it("rejects unauthenticated and suspended mutations before parsing", async () => {
    const request = jsonRequest({ name: "Nike" });
    mocks.requireActiveAdmin.mockRejectedValueOnce(new AuthorizationError("unauthenticated"));
    expect((await postBrand(request)).status).toBe(401);
    expect(request.json).not.toHaveBeenCalled();
    mocks.requireActiveAdmin.mockRejectedValueOnce(new AuthorizationError("suspended"));
    expect((await postProduct(jsonRequest({}))).status).toBe(403);
    expect(service.createProduct).not.toHaveBeenCalled();
  });

  it("creates brands and products only through the authenticated service", async () => {
    expect((await postBrand(jsonRequest({ name: "Nike" }))).status).toBe(201);
    expect(service.createBrand).toHaveBeenCalledWith({ name: "Nike" });
    expect((await postProduct(jsonRequest({ name: "Air", variants: [] }))).status).toBe(201);
    expect(service.createProduct).toHaveBeenCalledWith({ name: "Air", variants: [] });
  });

  it("returns admin settings and inventory results without leaking adapter errors", async () => {
    const settingsResponse = await patchSettings(jsonRequest({ nequiDetails: "Nequi: 3001234567" }));
    expect(settingsResponse.status).toBe(200);
    expect((await settingsResponse.json()).stockDisplayMode).toBe("detailed");
    const inventoryResponse = await postInventory(jsonRequest({ variantId: "variant-1", delta: -1, reason: "Venta" }));
    expect(inventoryResponse.status).toBe(200);
    expect(await inventoryResponse.json()).toEqual({ stockQuantity: 2 });
  });

  it("authenticates list requests before constructing the service", async () => {
    mocks.requireActiveAdmin.mockRejectedValueOnce(new AuthorizationError("unauthenticated"));
    const response = await getBrands();
    expect(response.status).toBe(401);
    expect(mocks.createService).not.toHaveBeenCalled();
  });
});
