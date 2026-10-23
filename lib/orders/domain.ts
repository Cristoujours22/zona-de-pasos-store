import { normalizeWhatsappPhone } from "@/lib/storefront/support";
import type { DeliveryType, GuestOrderInput, GuestOrderReceipt, WhatsAppHandoff } from "@/types/order";

export class OrderInputError extends Error {
  constructor() { super("Los datos del pedido no son válidos."); this.name = "OrderInputError"; }
}

export class OrderConflictError extends Error {
  constructor(public readonly reason: "variant_unavailable" | "insufficient_stock") {
    super(reason === "variant_unavailable" ? "El producto seleccionado ya no está disponible." : "La cantidad solicitada supera la disponibilidad actual.");
    this.name = "OrderConflictError";
  }
}

export class OrderWhatsAppNotConfiguredError extends Error {
  constructor() { super("El contacto de WhatsApp no está configurado."); this.name = "OrderWhatsAppNotConfiguredError"; }
}

export class OrderRateLimitError extends Error {
  constructor() { super("Has alcanzado el límite temporal de pedidos. Intenta más tarde."); this.name = "OrderRateLimitError"; }
}

export class OrderPersistenceError extends Error {
  constructor() { super("No fue posible confirmar el pedido. Intenta de nuevo."); this.name = "OrderPersistenceError"; }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, pattern: RegExp, max: number): string {
  if (typeof value !== "string" || CONTROL_CHARACTERS.test(value)) throw new OrderInputError();
  const normalized = value.trim();
  if (!normalized || normalized.length > max || !pattern.test(normalized)) throw new OrderInputError();
  return normalized;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const NAME = /^[\p{L}][\p{L}\s.'-]{1,119}$/u;
const PLACE = /^[\p{L}][\p{L}\s.'-]{1,79}$/u;
const ADDRESS = /^[\p{L}\p{N}][\p{L}\p{N}\s#.,'°/-]{4,159}$/u;
const NEIGHBORHOOD = /^[\p{L}\p{N}][\p{L}\p{N}\s.'-]{1,79}$/u;
const INSTRUCTIONS = /^[\p{L}\p{N}][\p{L}\p{N}\s#.,'°/()\-]{0,299}$/u;

function parseEmail(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || CONTROL_CHARACTERS.test(value)) throw new OrderInputError();
  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new OrderInputError();
  return email;
}

function parseDocument(value: unknown): string {
  if (typeof value !== "string" || CONTROL_CHARACTERS.test(value)) throw new OrderInputError();
  const document = value.replace(/[.\s-]/gu, "");
  if (!/^\d{6,10}$/u.test(document)) throw new OrderInputError();
  return document;
}

function parsePhone(value: unknown): string {
  if (typeof value !== "string" || CONTROL_CHARACTERS.test(value) || !/^[+\s().\-\d]+$/u.test(value)) throw new OrderInputError();
  const phone = normalizeWhatsappPhone(value);
  if (!/^573\d{9}$/u.test(phone)) throw new OrderInputError();
  return phone;
}

function parseNeighborhood(value: unknown): string {
  const neighborhood = text(value, NEIGHBORHOOD, 80);
  if (!/\p{L}/u.test(neighborhood)) throw new OrderInputError();
  return neighborhood;
}

function parseOptionalInstructions(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || CONTROL_CHARACTERS.test(value)) throw new OrderInputError();
  if (!value.trim()) return null;
  return text(value, INSTRUCTIONS, 300);
}

export function parseGuestOrderInput(value: unknown): GuestOrderInput {
  const root = record(value);
  const buyer = record(root?.buyer);
  const delivery = record(root?.delivery);
  if (!root || !buyer || !delivery || typeof root.idempotencyKey !== "string" || !UUID_V4.test(root.idempotencyKey)) throw new OrderInputError();
  if (!Array.isArray(root.items) || root.items.length < 1 || root.items.length > 50) throw new OrderInputError();

  const seen = new Set<string>();
  const items = root.items.map((value) => {
    const item = record(value);
    const variantId = item?.variantId;
    const quantity = item?.quantity;
    if (typeof variantId !== "string" || !UUID_V4.test(variantId) || !Number.isSafeInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 99 || seen.has(variantId)) throw new OrderInputError();
    seen.add(variantId);
    return { variantId, quantity: quantity as number };
  });

  return {
    idempotencyKey: root.idempotencyKey,
    buyer: {
      fullName: text(buyer.fullName, NAME, 120),
      colombianDocumentNumber: parseDocument(buyer.colombianDocumentNumber),
      phone: parsePhone(buyer.phone),
      email: parseEmail(buyer.email),
    },
    delivery: {
      department: text(delivery.department, PLACE, 80),
      cityMunicipality: text(delivery.cityMunicipality, PLACE, 80),
      address: text(delivery.address, ADDRESS, 160),
      neighborhood: parseNeighborhood(delivery.neighborhood),
      deliveryInstructions: parseOptionalInstructions(delivery.deliveryInstructions),
    },
    items,
  };
}

export function normalizeCity(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es-CO").replace(/\s+/gu, " ");
}

export function classifyDeliveryType(destinationCity: string, dispatchOriginCity: string): DeliveryType {
  return normalizeCity(destinationCity) === normalizeCity(dispatchOriginCity) ? "local" : "national";
}

export function toCreateOrderRpcParams(input: GuestOrderInput) {
  return {
    p_idempotency_key: input.idempotencyKey,
    p_buyer_full_name: input.buyer.fullName,
    p_colombian_document_number: input.buyer.colombianDocumentNumber,
    p_phone: input.buyer.phone,
    p_email: input.buyer.email,
    p_department: input.delivery.department,
    p_city_municipality: input.delivery.cityMunicipality,
    p_address: input.delivery.address,
    p_neighborhood: input.delivery.neighborhood,
    p_delivery_instructions: input.delivery.deliveryInstructions,
    p_items: input.items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
  };
}

function formatCop(value: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value);
}

export function buildWhatsAppHandoff(phone: string, receipt: GuestOrderReceipt): WhatsAppHandoff {
  const normalizedPhone = normalizeWhatsappPhone(phone);
  if (!normalizedPhone) throw new OrderWhatsAppNotConfiguredError();
  const deliveryLabel = receipt.deliveryType === "local" ? "Entrega local" : "Envío nacional";
  const itemLines = receipt.items.map((item) => `Producto: ${item.brandName} - ${item.productName} | Talla: ${item.size} | Color: ${item.color} | SKU: ${item.sku} | Cantidad: ${item.quantity} | Precio unitario: $${formatCop(item.unitPriceCop)} COP | Total: $${formatCop(item.lineTotalCop)} COP`);
  const message = [
    "Hola, quiero confirmar mi pedido de Zona de pasos store.",
    `Pedido: ${receipt.number}`,
    ...itemLines,
    deliveryLabel,
    `Subtotal de productos: $${formatCop(receipt.subtotalCop)} COP`,
    "Quedo atento(a) a la confirmación.",
  ].join("\n");
  return { url: `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`, message };
}
