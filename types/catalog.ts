export type ProductAudience = "men" | "women" | "unisex";
export type ProductLifecycle = "draft" | "published" | "archived";
export type StockDisplayMode = "detailed" | "availability_only" | "hidden";
export type StockStatus = "full" | "low" | "out_of_stock";

export interface Brand {
  id: string;
  name: string;
  slug: string;
}

export interface Product {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  description: string;
  audience: ProductAudience;
  priceCop: number;
  lifecycle: ProductLifecycle;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductVariant {
  id: string;
  productId: string;
  size: string;
  color: string;
  sku: string;
  active: boolean;
  stockQuantity: number;
}

export interface ProductImage {
  id: string;
  productId: string;
  cloudinaryPublicId: string;
  secureUrl: string;
  altText: string;
  position: number;
  width: number;
  height: number;
}

export interface CommerceSettings {
  whatsappPhone: string;
  nequiDetails: string;
  dispatchOriginCity: string;
  dispatchOriginAddress: string;
  inventoryLowThreshold: number;
  stockDisplayMode: StockDisplayMode;
}

export type PublicStorefrontSettings = Pick<CommerceSettings, "whatsappPhone" | "dispatchOriginCity" | "inventoryLowThreshold" | "stockDisplayMode">;

export interface StockPresentation {
  status: StockStatus;
  available: boolean;
  label: string | null;
}

export interface InventoryAdjustment {
  actorUserId: string;
  delta: number;
  reason: string;
  orderReference?: string | null;
  createdAt: Date;
  stockBefore: number;
  stockAfter: number;
}

export interface InventoryState {
  quantity: number;
  adjustments: InventoryAdjustment[];
}

export interface InventoryAdjustmentInput {
  actorUserId: string;
  delta: number;
  reason: string;
  orderReference?: string | null;
  createdAt: Date;
}
