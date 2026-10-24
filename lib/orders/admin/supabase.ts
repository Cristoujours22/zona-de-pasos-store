import type { SupabaseClient } from "@supabase/supabase-js";

import { OrderAdminPersistenceError, type OrderAdminAdapter } from "@/lib/orders/admin/service";
import type { AdminOrderDetail, AdminOrderSummary, CommerceCarrier, OrderHistoryEntry } from "@/types/order-admin";
import type { GuestOrderItemSummary } from "@/types/order";

type DbError = { code?: string; message?: string } | null;

function fail(error: DbError): void {
  if (error) throw new OrderAdminPersistenceError(`${error.code ?? "database"}:${error.message ?? "failure"}`);
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OrderAdminPersistenceError("missing_database_row");
  return value as Record<string, unknown>;
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new OrderAdminPersistenceError("invalid_database_number");
  return parsed;
}

function summary(value: unknown): AdminOrderSummary {
  const item = object(value);
  return {
    id: String(item.id), number: String(item.order_number), status: item.status as AdminOrderSummary["status"],
    buyerFullName: String(item.buyer_full_name), phone: String(item.phone), cityMunicipality: String(item.city_municipality),
    deliveryType: item.delivery_type as AdminOrderSummary["deliveryType"], productSubtotalCop: safeNumber(item.product_subtotal_cop),
    shippingCostCop: item.shipping_cost_cop === null ? null : safeNumber(item.shipping_cost_cop), carrierName: nullableString(item.carrier_name_snapshot),
    trackingNumber: nullableString(item.tracking_number), createdAt: String(item.created_at), updatedAt: String(item.updated_at),
  };
}

function orderItem(value: unknown): GuestOrderItemSummary {
  const item = object(value);
  return {
    brandName: String(item.product_brand_name), productName: String(item.product_name), size: String(item.variant_size), color: String(item.variant_color), sku: String(item.variant_sku),
    quantity: safeNumber(item.requested_quantity), unitPriceCop: safeNumber(item.unit_price_cop), lineTotalCop: safeNumber(item.line_total_cop),
  };
}

function history(value: unknown): OrderHistoryEntry {
  const item = object(value);
  return { id: String(item.id), fromStatus: item.from_status as OrderHistoryEntry["fromStatus"], toStatus: item.to_status as OrderHistoryEntry["toStatus"], actorUserId: nullableString(item.actor_user_id), note: nullableString(item.note), createdAt: String(item.created_at) };
}

function detail(value: unknown, historyRows: unknown[]): AdminOrderDetail {
  const item = object(value);
  const items = Array.isArray(item.order_items) ? item.order_items : [];
  return {
    ...summary(item),
    colombianDocumentNumber: String(item.colombian_document_number), email: nullableString(item.email), department: String(item.department), address: String(item.address), neighborhood: String(item.neighborhood), deliveryInstructions: nullableString(item.delivery_instructions),
    paymentConfirmedBy: nullableString(item.payment_confirmed_by), paymentConfirmedAt: nullableString(item.payment_confirmed_at), paymentConfirmedAmountCop: item.payment_confirmed_amount_cop === null ? null : safeNumber(item.payment_confirmed_amount_cop), paymentInternalNote: nullableString(item.payment_internal_note),
    carrierId: nullableString(item.carrier_id), trackingUrl: nullableString(item.tracking_url), shippedAt: nullableString(item.shipped_at), deliveredAt: nullableString(item.delivered_at), canceledAt: nullableString(item.canceled_at), cancellationReason: nullableString(item.cancellation_reason),
    items: items.map(orderItem), history: historyRows.map(history),
  };
}

function carrier(value: unknown): CommerceCarrier {
  const item = object(value);
  return { id: String(item.id), name: String(item.name), slug: String(item.slug), trackingUrlTemplate: nullableString(item.tracking_url_template), active: Boolean(item.active), position: safeNumber(item.position), updatedAt: String(item.updated_at) };
}

const ORDER_COLUMNS = "id, order_number, status, buyer_full_name, colombian_document_number, phone, email, department, city_municipality, address, neighborhood, delivery_instructions, delivery_type, product_subtotal_cop, shipping_cost_cop, payment_confirmed_by, payment_confirmed_at, payment_confirmed_amount_cop, payment_internal_note, carrier_id, carrier_name_snapshot, tracking_number, tracking_url, shipped_at, delivered_at, canceled_at, cancellation_reason, created_at, updated_at";
const ITEM_COLUMNS = "product_brand_name, product_name, variant_size, variant_color, variant_sku, requested_quantity, unit_price_cop, line_total_cop";

export function createSupabaseOrderAdminAdapter(client: SupabaseClient): OrderAdminAdapter {
  async function getOrder(id: string): Promise<AdminOrderDetail> {
    const [orderResult, historyResult] = await Promise.all([
      client.from("orders").select(`${ORDER_COLUMNS}, order_items(${ITEM_COLUMNS})`).eq("id", id).single(),
      client.from("order_status_history").select("id, from_status, to_status, actor_user_id, note, created_at").eq("order_id", id).order("created_at", { ascending: true }).order("id", { ascending: true }),
    ]);
    fail(orderResult.error);
    fail(historyResult.error);
    return detail(orderResult.data, historyResult.data ?? []);
  }

  return {
    async listOrders() {
      const result = await client.from("orders").select(ORDER_COLUMNS).order("created_at", { ascending: false });
      fail(result.error);
      return (result.data ?? []).map(summary);
    },
    getOrder,
    async transitionOrder(id, input) {
      const result = await client.rpc("admin_transition_order", { p_order_id: id, p_expected_updated_at: input.expectedUpdatedAt, p_to_status: input.toStatus, p_note: input.note });
      fail(result.error);
      return getOrder(id);
    },
    async confirmPayment(id, input) {
      const result = await client.rpc("admin_confirm_order_payment", { p_order_id: id, p_expected_updated_at: input.expectedUpdatedAt, p_confirmed_amount_cop: input.confirmedAmountCop, p_internal_note: input.internalNote });
      fail(result.error);
      return getOrder(id);
    },
    async updateShipping(id, input) {
      const result = await client.rpc("admin_update_order_shipping", { p_order_id: id, p_expected_updated_at: input.expectedUpdatedAt, p_shipping_cost_cop: input.shippingCostCop, p_delivery_type: input.deliveryType, p_carrier_id: input.carrierId, p_tracking_number: input.trackingNumber });
      fail(result.error);
      return getOrder(id);
    },
    async cancelOrder(id, input) {
      const result = await client.rpc("admin_cancel_order", { p_order_id: id, p_expected_updated_at: input.expectedUpdatedAt, p_reason: input.reason });
      fail(result.error);
      return getOrder(id);
    },
    async listCarriers() {
      const result = await client.from("commerce_carriers").select("id, name, slug, tracking_url_template, active, position, updated_at").order("position", { ascending: true }).order("name", { ascending: true });
      fail(result.error);
      return (result.data ?? []).map(carrier);
    },
    async upsertCarrier(id, input) {
      const result = await client.rpc("admin_upsert_carrier", { p_carrier_id: id, p_name: input.name, p_slug: input.slug, p_tracking_url_template: input.trackingUrlTemplate, p_active: input.active, p_position: input.position });
      fail(result.error);
      return carrier(result.data);
    },
  };
}
