import { getStockStatus } from "@/lib/catalog/domain";
import type { ProductAudience, ProductLifecycle, ProductVariant, StockStatus } from "@/types/catalog";

const copFormatter = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function formatCop(value: number): string {
  return copFormatter.format(value);
}

export interface AggregateStockState {
  quantity: number;
  status: StockStatus;
  label: string;
}

export function getAggregateStockState(variants: ProductVariant[], lowThreshold = 3): AggregateStockState {
  const quantity = variants.reduce((total, variant) => total + (variant.active ? variant.stockQuantity : 0), 0);
  const status = getStockStatus(quantity, lowThreshold);
  return { quantity, status, label: status === "full" ? "Disponible" : status === "low" ? "Pocas unidades" : "Sin stock" };
}

export function audienceLabel(audience: ProductAudience): string {
  return audience === "men" ? "Hombre" : audience === "women" ? "Mujer" : "Unisex";
}

export function lifecycleLabel(lifecycle: ProductLifecycle): string {
  return lifecycle === "published" ? "Publicado" : lifecycle === "archived" ? "Archivado" : "Borrador";
}
