import type {
  InventoryAdjustment,
  InventoryAdjustmentInput,
  InventoryState,
  StockDisplayMode,
  StockPresentation,
  StockStatus,
} from "@/types/catalog";

export type CatalogErrorCode = "invalid_price" | "invalid_stock" | "invalid_threshold" | "invalid_delta" | "negative_stock" | "invalid_reason" | "invalid_actor";

export class CatalogDomainError extends Error {
  readonly code: CatalogErrorCode;

  constructor(code: CatalogErrorCode, message: string) {
    super(message);
    this.name = "CatalogDomainError";
    this.code = code;
  }
}

function nonnegativeInteger(value: number, message: string, code: "invalid_stock" | "invalid_threshold"): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new CatalogDomainError(code, message);
  return value;
}

export function assertCopPrice(priceCop: number): number {
  if (!Number.isSafeInteger(priceCop) || priceCop < 0) throw new CatalogDomainError("invalid_price", "COP price must be a nonnegative integer");
  return priceCop;
}

export function getStockStatus(quantity: number, lowThreshold: number): StockStatus {
  nonnegativeInteger(quantity, "Stock quantity must be a nonnegative integer", "invalid_stock");
  nonnegativeInteger(lowThreshold, "Stock threshold must be a nonnegative integer", "invalid_threshold");
  if (quantity === 0) return "out_of_stock";
  return quantity <= lowThreshold ? "low" : "full";
}

export function presentStock(quantity: number, lowThreshold: number, mode: StockDisplayMode): StockPresentation {
  const status = getStockStatus(quantity, lowThreshold);
  const available = quantity > 0;
  if (mode === "hidden") return { status, available, label: null };
  if (mode === "availability_only") return { status, available, label: available ? "Disponible" : "No disponible" };
  const label = status === "full" ? "Disponible" : status === "low" ? "Pocas unidades" : "Sin stock";
  return { status, available, label };
}

export function applyInventoryAdjustment(state: InventoryState, input: InventoryAdjustmentInput): InventoryState {
  nonnegativeInteger(state.quantity, "Stock quantity must be a nonnegative integer", "invalid_stock");
  if (!input.actorUserId.trim()) throw new CatalogDomainError("invalid_actor", "An inventory adjustment needs an actor");
  if (!Number.isSafeInteger(input.delta) || input.delta === 0) throw new CatalogDomainError("invalid_delta", "Inventory delta must be a nonzero integer");
  const reason = input.reason.trim();
  if (!reason) throw new CatalogDomainError("invalid_reason", "Inventory adjustment needs a reason");
  const stockAfter = state.quantity + input.delta;
  if (stockAfter < 0) throw new CatalogDomainError("negative_stock", "Stock cannot become negative");

  const adjustment: InventoryAdjustment = {
    actorUserId: input.actorUserId,
    delta: input.delta,
    reason,
    orderReference: input.orderReference ?? null,
    createdAt: input.createdAt,
    stockBefore: state.quantity,
    stockAfter,
  };
  return { quantity: stockAfter, adjustments: [...state.adjustments, adjustment] };
}
