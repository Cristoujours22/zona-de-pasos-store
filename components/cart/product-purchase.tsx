"use client";

import Link from "next/link";
import { useState } from "react";

import { useCart } from "@/components/cart/cart-provider";
import { StockLabel } from "@/components/storefront";
import { clampCartQuantity } from "@/lib/cart/domain";
import type { PublicProduct, PublicProductVariant } from "@/types/storefront";

function availabilityLabel(variant: PublicProductVariant): string {
  return variant.stockLabel ?? (variant.available ? "Disponible" : "No disponible");
}

export function ProductPurchase({ product }: { product: PublicProduct }) {
  const { addItem, itemCount } = useCart();
  const initialVariant = product.variants.find((variant) => variant.available) ?? product.variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariant?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId);

  function updateQuantity(value: string) {
    setQuantity(clampCartQuantity(Number(value)));
    setFeedback(null);
  }

  function handleAdd() {
    if (!selectedVariant) return;
    const result = addItem(product, selectedVariant, quantity);
    setFeedback(result.error ?? (result.merged ? "Carrito actualizado." : "Agregado al carrito."));
  }

  return (
    <section aria-labelledby="variants-title" className="mt-10 border-t border-line pt-7">
      <div className="flex items-end justify-between gap-4"><h2 className="font-display text-2xl font-black uppercase" id="variants-title">Talla, color y SKU</h2><span className="text-sm text-muted">{product.variants.length} opciones</span></div>
      {product.variants.length > 0 ? (
        <div className="mt-5 grid gap-3" role="list" aria-label="Variantes del producto">
          {product.variants.map((variant) => {
            const label = availabilityLabel(variant);
            return (
              <button aria-label={`Talla ${variant.size}, ${variant.color}, SKU ${variant.sku}`} aria-pressed={selectedVariantId === variant.id} className="flex w-full flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-cream p-4 text-left transition-colors aria-pressed:border-ink disabled:cursor-not-allowed disabled:opacity-55" disabled={!variant.available} key={variant.id} type="button" onClick={() => { setSelectedVariantId(variant.id); setFeedback(null); }}>
                <span className="grid gap-1 text-sm"><span className="font-bold">Talla {variant.size}</span><span className="text-muted">Color: {variant.color}</span><span className="text-muted">SKU: {variant.sku}</span></span>
                <StockLabel available={variant.available} label={label} />
              </button>
            );
          })}
        </div>
      ) : <p className="mt-5 rounded-xl border border-dashed border-line p-4 text-sm text-muted">No hay opciones disponibles para mostrar.</p>}

      {selectedVariant && (
        <div className="mt-6 grid gap-4 rounded-xl border border-line p-4">
          <p className="text-sm text-muted">Disponibilidad sujeta a confirmación; no publicamos cantidades exactas de inventario.</p>
          <div className="flex flex-wrap items-end gap-4">
            <label className="grid gap-2 text-sm font-bold" htmlFor="cart-quantity">Cantidad
              <input aria-label="Cantidad" className="w-24 rounded-lg border border-line bg-white px-3 py-2 font-normal" id="cart-quantity" inputMode="numeric" max={99} min={1} type="number" value={quantity} onChange={(event) => updateQuantity(event.target.value)} />
            </label>
            <button className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-canvas disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedVariant.available} type="button" onClick={handleAdd}>Agregar al carrito</button>
            <Link className="rounded-full border border-ink px-5 py-3 text-sm font-bold" href="/cart">Ver carrito ({itemCount})</Link>
          </div>
          {feedback && <p className="text-sm font-bold" role="status">{feedback}</p>}
        </div>
      )}
    </section>
  );
}
