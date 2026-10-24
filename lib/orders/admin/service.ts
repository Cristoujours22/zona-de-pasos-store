import {
  OrderAdminError,
  parseCancelOrderInput,
  parseCarrierInput,
  parseConfirmPaymentInput,
  parseShippingInput,
  parseTransitionInput,
  type CancelOrderInput,
  type CarrierInput,
  type ConfirmPaymentInput,
  type ShippingInput,
  type TransitionOrderInput,
} from "@/lib/orders/admin/domain";
import type { AdminOrderDetail, AdminOrderSummary, CommerceCarrier } from "@/types/order-admin";

export interface OrderAdminAdapter {
  listOrders(): Promise<AdminOrderSummary[]>;
  getOrder(id: string): Promise<AdminOrderDetail>;
  transitionOrder(id: string, input: TransitionOrderInput): Promise<AdminOrderDetail>;
  confirmPayment(id: string, input: ConfirmPaymentInput): Promise<AdminOrderDetail>;
  updateShipping(id: string, input: ShippingInput): Promise<AdminOrderDetail>;
  cancelOrder(id: string, input: CancelOrderInput): Promise<AdminOrderDetail>;
  listCarriers(): Promise<CommerceCarrier[]>;
  upsertCarrier(id: string | null, input: CarrierInput): Promise<CommerceCarrier>;
}

export class OrderAdminPersistenceError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "OrderAdminPersistenceError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function orderId(value: string): string {
  if (!UUID.test(value)) throw new OrderAdminError("invalid_request", "El pedido no es válido.");
  return value;
}

function persistenceError(error: unknown): OrderAdminError {
  if (error instanceof OrderAdminError) return error;
  if (error instanceof OrderAdminPersistenceError) {
    if (error.reason.includes("not_found")) return new OrderAdminError("not_found", "El recurso solicitado no existe.", 404);
    if (error.reason.includes("order_version_conflict")) return new OrderAdminError("conflict", "El pedido cambió. Recarga antes de continuar.", 409);
    if (error.reason.includes("invalid_order_transition")) return new OrderAdminError("conflict", "El cambio de estado no es válido para este pedido.", 409);
    if (error.reason.includes("payment_amount_mismatch")) return new OrderAdminError("conflict", "El valor confirmado debe coincidir con el subtotal de productos.", 409);
    if (error.reason.includes("shipping_details_required")) return new OrderAdminError("conflict", "Completa el envío antes de marcar el pedido como despachado.", 409);
    if (error.reason.includes("23505")) return new OrderAdminError("conflict", "Ya existe un transportador con esos datos.", 409);
  }
  return new OrderAdminError("persistence", "No fue posible completar la operación. Intenta de nuevo.", 502);
}

async function persist<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) { throw persistenceError(error); }
}

export function createOrderAdminService(adapter: OrderAdminAdapter) {
  return {
    listOrders: () => persist(() => adapter.listOrders()),
    getOrder: (id: string) => persist(() => adapter.getOrder(orderId(id))),
    transitionOrder: (id: string, value: unknown) => persist(() => adapter.transitionOrder(orderId(id), parseTransitionInput(value))),
    confirmPayment: (id: string, value: unknown) => persist(() => adapter.confirmPayment(orderId(id), parseConfirmPaymentInput(value))),
    updateShipping: (id: string, value: unknown) => persist(() => adapter.updateShipping(orderId(id), parseShippingInput(value))),
    cancelOrder: (id: string, value: unknown) => persist(() => adapter.cancelOrder(orderId(id), parseCancelOrderInput(value))),
    listCarriers: () => persist(() => adapter.listCarriers()),
    createCarrier: (value: unknown) => persist(() => adapter.upsertCarrier(null, parseCarrierInput(value))),
    updateCarrier: (id: string, value: unknown) => persist(() => adapter.upsertCarrier(orderId(id), parseCarrierInput(value))),
  };
}
