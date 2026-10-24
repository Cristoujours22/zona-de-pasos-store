import type { PublicProductVariant } from "@/types/storefront";

export { formatCop } from "@/lib/catalog/presentation";

export interface PublicStockPresentation {
  available: boolean;
  label: string | null;
}

const labelPriority = ["Disponible", "Pocas unidades", "Sin stock", "No disponible"] as const;

export function presentPublicStock(variants: PublicProductVariant[]): PublicStockPresentation {
  const available = variants.some((variant) => variant.available);
  const labels = new Set(variants.map((variant) => variant.stockLabel).filter((label): label is string => Boolean(label)));
  const label = labelPriority.find((candidate) => labels.has(candidate)) ?? null;
  return { available, label };
}
