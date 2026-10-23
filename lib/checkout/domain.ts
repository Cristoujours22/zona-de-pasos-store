import { normalizeWhatsappPhone } from "@/lib/storefront/support";
import type { CheckoutCartItem, CheckoutFormData, CheckoutOrderPayload, CheckoutSuccess, CheckoutValidation } from "@/types/checkout";

export const COLOMBIAN_DEPARTMENTS = [
  "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D.C.", "Bolívar", "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés y Providencia", "Santander", "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada",
] as const;

export const CHECKOUT_FLOW_COPY = {
  availability: "La disponibilidad y el costo del envío los confirma un administrador por WhatsApp.",
  products: "Los productos se pagan por adelantado únicamente por Nequi, después de recibir la instrucción.",
  shipping: "El envío se paga contra entrega y lo asume el cliente.",
  proof: "El comprobante se envía únicamente por WhatsApp y requiere verificación humana.",
  screenshot: "Ninguna captura de pantalla confirma automáticamente el pago.",
} as const;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const NAME = /^[\p{L}][\p{L}\s.'-]{1,119}$/u;
const PLACE = /^[\p{L}][\p{L}\s.'-]{1,79}$/u;
const ADDRESS = /^[\p{L}\p{N}][\p{L}\p{N}\s#.,'°/-]{4,159}$/u;
const NEIGHBORHOOD = /^[\p{L}\p{N}][\p{L}\p{N}\s.'-]{1,79}$/u;
const INSTRUCTIONS = /^[\p{L}\p{N}][\p{L}\p{N}\s#.,'°/()\-]{0,299}$/u;
const ORDER_NUMBER = /^[A-Z0-9][A-Z0-9-]{0,49}$/u;
const IDEMPOTENCY_PREFIX = "zona-de-pasos-store.checkout-idempotency:";
const memoryKeys = new Map<string, string>();

export const EMPTY_CHECKOUT_FORM: CheckoutFormData = {
  fullName: "",
  colombianDocumentNumber: "",
  phone: "",
  email: "",
  department: "",
  cityMunicipality: "",
  address: "",
  neighborhood: "",
  deliveryInstructions: "",
  consent: false,
};

function text(value: string, pattern: RegExp, max: number): boolean {
  const normalized = value.trim();
  return normalized.length <= max && !CONTROL_CHARACTERS.test(value) && pattern.test(normalized);
}

function normalizeDocument(value: string): string {
  return value.replace(/[.\s-]/gu, "");
}

function validEmail(value: string): boolean {
  return !value.trim() || (value.trim().length <= 254 && !CONTROL_CHARACTERS.test(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim()));
}

function validPhone(value: string): boolean {
  return /^573\d{9}$/u.test(normalizeWhatsappPhone(value));
}

export function validateCheckoutForm(form: CheckoutFormData): CheckoutValidation {
  const fieldErrors: CheckoutValidation["fieldErrors"] = {};
  if (!text(form.fullName, NAME, 120)) fieldErrors.fullName = "Escribe tu nombre completo.";
  if (!/^\d{6,10}$/u.test(normalizeDocument(form.colombianDocumentNumber))) fieldErrors.colombianDocumentNumber = "Escribe un número de documento colombiano válido.";
  if (!validPhone(form.phone)) fieldErrors.phone = "Escribe un celular colombiano válido.";
  if (!validEmail(form.email)) fieldErrors.email = "Escribe un correo electrónico válido o déjalo vacío.";
  if (!(COLOMBIAN_DEPARTMENTS as readonly string[]).includes(form.department)) fieldErrors.department = "Selecciona un departamento de Colombia.";
  if (!text(form.cityMunicipality, PLACE, 80)) fieldErrors.cityMunicipality = "Escribe una ciudad o municipio válido.";
  if (!text(form.address, ADDRESS, 160)) fieldErrors.address = "Escribe una dirección válida.";
  if (!text(form.neighborhood, NEIGHBORHOOD, 80) || !/\p{L}/u.test(form.neighborhood)) fieldErrors.neighborhood = "Escribe un barrio válido.";
  if (form.deliveryInstructions.trim() && !text(form.deliveryInstructions, INSTRUCTIONS, 300)) fieldErrors.deliveryInstructions = "Revisa las instrucciones de entrega.";
  if (form.consent !== true) fieldErrors.consent = "Debes dar tu consentimiento para usar estos datos únicamente para procesar y entregar el pedido.";
  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}

export function buildCheckoutPayload(form: CheckoutFormData, items: CheckoutCartItem[], idempotencyKey: string): CheckoutOrderPayload {
  return {
    idempotencyKey,
    items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
    buyer: {
      fullName: form.fullName.trim(),
      colombianDocumentNumber: normalizeDocument(form.colombianDocumentNumber),
      phone: normalizeWhatsappPhone(form.phone),
      email: form.email.trim().toLowerCase() || null,
    },
    delivery: {
      department: form.department,
      cityMunicipality: form.cityMunicipality.trim(),
      address: form.address.trim(),
      neighborhood: form.neighborhood.trim(),
      deliveryInstructions: form.deliveryInstructions.trim() || null,
    },
  };
}

export function getCartIdentity(items: CheckoutCartItem[]): string {
  const parts = items.map((item) => `${item.productId}:${item.variantId}:${item.quantity}`).sort();
  return parts.length ? parts.join("|") : "empty";
}

function storageKey(identity: string): string {
  return `${IDEMPOTENCY_PREFIX}${encodeURIComponent(identity)}`;
}

function validUuid(value: string | null): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}

function createUuidV4(): string {
  const cryptoObject = globalThis.crypto;
  if (typeof cryptoObject?.randomUUID === "function") return cryptoObject.randomUUID();
  if (typeof cryptoObject?.getRandomValues === "function") {
    const bytes = cryptoObject.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error("No hay una fuente segura de aleatoriedad disponible.");
}

function resolveSessionStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  try { return window.sessionStorage; } catch { return null; }
}

export function getOrCreateIdempotencyKey(identity: string, storage?: Storage | null): string {
  const key = storageKey(identity);
  const target = resolveSessionStorage(storage);
  let stored: string | null = null;
  try { stored = target?.getItem(key) ?? null; } catch { stored = null; }
  if (validUuid(stored)) return stored;
  const inMemory = memoryKeys.get(key);
  if (inMemory && validUuid(inMemory)) return inMemory;
  const created = createUuidV4();
  memoryKeys.set(key, created);
  try { target?.setItem(key, created); } catch { /* memory fallback intentionally retains the retry key */ }
  return created;
}

export function forgetIdempotencyKey(identity: string, storage?: Storage | null): void {
  const key = storageKey(identity);
  memoryKeys.delete(key);
  try { resolveSessionStorage(storage)?.removeItem(key); } catch { /* blocked storage has no durable key to remove */ }
}

export function isTrustedWhatsappUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "wa.me" && !url.port && !url.username && !url.password && /^\/\d{8,15}$/u.test(url.pathname);
  } catch {
    return false;
  }
}

export function parseCheckoutResponse(value: unknown): CheckoutSuccess | null {
  const root = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const order = root?.order && typeof root.order === "object" && !Array.isArray(root.order) ? root.order as Record<string, unknown> : null;
  const whatsapp = root?.whatsapp && typeof root.whatsapp === "object" && !Array.isArray(root.whatsapp) ? root.whatsapp as Record<string, unknown> : null;
  const number = order?.number;
  const subtotalCop = order?.subtotalCop;
  const deliveryType = order?.deliveryType;
  if (typeof number !== "string" || !ORDER_NUMBER.test(number) || !Number.isSafeInteger(subtotalCop) || (subtotalCop as number) < 0 || (deliveryType !== "local" && deliveryType !== "national") || !isTrustedWhatsappUrl(whatsapp?.url)) return null;
  return { orderNumber: number, subtotalCop: subtotalCop as number, deliveryType, whatsappUrl: whatsapp.url };
}

export function checkoutErrorMessage(status: number): string {
  if (status === 409) return "El producto seleccionado ya no está disponible o cambió la disponibilidad. Revisa tu carrito e intenta de nuevo.";
  if (status === 429) return "Has alcanzado el límite temporal de pedidos. Intenta más tarde.";
  if (status === 503) return "No fue posible confirmar el pedido en este momento. Conserva tus datos e inténtalo nuevamente.";
  if (status === 400) return "Revisa los datos del pedido e intenta de nuevo.";
  return "No fue posible enviar el pedido. Conserva tus datos e inténtalo nuevamente.";
}

export function formatCop(value: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value);
}
