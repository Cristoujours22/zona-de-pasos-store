import type { PublicStockPresentation } from "@/lib/storefront/presentation";

const SAFE_LABELS = new Set(["Disponible", "Pocas unidades", "Sin stock", "No disponible"]);

export function StockLabel({ available, label }: PublicStockPresentation) {
  if (!label || !SAFE_LABELS.has(label)) return null;
  return <span aria-label={`Disponibilidad: ${label}`} data-available={available}>{label}</span>;
}
