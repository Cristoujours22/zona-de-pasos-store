import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireActiveAdmin, authErrorStatus, createCloudinaryImageAdapter } = vi.hoisted(() => ({
  requireActiveAdmin: vi.fn(),
  authErrorStatus: vi.fn((error: { code?: string }) => error.code === "unauthenticated" ? 401 : 403),
  createCloudinaryImageAdapter: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ requireActiveAdmin, authErrorStatus }));
vi.mock("@/lib/cloudinary/adapter", () => ({ createCloudinaryImageAdapter }));

import { AuthorizationError } from "@/lib/auth/authorization";
import { DELETE, POST } from "@/app/api/admin/product-images/route";

const uploadRequest = (file: File, altText = "Tenis Nike") => {
  const form = new FormData();
  form.set("file", file);
  form.set("altText", altText);
  return { formData: async () => form } as unknown as Request;
};
const deletionRequest = (publicId: string) => new Request("https://store.example/api/admin/product-images", {
  method: "DELETE",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ publicId }),
});

describe("product image routes", () => {
  const upload = vi.fn();
  const destroy = vi.fn();
  const provider = { upload, destroy };

  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveAdmin.mockResolvedValue({ actor: { id: "admin-1", role: "admin", status: "active" } });
    createCloudinaryImageAdapter.mockReturnValue(provider);
    upload.mockResolvedValue({ publicId: "zona-de-pasos/products/asset-1", secureUrl: "https://res.cloudinary.com/example/image/upload/v1/asset-1.jpg", width: 900, height: 900 });
    destroy.mockResolvedValue("ok");
  });

  it("rejects unauthenticated uploads before parsing or calling the provider", async () => {
    requireActiveAdmin.mockRejectedValue(new AuthorizationError("unauthenticated"));
    const response = await POST(uploadRequest(new File(["shoe"], "shoe.jpg", { type: "image/jpeg" })));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toMatch(/iniciar sesión|autorizado/i);
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects unsupported MIME types without a provider call", async () => {
    const response = await POST(uploadRequest(new File(["not an image"], "file.pdf", { type: "application/pdf" })));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/formato|imagen/i);
    expect(upload).not.toHaveBeenCalled();
  });

  it("returns normalized persistence metadata after a successful upload", async () => {
    const response = await POST(uploadRequest(new File(["shoe"], "shoe.webp", { type: "image/webp" }), "  Tenis\tNike  "));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ publicId: "zona-de-pasos/products/asset-1", secureUrl: "https://res.cloudinary.com/example/image/upload/v1/asset-1.jpg", altText: "Tenis Nike", width: 900, height: 900 });
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("sanitizes provider failures into a Spanish response", async () => {
    upload.mockRejectedValueOnce(new Error("Cloudinary API secret=top-secret"));
    const response = await POST(uploadRequest(new File(["shoe"], "shoe.jpg", { type: "image/jpeg" })));
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(body.error).toMatch(/No fue posible|intenta/i);
    expect(JSON.stringify(body)).not.toContain("top-secret");
  });

  it("rejects unauthenticated deletion before calling the provider", async () => {
    requireActiveAdmin.mockRejectedValue(new AuthorizationError("unauthenticated"));
    const response = await DELETE(deletionRequest("zona-de-pasos/products/asset-1"));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toMatch(/iniciar sesión|autorizado/i);
    expect(destroy).not.toHaveBeenCalled();
  });

  it("returns a sanitized Spanish 400 for JSON null without touching the provider", async () => {
    const response = await DELETE(new Request("https://store.example/api/admin/product-images", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: "null",
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/solicitud|imagen|Indica/i);
    expect(destroy).not.toHaveBeenCalled();
  });

  it("deletes a valid product asset for an authenticated admin", async () => {
    const response = await DELETE(deletionRequest("zona-de-pasos/products/asset-1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(destroy).toHaveBeenCalledWith("zona-de-pasos/products/asset-1");
  });

  it("rejects out-of-prefix deletion without touching provider state", async () => {
    const response = await DELETE(deletionRequest("other-folder/asset-1"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/ubicación|permitida|imagen/i);
    expect(destroy).not.toHaveBeenCalled();
  });

  it("treats a provider not-found deletion outcome explicitly", async () => {
    destroy.mockResolvedValueOnce("not found");
    const response = await DELETE(deletionRequest("zona-de-pasos/products/missing"));
    expect(response.status).toBe(404);
    expect((await response.json()).error).toMatch(/no existe|encontrar/i);
  });
});
