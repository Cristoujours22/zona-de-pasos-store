import type { DeliveryType, OrderStatus } from "@/types/order";

export interface TransitionOrderInput {
  expectedUpdatedAt: string;
  toStatus: Extract<OrderStatus, "awaiting_payment" | "preparing" | "shipped" | "delivered">;
  note: string | null;
}

export interface ConfirmPaymentInput {
  expectedUpdatedAt: string;
  confirmedAmountCop: number;
  internalNote: string | null;
}

export interface ShippingInput {
  expectedUpdatedAt: string;
  shippingCostCop: number;
  deliveryType: DeliveryType;
  carrierId: string;
  trackingNumber: string;
}

export interface CancelOrderInput {
  expectedUpdatedAt: string;
  reason: string;
}

export interface CarrierInput {
  name: string;
  slug: string;
  trackingUrlTemplate: string | null;
  active: boolean;
  position: number;
}

export class OrderAdminError extends Error {
  constructor(public readonly code: "invalid_request" | "not_found" | "conflict" | "persistence", message: string, public readonly status = 400) {
    super(message);
    this.name = "OrderAdminError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;
const TRACKING = /^[\p{L}\p{N}][\p{L}\p{N}._\-/]{1,99}$/u;
const CARRIER_NAME = /^[\p{L}\p{N}][\p{L}\p{N}\s.&'()-]{1,79}$/u;
const PUBLIC_HTTPS_HOST = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/iu;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OrderAdminError("invalid_request", "La solicitud no es válida.");
  return value as Record<string, unknown>;
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/u.test(value) || Number.isNaN(Date.parse(value))) {
    throw new OrderAdminError("invalid_request", "La versión del pedido no es válida.");
  }
  return value;
}

function text(value: unknown, message: string, max: number): string {
  if (typeof value !== "string" || CONTROL.test(value)) throw new OrderAdminError("invalid_request", message);
  const normalized = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (!normalized || normalized.length > max) throw new OrderAdminError("invalid_request", message);
  return normalized;
}

function optionalText(value: unknown, message: string, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return text(value, message, max);
}

function cop(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new OrderAdminError("invalid_request", message);
  return value;
}

function slug(value: string): string {
  const result = value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  if (!result) throw new OrderAdminError("invalid_request", "El nombre del transportador no es válido.");
  return result;
}

export function parseTransitionInput(value: unknown): TransitionOrderInput {
  const body = record(value);
  if (!(["awaiting_payment", "preparing", "shipped", "delivered"] as const).includes(body.toStatus as never)) {
    throw new OrderAdminError("invalid_request", "La transición solicitada no es válida.");
  }
  return {
    expectedUpdatedAt: timestamp(body.expectedUpdatedAt),
    toStatus: body.toStatus as TransitionOrderInput["toStatus"],
    note: optionalText(body.note, "La nota de la transición no es válida.", 500),
  };
}

export function parseConfirmPaymentInput(value: unknown): ConfirmPaymentInput {
  const body = record(value);
  return {
    expectedUpdatedAt: timestamp(body.expectedUpdatedAt),
    confirmedAmountCop: cop(body.confirmedAmountCop, "El valor confirmado no es válido."),
    internalNote: optionalText(body.internalNote, "La nota interna no es válida.", 500),
  };
}

export function parseShippingInput(value: unknown): ShippingInput {
  const body = record(value);
  if (body.trackingUrl !== undefined) throw new OrderAdminError("invalid_request", "El enlace de seguimiento se deriva del transportador configurado.");
  if (body.deliveryType !== "local" && body.deliveryType !== "national") throw new OrderAdminError("invalid_request", "El tipo de entrega no es válido.");
  if (typeof body.carrierId !== "string" || !UUID.test(body.carrierId)) throw new OrderAdminError("invalid_request", "Selecciona un transportador válido.");
  const trackingNumber = text(body.trackingNumber, "La guía no es válida.", 100);
  if (!TRACKING.test(trackingNumber)) throw new OrderAdminError("invalid_request", "La guía no es válida.");
  return {
    expectedUpdatedAt: timestamp(body.expectedUpdatedAt),
    shippingCostCop: cop(body.shippingCostCop, "El costo de envío no es válido."),
    deliveryType: body.deliveryType,
    carrierId: body.carrierId,
    trackingNumber,
  };
}

export function parseCancelOrderInput(value: unknown): CancelOrderInput {
  const body = record(value);
  return { expectedUpdatedAt: timestamp(body.expectedUpdatedAt), reason: text(body.reason, "Indica el motivo de cancelación.", 500) };
}

export function parseCarrierInput(value: unknown): CarrierInput {
  const body = record(value);
  const name = text(body.name, "El nombre del transportador no es válido.", 80);
  if (!CARRIER_NAME.test(name)) throw new OrderAdminError("invalid_request", "El nombre del transportador no es válido.");
  let trackingUrlTemplate: string | null = null;
  if (body.trackingUrlTemplate !== undefined && body.trackingUrlTemplate !== null && body.trackingUrlTemplate !== "") {
    const template = text(body.trackingUrlTemplate, "La plantilla de seguimiento no es válida.", 500);
    if (!template.includes("{trackingNumber}")) throw new OrderAdminError("invalid_request", "La plantilla debe incluir {trackingNumber}.");
    let url: URL;
    try { url = new URL(template.replace("{trackingNumber}", "TEST123")); } catch { throw new OrderAdminError("invalid_request", "La plantilla de seguimiento no es válida."); }
    if (url.protocol !== "https:" || url.username || url.password || url.port || !PUBLIC_HTTPS_HOST.test(url.hostname)) throw new OrderAdminError("invalid_request", "La plantilla de seguimiento debe usar un dominio HTTPS público sin credenciales ni puerto.");
    trackingUrlTemplate = template;
  }
  if (typeof body.active !== "boolean") throw new OrderAdminError("invalid_request", "El estado del transportador no es válido.");
  if (typeof body.position !== "number" || !Number.isSafeInteger(body.position) || body.position < 0 || body.position > 1000) throw new OrderAdminError("invalid_request", "La posición del transportador no es válida.");
  return { name, slug: slug(name), trackingUrlTemplate, active: body.active, position: body.position };
}
