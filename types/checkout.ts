import type { CartItem } from "@/types/cart";

export interface CheckoutFormData {
  fullName: string;
  colombianDocumentNumber: string;
  phone: string;
  email: string;
  department: string;
  cityMunicipality: string;
  address: string;
  neighborhood: string;
  deliveryInstructions: string;
  consent: boolean;
}

export type CheckoutField = keyof CheckoutFormData;

export interface CheckoutValidation {
  valid: boolean;
  fieldErrors: Partial<Record<CheckoutField, string>>;
}

export interface CheckoutOrderPayload {
  idempotencyKey: string;
  items: Array<{ variantId: string; quantity: number }>;
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
}

export interface CheckoutReceipt {
  id: string;
  number: string;
  subtotalCop: number;
  deliveryType: "local" | "national";
  replayed: boolean;
  items: Array<{
    brandName: string;
    productName: string;
    size: string;
    color: string;
    sku: string;
    quantity: number;
    unitPriceCop: number;
    lineTotalCop: number;
  }>;
}

export interface CheckoutSuccess {
  orderNumber: string;
  subtotalCop: number;
  deliveryType: "local" | "national";
  whatsappUrl: string;
}

export type CheckoutCartItem = Pick<CartItem, "productId" | "variantId" | "quantity"> & Partial<Pick<CartItem, "productName" | "displayPriceCop">>;
