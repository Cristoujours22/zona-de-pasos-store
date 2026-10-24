import type { PublicStorefrontSettings } from "@/types/storefront";
import type { StockDisplayMode } from "@/types/catalog";

export const DEFAULT_SUPPORT_GREETING = "Hola, quiero recibir atención sobre los productos de Zona de pasos store.";
export const DEFAULT_LOW_THRESHOLD = 3;
export const DEFAULT_STOCK_DISPLAY_MODE: StockDisplayMode = "availability_only";

export function normalizeWhatsappPhone(value: unknown): string {
  if (typeof value !== "string") return "";
  let digits = value.replace(/\D/gu, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("3")) digits = `57${digits}`;
  return /^\d{8,15}$/u.test(digits) ? digits : "";
}

export function buildWhatsappSupportUrl(value: unknown, greeting = DEFAULT_SUPPORT_GREETING): string | null {
  const phone = normalizeWhatsappPhone(value);
  if (!phone) return null;
  const text = greeting.trim() || DEFAULT_SUPPORT_GREETING;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function normalizePublicSettings(value: unknown): PublicStorefrontSettings {
  const row = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const threshold = row.inventory_low_threshold;
  const stockDisplayMode = row.stock_display_mode;
  const mode: StockDisplayMode = stockDisplayMode === "detailed" || stockDisplayMode === "availability_only" || stockDisplayMode === "hidden"
    ? stockDisplayMode
    : DEFAULT_STOCK_DISPLAY_MODE;
  const whatsappPhone = normalizeWhatsappPhone(row.whatsapp_phone);
  const dispatchOriginCity = typeof row.dispatch_origin_city === "string" ? row.dispatch_origin_city.trim() : "";
  const inventoryLowThreshold = Number.isSafeInteger(threshold) && (threshold as number) >= 0 ? threshold as number : DEFAULT_LOW_THRESHOLD;

  return {
    whatsappPhone,
    supportUrl: buildWhatsappSupportUrl(whatsappPhone),
    dispatchOriginCity,
    inventoryLowThreshold,
    stockDisplayMode: mode,
  };
}

export function emptyPublicSettings(): PublicStorefrontSettings {
  return normalizePublicSettings(null);
}
