import { describe, expect, it } from "vitest";

import {
  COLOMBIAN_DEPARTMENTS,
  buildCheckoutPayload,
  checkoutErrorMessage,
  forgetIdempotencyKey,
  getCartIdentity,
  getOrCreateIdempotencyKey,
  isTrustedWhatsappUrl,
  parseCheckoutResponse,
  validateCheckoutForm,
} from "@/lib/checkout/domain";
import type { CheckoutFormData } from "@/types/checkout";

const form: CheckoutFormData = {
  fullName: "Ana María Pérez",
  colombianDocumentNumber: "1.234.567",
  phone: "300 123 4567",
  email: "ana@example.com",
  department: "Antioquia",
  cityMunicipality: "Medellín",
  address: "Calle 10 # 20-30",
  neighborhood: "Laureles",
  deliveryInstructions: "Portería principal",
  consent: true,
};

const items = [
  { productId: "11111111-1111-4111-8111-111111111111", variantId: "22222222-2222-4222-8222-222222222222", quantity: 2, productName: "No autoridad", displayPriceCop: 999999 },
];

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

describe("checkout domain", () => {
  it("maintains the Colombian department list, including Bogotá D.C.", () => {
    expect(COLOMBIAN_DEPARTMENTS).toContain("Bogotá D.C.");
    expect(COLOMBIAN_DEPARTMENTS.length).toBeGreaterThanOrEqual(33);
  });

  it("requires every delivery field and explicit data-use consent", () => {
    const result = validateCheckoutForm({ ...form, fullName: "", department: "", consent: false });
    expect(result.fieldErrors.fullName).toBeTruthy();
    expect(result.fieldErrors.department).toBeTruthy();
    expect(result.fieldErrors.consent).toMatch(/consentimiento/i);
    expect(result.valid).toBe(false);
  });

  it("builds an authoritative-safe payload from IDs and quantities only", () => {
    const payload = buildCheckoutPayload(form, items, "33333333-3333-4333-8333-333333333333");
    expect(payload).toMatchObject({ idempotencyKey: "33333333-3333-4333-8333-333333333333" });
    expect(payload).not.toHaveProperty("consent");
    expect(payload.items).toEqual([{ variantId: items[0].variantId, quantity: 2 }]);
    expect(JSON.stringify(payload)).not.toContain("No autoridad");
    expect(JSON.stringify(payload)).not.toContain("999999");
    expect(payload.buyer.colombianDocumentNumber).toBe("1234567");
    expect(payload.delivery.cityMunicipality).toBe("Medellín");
  });

  it("keeps one idempotency key for a cart identity and rotates after change or success", () => {
    const storage = memoryStorage();
    const identity = getCartIdentity(items);
    const first = getOrCreateIdempotencyKey(identity, storage);
    expect(getOrCreateIdempotencyKey(identity, storage)).toBe(first);
    const changed = getOrCreateIdempotencyKey(getCartIdentity([{ ...items[0], quantity: 3 }]), storage);
    expect(changed).not.toBe(first);
    forgetIdempotencyKey(getCartIdentity([{ ...items[0], quantity: 3 }]), storage);
    expect(getOrCreateIdempotencyKey(getCartIdentity([{ ...items[0], quantity: 3 }]), storage)).not.toBe(changed);
  });

  it("falls back to memory when session storage is blocked", () => {
    const blocked: Storage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); }, clear: () => undefined, key: () => null, length: 0 };
    const identity = getCartIdentity(items);
    expect(getOrCreateIdempotencyKey(identity, blocked)).toBe(getOrCreateIdempotencyKey(identity, blocked));
  });

  it("accepts only an HTTPS wa.me handoff and maps sanitized API errors", () => {
    expect(isTrustedWhatsappUrl("https://wa.me/573001234567?text=pedido")).toBe(true);
    expect(isTrustedWhatsappUrl("https://evil.example/steal")).toBe(false);
    expect(isTrustedWhatsappUrl("http://wa.me/573001234567")).toBe(false);
    const path = "/track/11111111-1111-4111-8111-111111111111.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    expect(parseCheckoutResponse({ order: { number: "ZP-20260403-ABC", subtotalCop: 249900, deliveryType: "local" }, whatsapp: { url: "https://wa.me/573001234567?text=items" }, tracking: { path } })).toMatchObject({ orderNumber: "ZP-20260403-ABC", subtotalCop: 249900, deliveryType: "local", trackingPath: path });
    expect(parseCheckoutResponse({ order: { number: "ZP-1", subtotalCop: 1, deliveryType: "local" }, whatsapp: { url: "https://evil.example" }, tracking: { path } })).toBeNull();
    expect(parseCheckoutResponse({ order: { number: "ZP-1", subtotalCop: 1, deliveryType: "local" }, whatsapp: { url: "https://wa.me/573001234567" }, tracking: { path: "/admin" } })).toBeNull();
    expect(checkoutErrorMessage(409)).toMatch(/disponibilidad/i);
    expect(checkoutErrorMessage(429)).toMatch(/límite/i);
    expect(checkoutErrorMessage(503)).toMatch(/confirmar/i);
  });
});
