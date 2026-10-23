import { describe, expect, it } from "vitest";

import {
  OrderAdminError,
  parseCancelOrderInput,
  parseCarrierInput,
  parseConfirmPaymentInput,
  parseShippingInput,
  parseTransitionInput,
} from "@/lib/orders/admin/domain";

describe("order administration domain", () => {
  it("accepts only explicit non-payment state transitions", () => {
    expect(parseTransitionInput({ expectedUpdatedAt: "2026-04-03T10:00:00.000Z", toStatus: "awaiting_payment", note: "Disponibilidad confirmada" })).toEqual({
      expectedUpdatedAt: "2026-04-03T10:00:00.000Z",
      toStatus: "awaiting_payment",
      note: "Disponibilidad confirmada",
    });
    for (const toStatus of ["payment_confirmed", "canceled", "pending_confirmation", "unknown"]) {
      expect(() => parseTransitionInput({ expectedUpdatedAt: "2026-04-03T10:00:00.000Z", toStatus })).toThrow(OrderAdminError);
    }
  });

  it("requires exact integer payment data and bounds the internal note", () => {
    expect(parseConfirmPaymentInput({ expectedUpdatedAt: "2026-04-03T10:00:00.000Z", confirmedAmountCop: 249900, internalNote: "Verificado en Nequi" })).toEqual({
      expectedUpdatedAt: "2026-04-03T10:00:00.000Z",
      confirmedAmountCop: 249900,
      internalNote: "Verificado en Nequi",
    });
    expect(() => parseConfirmPaymentInput({ expectedUpdatedAt: "invalid", confirmedAmountCop: 249900 })).toThrow(OrderAdminError);
    expect(() => parseConfirmPaymentInput({ expectedUpdatedAt: "2026-04-03T10:00:00.000Z", confirmedAmountCop: -1 })).toThrow(OrderAdminError);
    expect(() => parseConfirmPaymentInput({ expectedUpdatedAt: "2026-04-03T10:00:00.000Z", confirmedAmountCop: 249900, internalNote: "x".repeat(501) })).toThrow(OrderAdminError);
  });

  it("validates shipping data without accepting arbitrary tracking URLs", () => {
    expect(parseShippingInput({
      expectedUpdatedAt: "2026-04-03T10:00:00.000Z",
      shippingCostCop: 18000,
      deliveryType: "national",
      carrierId: "11111111-1111-4111-8111-111111111111",
      trackingNumber: "ENV-123456",
    })).toEqual({
      expectedUpdatedAt: "2026-04-03T10:00:00.000Z",
      shippingCostCop: 18000,
      deliveryType: "national",
      carrierId: "11111111-1111-4111-8111-111111111111",
      trackingNumber: "ENV-123456",
    });
    expect(() => parseShippingInput({ expectedUpdatedAt: "2026-04-03T10:00:00.000Z", shippingCostCop: 1, deliveryType: "local", carrierId: "bad", trackingNumber: "A" })).toThrow(OrderAdminError);
    expect(() => parseShippingInput({ expectedUpdatedAt: "2026-04-03T10:00:00.000Z", shippingCostCop: 1, deliveryType: "local", carrierId: "11111111-1111-4111-8111-111111111111", trackingNumber: "A", trackingUrl: "https://evil.example" })).toThrow(OrderAdminError);
  });

  it("requires a cancellation reason and validates configurable carrier templates", () => {
    expect(parseCancelOrderInput({ expectedUpdatedAt: "2026-04-03T10:00:00.000Z", reason: "Cliente desistió" })).toEqual({ expectedUpdatedAt: "2026-04-03T10:00:00.000Z", reason: "Cliente desistió" });
    expect(() => parseCancelOrderInput({ expectedUpdatedAt: "2026-04-03T10:00:00.000Z", reason: "" })).toThrow(OrderAdminError);

    expect(parseCarrierInput({ name: "Servientrega", trackingUrlTemplate: "https://www.servientrega.com/wps/portal/rastreo-envio/?guia={trackingNumber}", active: true, position: 4 })).toMatchObject({
      name: "Servientrega",
      slug: "servientrega",
      active: true,
      position: 4,
    });
    expect(() => parseCarrierInput({ name: "Carrier", trackingUrlTemplate: "http://example.com/{trackingNumber}", active: true, position: 0 })).toThrow(OrderAdminError);
    expect(() => parseCarrierInput({ name: "Carrier", trackingUrlTemplate: "https://example.com/track", active: true, position: 0 })).toThrow(OrderAdminError);
  });
});
