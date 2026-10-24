"use client";

import { useEffect, useState } from "react";

import type { OrderStatus } from "@/types/order";
import type { PublicTrackingResult } from "@/types/tracking";

const statusLabels: Record<OrderStatus, string> = {
  pending_confirmation: "Pendiente de confirmación", awaiting_payment: "Pendiente de pago", payment_confirmed: "Pago confirmado", preparing: "En preparación", shipped: "Enviado", delivered: "Entregado", canceled: "Cancelado",
};
function formatCop(value: number): string { return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)} COP`; }
function safeExternalTrackingUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const domain = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/iu;
    return url.protocol === "https:" && !url.username && !url.password && !url.port && domain.test(url.hostname) ? url.toString() : null;
  } catch { return null; }
}

export function OrderTracking({ token }: { token: string }) {
  const [result, setResult] = useState<PublicTrackingResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/tracking/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "not_found" : "unavailable");
        const value: unknown = await response.json();
        if (!value || typeof value !== "object" || !("number" in value) || !("status" in value)) throw new Error("unavailable");
        return value as PublicTrackingResult;
      })
      .then((value) => { if (active) setResult(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error && reason.message === "not_found" ? "No encontramos ese seguimiento. Revisa el enlace recibido." : "No fue posible consultar el seguimiento. Intenta de nuevo."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  if (loading) return <p className="rounded-xl border border-line bg-cream p-5" role="status">Consultando seguimiento…</p>;
  if (error || !result) return <p className="rounded-xl border border-red-700/30 bg-red-50 p-5 text-red-800" role="alert">{error || "No encontramos ese seguimiento."}</p>;
  const carrierUrl = safeExternalTrackingUrl(result.trackingUrl);

  return (
    <article className="grid gap-7 rounded-[2rem] border border-line bg-cream p-6 sm:p-10" aria-labelledby="tracking-order-title">
      <div><p className="eyebrow">Seguimiento seguro</p><h1 className="mt-3 font-display text-5xl font-black uppercase" id="tracking-order-title">{result.number}</h1><p className="mt-4 text-xl font-bold">{statusLabels[result.status]}</p><p className="mt-2 text-sm text-muted">Última actualización: {new Date(result.updatedAt).toLocaleString("es-CO")}</p></div>
      <dl className="grid gap-4 border-y border-line py-5 text-sm sm:grid-cols-3"><div><dt className="text-muted">Entrega</dt><dd className="font-bold">{result.deliveryType === "local" ? "Local" : "Nacional"}</dd></div><div><dt className="text-muted">Productos</dt><dd className="font-bold">{formatCop(result.productSubtotalCop)}</dd></div><div><dt className="text-muted">Envío</dt><dd className="font-bold">{result.shippingCostCop === null ? "Pendiente de cotización" : formatCop(result.shippingCostCop)}</dd></div></dl>
      <section aria-labelledby="tracking-items"><h2 className="font-display text-2xl font-black uppercase" id="tracking-items">Productos</h2><ul className="mt-3 grid gap-2 text-sm">{result.items.map((item) => <li key={item.sku}>{item.brandName} · {item.productName} · Talla {item.size} · {item.color} · {item.sku} × {item.quantity}</li>)}</ul></section>
      {(result.carrierName || result.trackingNumber) && <section aria-labelledby="tracking-shipment"><h2 className="font-display text-2xl font-black uppercase" id="tracking-shipment">Transportador</h2><p className="mt-3 text-sm">{result.carrierName ?? "Por confirmar"}{result.trackingNumber ? ` · Guía ${result.trackingNumber}` : ""}</p>{carrierUrl && <a className="mt-4 inline-flex rounded-full border border-ink px-5 py-3 text-sm font-bold" href={carrierUrl} rel="noreferrer" target="_blank">Seguir con {result.carrierName ?? "el transportador"}</a>}</section>}
      <section aria-labelledby="tracking-history"><h2 className="font-display text-2xl font-black uppercase" id="tracking-history">Historial</h2><ol className="mt-3 grid gap-3 text-sm">{result.history.map((entry, index) => <li className="border-l-2 border-line pl-4" key={`${entry.status}-${entry.createdAt}-${index}`}><strong>{statusLabels[entry.status]}</strong><br /><span className="text-muted">{new Date(entry.createdAt).toLocaleString("es-CO")}</span></li>)}</ol></section>
      <p className="text-sm text-muted">Este enlace muestra únicamente datos operativos del pedido. No publica documento, teléfono, correo ni dirección.</p>
    </article>
  );
}
