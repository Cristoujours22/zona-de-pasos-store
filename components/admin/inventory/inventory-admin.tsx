"use client";

import { FormEvent, useEffect, useState } from "react";

import { getStockStatus } from "@/lib/catalog/domain";
import type { AdminProductSummary, ProductVariant, StockStatus } from "@/types/catalog";

type InventoryRow = { productId: string; productName: string; brandName: string; variant: ProductVariant };

const statusClass: Record<StockStatus, string> = { full: "text-ink", low: "text-orange-700", out_of_stock: "text-red-700" };
const statusLabel: Record<StockStatus, string> = { full: "Disponible", low: "Pocas unidades", out_of_stock: "Sin stock" };
const fieldClass = "rounded-lg border border-line bg-white px-4 py-3";

async function responseError(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    return body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

async function readJson(response: Response, fallback: string): Promise<unknown> {
  try { return await response.json(); } catch { throw new Error(fallback); }
}

function quantityLabel(quantity: number): string {
  return `${quantity} ${quantity === 1 ? "unidad" : "unidades"}`;
}

export function InventoryAdmin() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [threshold, setThreshold] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [orderReference, setOrderReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/admin/products").then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, "No fue posible cargar el inventario."));
        const body = await readJson(response, "No fue posible cargar el inventario.");
        if (!Array.isArray(body)) throw new Error("No fue posible cargar el inventario.");
        return body as AdminProductSummary[];
      }),
      fetch("/api/admin/settings").then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, "No fue posible cargar el inventario."));
        const body = await readJson(response, "No fue posible cargar el inventario.");
        const value = body && typeof body === "object" ? (body as { inventoryLowThreshold?: unknown }).inventoryLowThreshold : undefined;
        if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("No fue posible cargar el inventario.");
        return value;
      }),
    ])
      .then(([products, configuredThreshold]) => {
        if (!active) return;
        setThreshold(configuredThreshold);
        setRows(products.flatMap((product) => product.variants.filter((variant) => variant.active).map((variant) => ({ productId: product.id, productName: product.name, brandName: product.brand.name, variant }))));
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error && reason.message !== "network" && reason.message !== "Failed to fetch" ? reason.message : "No fue posible cargar el inventario."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function selectVariant(variantId: string) {
    setSelectedId(variantId);
    setDelta("");
    setReason("");
    setOrderReference("");
    setError("");
    setFeedback("");
  }

  function validateAdjustment(): { value: number } | { error: string } {
    const normalizedDelta = delta.trim();
    if (!/^[+-]?\d+$/u.test(normalizedDelta)) return { error: "El ajuste debe ser un entero distinto de cero." };
    const value = Number(normalizedDelta);
    if (!Number.isSafeInteger(value) || value === 0) return { error: "El ajuste debe ser un entero distinto de cero." };
    if (!reason.trim()) return { error: "Indica el motivo del ajuste." };
    return { value };
  }

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFeedback("");
    const validation = validateAdjustment();
    if ("error" in validation) { setError(validation.error); return; }
    const selected = rows.find((row) => row.variant.id === selectedId);
    if (!selected) { setError("Selecciona una variante para ajustar."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/inventory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ variantId: selected.variant.id, delta: validation.value, reason: reason.trim(), orderReference: orderReference.trim() || null }) });
      if (!response.ok) throw new Error(await responseError(response, "No fue posible ajustar el inventario."));
      const body = await readJson(response, "No fue posible ajustar el inventario.");
      const stockValue = body && typeof body === "object" ? (body as { stockQuantity?: unknown }).stockQuantity : undefined;
      if (typeof stockValue !== "number" || !Number.isSafeInteger(stockValue) || stockValue < 0) throw new Error("No fue posible ajustar el inventario.");
      const stockQuantity = stockValue;
      setRows((current) => current.map((row) => row.variant.id === selected.variant.id ? { ...row, variant: { ...row.variant, stockQuantity } } : row));
      setDelta("");
      setReason("");
      setOrderReference("");
      setFeedback("Inventario actualizado correctamente.");
    } catch (reasonError: unknown) {
      setError(reasonError instanceof Error && reasonError.message !== "network" && reasonError.message !== "Failed to fetch" ? reasonError.message : "No fue posible ajustar el inventario.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="rounded-lg border border-line bg-canvas p-5 text-sm" role="status">Cargando inventario…</p>;
  if (error && rows.length === 0) return <p className="rounded-lg border border-red-700/30 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>;

  return (
    <div className="grid gap-8">
      <section className="grid gap-4" aria-labelledby="inventory-title">
        <div><p className="eyebrow">Existencias activas</p><h2 className="mt-2 font-display text-3xl font-black uppercase" id="inventory-title">Variantes disponibles para operar</h2><p className="mt-2 text-sm text-muted">El panel muestra cantidades reales aunque la tienda pública oculte sus etiquetas.</p></div>
        {rows.length === 0 ? <p className="rounded-lg border border-line bg-canvas p-5 text-sm text-muted">No hay variantes activas para mostrar.</p> : <div className="grid gap-4">{rows.map(({ productName, brandName, variant }) => {
          const status = getStockStatus(variant.stockQuantity, threshold);
          return <article className="grid gap-4 rounded-2xl border border-line bg-canvas p-5 md:grid-cols-[1fr_auto] md:items-center" key={variant.id}>
            <div className="min-w-0"><p className="text-sm text-muted">{brandName} · {productName}</p><h3 className="mt-1 font-display text-2xl font-black uppercase">{variant.sku}</h3><dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div><dt className="text-muted">Talla</dt><dd>{variant.size}</dd></div><div><dt className="text-muted">Color</dt><dd>{variant.color}</dd></div><div><dt className="text-muted">Cantidad</dt><dd>{quantityLabel(variant.stockQuantity)}</dd></div><div><dt className="text-muted">Estado</dt><dd className={`font-bold ${statusClass[status]}`} data-testid={`inventory-status-${variant.id}`}>{statusLabel[status]}</dd></div></dl><p className={`mt-3 text-sm font-bold ${statusClass[status]}`}>{`${quantityLabel(variant.stockQuantity)} · ${statusLabel[status]}`}</p></div>
            <button className="rounded-full border border-ink px-4 py-2 text-sm font-bold" type="button" onClick={() => selectVariant(variant.id)}>{selectedId === variant.id ? "Variante seleccionada" : `Ajustar ${variant.sku}`}</button>
          </article>;
        })}</div>}
      </section>

      {selectedId && <form className="grid gap-5 rounded-2xl border border-line bg-cream p-5 sm:p-7" onSubmit={adjust} aria-labelledby="adjust-title">
        <div><p className="eyebrow">Ajuste manual</p><h2 className="mt-2 font-display text-3xl font-black uppercase" id="adjust-title">Registrar movimiento</h2><p className="mt-2 text-sm text-muted">Usa un número positivo para sumar o uno negativo para descontar. El servidor impide que el inventario quede negativo.</p></div>
        <div className="grid gap-5 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold" htmlFor="inventory-delta">Delta de inventario<input className={fieldClass} id="inventory-delta" inputMode="numeric" placeholder="Ej. +1 o -1" value={delta} onChange={(event) => setDelta(event.target.value)} /></label>
          <label className="grid gap-2 text-sm font-bold" htmlFor="inventory-reason">Motivo del ajuste<input className={fieldClass} id="inventory-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <label className="grid gap-2 text-sm font-bold" htmlFor="inventory-order-reference">Referencia de orden (opcional)<input className={fieldClass} id="inventory-order-reference" value={orderReference} onChange={(event) => setOrderReference(event.target.value)} /></label>
        </div>
        <button className="w-full rounded-full bg-ink px-5 py-3 font-bold text-canvas sm:w-fit disabled:opacity-50" disabled={busy} type="submit">{busy ? "Guardando…" : "Confirmar ajuste"}</button>
      </form>}

      {error && <p className="rounded-lg border border-red-700/30 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {feedback && <p className="rounded-lg border border-green-700/30 bg-green-50 p-3 text-sm text-green-800" role="status">{feedback}</p>}
    </div>
  );
}
