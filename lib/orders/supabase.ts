import type { SupabaseClient } from "@supabase/supabase-js";

import { OrderConflictError, OrderInputError, OrderPersistenceError, OrderRateLimitError, toCreateOrderRpcParams } from "@/lib/orders/domain";
import type { GuestOrderInput, GuestOrderItemSummary, GuestOrderReceipt } from "@/types/order";

export interface GuestOrderAdapter {
  createOrder(input: GuestOrderInput): Promise<GuestOrderReceipt>;
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function mapRpcError(error: { code?: string; message?: string } | null): never {
  const message = error?.message ?? "";
  if (message.includes("variant_unavailable")) throw new OrderConflictError("variant_unavailable");
  if (message.includes("insufficient_stock")) throw new OrderConflictError("insufficient_stock");
  if (message.includes("order_rate_limited")) throw new OrderRateLimitError();
  if (message.includes("invalid_order_input") || message.includes("duplicate_variant")) throw new OrderInputError();
  throw new OrderPersistenceError();
}

function integer(value: unknown): number {
  if (value === null || value === undefined || (typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !value.trim())) throw new OrderPersistenceError();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new OrderPersistenceError();
  return parsed;
}

function itemSummaries(value: unknown): GuestOrderItemSummary[] {
  if (!Array.isArray(value)) throw new OrderPersistenceError();
  return value.map((value) => {
    const row = object(value);
    if (typeof row?.product_brand_name !== "string" || typeof row.product_name !== "string" || typeof row.variant_size !== "string" || typeof row.variant_color !== "string" || typeof row.variant_sku !== "string") throw new OrderPersistenceError();
    const quantity = integer(row.requested_quantity);
    const unitPriceCop = integer(row.unit_price_cop);
    const lineTotalCop = integer(row.line_total_cop);
    if (!row.product_brand_name.trim() || !row.product_name.trim() || !row.variant_size.trim() || !row.variant_color.trim() || !row.variant_sku.trim() || quantity < 1 || unitPriceCop < 0 || lineTotalCop < 0) throw new OrderPersistenceError();
    return { brandName: row.product_brand_name, productName: row.product_name, size: row.variant_size, color: row.variant_color, sku: row.variant_sku, quantity, unitPriceCop, lineTotalCop };
  });
}

function receipt(value: unknown): GuestOrderReceipt {
  const row = object(Array.isArray(value) ? value[0] : value);
  const subtotalCop = integer(row?.product_subtotal_cop);
  const deliveryType = row?.delivery_type;
  if (typeof row?.order_id !== "string" || typeof row.order_number !== "string" || subtotalCop < 0 || (deliveryType !== "local" && deliveryType !== "national")) throw new OrderPersistenceError();
  return {
    id: row.order_id,
    number: row.order_number,
    subtotalCop,
    deliveryType,
    replayed: row.replayed === true,
    items: itemSummaries(row.item_summaries),
  };
}

export async function getPublicWhatsappPhone(settingsClient: SupabaseClient): Promise<string> {
  const result = await settingsClient.from("storefront_settings").select("whatsapp_phone").maybeSingle();
  if (result.error) throw new OrderPersistenceError();
  const row = object(result.data);
  return typeof row?.whatsapp_phone === "string" ? row.whatsapp_phone : "";
}

export function createSupabaseGuestOrderAdapter(orderClient: SupabaseClient): GuestOrderAdapter {
  return {
    async createOrder(input) {
      const result = await orderClient.rpc("create_guest_order_atomic", toCreateOrderRpcParams(input));
      if (result.error) mapRpcError(result.error);
      return receipt(result.data);
    },
  };
}
