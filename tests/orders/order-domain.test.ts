import { describe, expect, it } from "vitest";

import {
  buildWhatsAppHandoff,
  classifyDeliveryType,
  parseGuestOrderInput,
  toCreateOrderRpcParams,
} from "@/lib/orders/domain";

const idempotencyKey = "11111111-1111-4111-8111-111111111111";
const variantA = "22222222-2222-4222-8222-222222222222";
const itemSummary = { brandName: "Nike", productName: "Air Max", size: "38", color: "Negro", sku: "NK-38", quantity: 2, unitPriceCop: 249900, lineTotalCop: 499800 };

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey,
    buyer: {
      fullName: "  María Gómez  ",
      colombianDocumentNumber: "1.234.567-890",
      phone: "+57 300 123 4567",
      email: "maria@example.com",
    },
    delivery: {
      department: "  Cundinamarca ",
      cityMunicipality: " Bogotá ",
      address: "Calle 10 # 20-30",
      neighborhood: "La Soledad",
      deliveryInstructions: "  Llamar al llegar. ",
    },
    items: [{ variantId: variantA, quantity: 2 }],
    ...overrides,
  };
}

describe("guest order domain", () => {
  it("validates and normalizes every required buyer and delivery field", () => {
    const input = parseGuestOrderInput(validBody());

    expect(input).toEqual({
      idempotencyKey,
      buyer: {
        fullName: "María Gómez",
        colombianDocumentNumber: "1234567890",
        phone: "573001234567",
        email: "maria@example.com",
      },
      delivery: {
        department: "Cundinamarca",
        cityMunicipality: "Bogotá",
        address: "Calle 10 # 20-30",
        neighborhood: "La Soledad",
        deliveryInstructions: "Llamar al llegar.",
      },
      items: [{ variantId: variantA, quantity: 2 }],
    });
  });

  it.each([
    ["buyer.fullName", { buyer: { fullName: "" } }],
    ["buyer.colombianDocumentNumber", { buyer: { colombianDocumentNumber: "ABC-12" } }],
    ["buyer.phone", { buyer: { phone: "311" } }],
    ["buyer.email", { buyer: { email: "not-an-email" } }],
    ["delivery.department", { delivery: { department: "1" } }],
    ["delivery.cityMunicipality", { delivery: { cityMunicipality: "" } }],
    ["delivery.address", { delivery: { address: "???" } }],
    ["delivery.neighborhood", { delivery: { neighborhood: "" } }],
  ])("rejects malformed %s", (_field, partial) => {
    const body = validBody({
      ...partial,
      buyer: { ...(validBody().buyer as object), ...(partial as { buyer?: object }).buyer },
      delivery: { ...(validBody().delivery as object), ...(partial as { delivery?: object }).delivery },
    });
    expect(() => parseGuestOrderInput(body)).toThrowError(/válidos/);
  });

  it.each([
    ["name", { buyer: { fullName: "María\nGómez" } }],
    ["department", { delivery: { department: "Cundinamarca\t" } }],
    ["city", { delivery: { cityMunicipality: "Bogotá\n" } }],
    ["address", { delivery: { address: "Calle 10\n# 20-30" } }],
    ["instructions", { delivery: { deliveryInstructions: "Llamar\t al llegar" } }],
  ])("rejects C0/C1 control characters in %s", (_field, partial) => {
    const base = validBody();
    const body = {
      ...base,
      buyer: { ...(base.buyer as object), ...(partial as { buyer?: object }).buyer },
      delivery: { ...(base.delivery as object), ...(partial as { delivery?: object }).delivery },
    };
    expect(() => parseGuestOrderInput(body)).toThrowError(/válidos/);
  });

  it("accepts an omitted optional email and delivery instructions", () => {
    const body = validBody({
      buyer: { fullName: "Ana Pérez", colombianDocumentNumber: "12345678", phone: "3001234567" },
      delivery: { department: "Antioquia", cityMunicipality: "Medellín", address: "Carrera 50 # 10-20", neighborhood: "Centro" },
    });
    expect(parseGuestOrderInput(body).buyer.email).toBeNull();
    expect(parseGuestOrderInput(body).delivery.deliveryInstructions).toBeNull();
  });

  it.each([123, false, { text: "Llamar" }])("rejects non-string delivery instructions: %s", (instructions) => {
    expect(() => parseGuestOrderInput(validBody({ delivery: { department: "Cundinamarca", cityMunicipality: "Bogotá", address: "Calle 10 # 20-30", neighborhood: "La Soledad", deliveryInstructions: instructions } }))).toThrowError(/válidos/);
  });

  it.each([
    ["zero", [{ variantId: variantA, quantity: 0 }]],
    ["negative", [{ variantId: variantA, quantity: -1 }]],
    ["oversized", [{ variantId: variantA, quantity: 100 }]],
    ["duplicate variants", [{ variantId: variantA, quantity: 1 }, { variantId: variantA, quantity: 1 }]],
  ])("rejects %s quantities/items", (_label, items) => {
    expect(() => parseGuestOrderInput(validBody({ items }))).toThrowError(/válidos/);
  });

  it("does not accept a client price or product name in RPC parameters", () => {
    const input = parseGuestOrderInput(validBody({
      priceCop: 1,
      productName: "Producto falso",
      items: [{ variantId: variantA, quantity: 2, priceCop: 1, productName: "Falso" }],
    }));
    const params = toCreateOrderRpcParams(input);
    expect(params.p_items).toEqual([{ variant_id: variantA, quantity: 2 }]);
    expect(JSON.stringify(params)).not.toMatch(/price|product.?name/i);
  });

  it("classifies cities by normalized equality, including accents and case", () => {
    expect(classifyDeliveryType("Bogotá", " bogota ")).toBe("local");
    expect(classifyDeliveryType("Medellín", "Cali")).toBe("national");
  });

  it("builds exact itemized WhatsApp content with Spanish delivery wording and no personal data", () => {
    const handoff = buildWhatsAppHandoff("573001234567", {
      id: "order-1", number: "ZP-20260402-ABCD1234", subtotalCop: 499800, deliveryType: "local", replayed: false,
      items: [itemSummary],
    } as Parameters<typeof buildWhatsAppHandoff>[1]);
    expect(handoff.url).toContain("https://wa.me/573001234567?text=");
    expect(handoff.message).toBe([
      "Hola, quiero confirmar mi pedido de Zona de pasos store.",
      "Pedido: ZP-20260402-ABCD1234",
      "Producto: Nike - Air Max | Talla: 38 | Color: Negro | SKU: NK-38 | Cantidad: 2 | Precio unitario: $249.900 COP | Total: $499.800 COP",
      "Entrega local",
      "Subtotal de productos: $499.800 COP",
      "Quedo atento(a) a la confirmación.",
    ].join("\n"));
    expect(handoff.message).not.toMatch(/document|dirección|email|nequi|calle|1234567890/i);
  });

  it("accepts realistic Colombian neighborhood names with digits", () => {
    const input = parseGuestOrderInput(validBody({ delivery: { department: "Bogotá D.C.", cityMunicipality: "Bogotá", address: "Calle 10 # 20-30", neighborhood: "20 de Julio", deliveryInstructions: null } }));
    expect(input.delivery.neighborhood).toBe("20 de Julio");
  });

  it("requires a high-entropy v4 idempotency UUID", () => {
    expect(() => parseGuestOrderInput(validBody({ idempotencyKey: "order-1" }))).toThrowError(/válidos/);
    expect(() => parseGuestOrderInput(validBody({ idempotencyKey: "11111111-1111-1111-8111-111111111111" }))).toThrowError(/válidos/);
  });
});
