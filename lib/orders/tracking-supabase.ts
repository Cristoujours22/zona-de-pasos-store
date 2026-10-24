import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { PublicTrackingResult } from "@/types/tracking";

export class TrackingNotFoundError extends Error { constructor() { super("Pedido no encontrado."); this.name = "TrackingNotFoundError"; } }
export class TrackingPersistenceError extends Error { constructor() { super("No fue posible consultar el seguimiento."); this.name = "TrackingPersistenceError"; } }

function object(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function number(value: unknown): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new TrackingPersistenceError();
  return result;
}
function text(value: unknown): string { if (typeof value !== "string" || !value.trim()) throw new TrackingPersistenceError(); return value; }
function nullableText(value: unknown): string | null { return value === null || value === undefined ? null : text(value); }
function safeTrackingUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new TrackingPersistenceError();
  try {
    const url = new URL(value);
    const publicHost = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/iu;
    return url.protocol === "https:" && !url.username && !url.password && !url.port && publicHost.test(url.hostname) ? url.toString() : null;
  } catch { return null; }
}

export async function getPublicOrderTracking(client: SupabaseClient, orderId: string): Promise<PublicTrackingResult> {
  const [orderResult, historyResult] = await Promise.all([
    client.from("orders").select("id, order_number, status, delivery_type, product_subtotal_cop, shipping_cost_cop, carrier_name_snapshot, tracking_number, tracking_url, created_at, updated_at, order_items(product_brand_name, product_name, variant_size, variant_color, variant_sku, requested_quantity)").eq("id", orderId).single(),
    client.from("order_status_history").select("to_status, created_at").eq("order_id", orderId).order("created_at", { ascending: true }).order("id", { ascending: true }),
  ]);
  if (orderResult.error?.code === "PGRST116") throw new TrackingNotFoundError();
  if (orderResult.error || historyResult.error) throw new TrackingPersistenceError();
  const row = object(orderResult.data);
  if (!row) throw new TrackingPersistenceError();
  const rawItems = Array.isArray(row.order_items) ? row.order_items : [];
  const rawHistory = Array.isArray(historyResult.data) ? historyResult.data : [];
  const status = row.status;
  const deliveryType = row.delivery_type;
  if (!(["pending_confirmation", "awaiting_payment", "payment_confirmed", "preparing", "shipped", "delivered", "canceled"] as unknown[]).includes(status) || (deliveryType !== "local" && deliveryType !== "national")) throw new TrackingPersistenceError();
  return {
    number: text(row.order_number), status: status as PublicTrackingResult["status"], deliveryType,
    productSubtotalCop: number(row.product_subtotal_cop), shippingCostCop: row.shipping_cost_cop === null ? null : number(row.shipping_cost_cop),
    carrierName: nullableText(row.carrier_name_snapshot), trackingNumber: nullableText(row.tracking_number), trackingUrl: safeTrackingUrl(row.tracking_url),
    createdAt: text(row.created_at), updatedAt: text(row.updated_at),
    items: rawItems.map((value) => { const item = object(value); if (!item) throw new TrackingPersistenceError(); return { brandName: text(item.product_brand_name), productName: text(item.product_name), size: text(item.variant_size), color: text(item.variant_color), sku: text(item.variant_sku), quantity: number(item.requested_quantity) }; }),
    history: rawHistory.map((value) => { const item = object(value); if (!item || !(["pending_confirmation", "awaiting_payment", "payment_confirmed", "preparing", "shipped", "delivered", "canceled"] as unknown[]).includes(item.to_status)) throw new TrackingPersistenceError(); return { status: item.to_status as PublicTrackingResult["status"], createdAt: text(item.created_at) }; }),
  };
}
