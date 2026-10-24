import type { DeliveryType, GuestOrderItemSummary, OrderStatus } from "@/types/order";

export interface CommerceCarrier {
  id: string;
  name: string;
  slug: string;
  trackingUrlTemplate: string | null;
  active: boolean;
  position: number;
  updatedAt: string;
}

export interface OrderHistoryEntry {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorUserId: string | null;
  note: string | null;
  createdAt: string;
}

export interface AdminOrderSummary {
  id: string;
  number: string;
  status: OrderStatus;
  buyerFullName: string;
  phone: string;
  cityMunicipality: string;
  deliveryType: DeliveryType;
  productSubtotalCop: number;
  shippingCostCop: number | null;
  carrierName: string | null;
  trackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  colombianDocumentNumber: string;
  email: string | null;
  department: string;
  address: string;
  neighborhood: string;
  deliveryInstructions: string | null;
  paymentConfirmedBy: string | null;
  paymentConfirmedAt: string | null;
  paymentConfirmedAmountCop: number | null;
  paymentInternalNote: string | null;
  carrierId: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  canceledAt: string | null;
  cancellationReason: string | null;
  items: GuestOrderItemSummary[];
  history: OrderHistoryEntry[];
}
