"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import { useCart } from "@/components/cart/cart-provider";
import { Price } from "@/components/storefront";

export function CartPageContent() {
  const { items, subtotalCop, hydrated, setQuantity, removeItem, clearCart } = useCart();

  if (!hydrated) {
    return <main className="shell py-16" id="contenido"><p role="status">Cargando carrito…</p></main>;
  }

  if (items.length === 0) {
    return (
      <main className="shell py-16" id="contenido">
        <div className="rounded-[2rem] border border-dashed border-line bg-cream p-8 sm:p-12" role="status">
          <p className="eyebrow">Tu selección</p>
          <h1 className="mt-4 font-display text-5xl font-black uppercase leading-none tracking-tight">Carrito vacío</h1>
          <p className="mt-5 max-w-lg leading-6 text-muted">Todavía no tienes productos seleccionados. Explora el catálogo para elegir talla y color.</p>
          <Link className="mt-7 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-bold text-canvas" href="/catalog">Ver catálogo</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="shell py-12 sm:py-16" id="contenido">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-6">
        <div><p className="eyebrow">Tu selección</p><h1 className="mt-4 font-display text-6xl font-black uppercase leading-[0.88] tracking-[-0.06em]">Tu carrito</h1></div>
        <button className="rounded-full border border-ink px-4 py-2 text-sm font-bold" type="button" onClick={clearCart}>Vaciar carrito</button>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <ul className="grid gap-4" aria-label="Productos del carrito">
          {items.map((item) => (
            <li className="grid gap-5 rounded-2xl border border-line bg-cream p-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center" key={item.variantId}>
              {item.imageUrl ? <img alt={item.imageAlt ?? item.productName} className="aspect-square w-28 rounded-xl object-cover" src={item.imageUrl} /> : <div aria-label="Imagen no disponible" className="flex aspect-square w-28 items-center justify-center rounded-xl border border-dashed border-line text-center text-xs text-muted" role="img">Imagen no disponible</div>}
              <div className="grid gap-2">
                <div><h2 className="font-display text-2xl font-black uppercase leading-none">{item.productName}</h2>{item.brandName && <p className="mt-1 text-sm font-bold uppercase tracking-[0.12em] text-muted">{item.brandName}</p>}</div>
                <p className="text-sm text-muted">Talla {item.size} · Color: {item.color} · SKU: {item.sku}</p>
                <p className="text-sm font-bold"><Price value={item.displayPriceCop} /> cada uno</p>
              </div>
              <div className="grid justify-items-start gap-3 sm:justify-items-end">
                <label className="grid gap-1 text-sm font-bold" htmlFor={`quantity-${item.variantId}`}>Cantidad
                  <input aria-label={`Cantidad ${item.productName}`} className="w-24 rounded-lg border border-line bg-white px-3 py-2 font-normal" id={`quantity-${item.variantId}`} inputMode="numeric" max={99} min={1} type="number" value={item.quantity} onChange={(event) => setQuantity(item.variantId, Number(event.target.value))} />
                </label>
                <p className="text-sm font-bold">Subtotal: <Price value={item.displayPriceCop * item.quantity} /></p>
                <button className="text-sm font-bold underline underline-offset-4" type="button" onClick={() => removeItem(item.variantId)}>Quitar {item.productName}</button>
              </div>
            </li>
          ))}
        </ul>

        <aside className="grid gap-5 rounded-2xl border border-line bg-ink p-6 text-canvas" aria-label="Resumen del carrito">
          <div><p className="text-sm text-canvas/70">Subtotal informativo</p><p className="mt-2 text-3xl font-black"><Price value={subtotalCop} /></p></div>
          <p className="text-sm leading-6 text-canvas/75">La disponibilidad está sujeta a confirmación. Este subtotal es solo informativo; el backend/servidor mantiene la autoridad sobre precios, disponibilidad y creación del pedido.</p>
          <Link className="inline-flex justify-center rounded-full bg-acid px-5 py-3 text-sm font-bold text-ink" href="/checkout">Ir al checkout</Link>
        </aside>
      </div>
    </main>
  );
}
