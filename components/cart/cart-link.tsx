"use client";

import Link from "next/link";

import { useCart } from "@/components/cart/cart-provider";

export function CartLink() {
  const { itemCount } = useCart();
  return (
    <Link aria-label={`Carrito, ${itemCount} ${itemCount === 1 ? "producto" : "productos"}`} className="inline-flex items-center gap-2 rounded-full border border-ink px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.13em] transition-colors hover:bg-ink hover:text-canvas" href="/cart">
      Carrito <span aria-live="polite">({itemCount})</span>
    </Link>
  );
}
