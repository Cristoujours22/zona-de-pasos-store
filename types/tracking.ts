import type { DeliveryType, OrderStatus } from "@/types/order";

export interface PublicTrackingResult {
  number: string;
  status: OrderStatus;
  deliveryType: DeliveryType;
  productSubtotalCop: number;
  shippingCostCop: number | null;
  carrierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{ brandName: string; productName: string; size: string; color: string; sku: string; quantity: number }>;
  history: Array<{ status: OrderStatus; createdAt: string }>;
}
