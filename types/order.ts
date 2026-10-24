export type OrderStatus = "pending_confirmation" | "awaiting_payment" | "payment_confirmed" | "preparing" | "shipped" | "delivered" | "canceled";
export type DeliveryType = "local" | "national";

export interface GuestOrderItemSummary {
  brandName: string;
  productName: string;
  size: string;
  color: string;
  sku: string;
  quantity: number;
  unitPriceCop: number;
  lineTotalCop: number;
}

export interface GuestOrderInput {
  idempotencyKey: string;
  buyer: {
    fullName: string;
    colombianDocumentNumber: string;
    phone: string;
    email: string | null;
  };
  delivery: {
    department: string;
    cityMunicipality: string;
    address: string;
    neighborhood: string;
    deliveryInstructions: string | null;
  };
  items: Array<{ variantId: string; quantity: number }>;
}

export interface GuestOrderReceipt {
  id: string;
  number: string;
  subtotalCop: number;
  deliveryType: DeliveryType;
  replayed: boolean;
  items: GuestOrderItemSummary[];
}

export interface WhatsAppHandoff {
  url: string;
  message: string;
}
