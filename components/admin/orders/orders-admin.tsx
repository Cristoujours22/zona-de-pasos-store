"use client";

import { FormEvent, useEffect, useState } from "react";

import type { AdminOrderDetail, AdminOrderSummary, CommerceCarrier } from "@/types/order-admin";
import type { OrderStatus } from "@/types/order";

const fieldClass = "rounded-lg border border-line bg-white px-4 py-3";
const statusLabels: Record<OrderStatus, string> = {
  pending_confirmation: "Pendiente de confirmación", awaiting_payment: "Pendiente de pago", payment_confirmed: "Pago confirmado", preparing: "En preparación", shipped: "Enviado", delivered: "Entregado", canceled: "Cancelado",
};

function formatCop(value: number): string { return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)} COP`; }
async function body(response: Response): Promise<unknown> { try { return await response.json(); } catch { throw new Error("La respuesta del servidor no es válida."); } }
async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try { response = await fetch(url, init); } catch { throw new Error("No fue posible conectar con el servicio."); }
  const value = await body(response);
  if (!response.ok) {
    const message = value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : "No fue posible completar la operación.";
    throw new Error(message);
  }
  return value;
}

function asOrders(value: unknown): AdminOrderSummary[] { if (!Array.isArray(value)) throw new Error("No fue posible cargar los pedidos."); return value as AdminOrderSummary[]; }
function asCarriers(value: unknown): CommerceCarrier[] { if (!Array.isArray(value)) throw new Error("No fue posible cargar los transportadores."); return value as CommerceCarrier[]; }
function asDetail(value: unknown): AdminOrderDetail { if (!value || typeof value !== "object" || !("id" in value)) throw new Error("No fue posible cargar el pedido."); return value as AdminOrderDetail; }

export function OrdersAdmin() {
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [carriers, setCarriers] = useState<CommerceCarrier[]>([]);
  const [selected, setSelected] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [deliveryType, setDeliveryType] = useState<"local" | "national">("national");
  const [carrierId, setCarrierId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [carrierTemplate, setCarrierTemplate] = useState("");
  const [carrierPosition, setCarrierPosition] = useState("0");

  useEffect(() => {
    let active = true;
    Promise.all([requestJson("/api/admin/orders"), requestJson("/api/admin/carriers")])
      .then(([orderRows, carrierRows]) => { if (active) { setOrders(asOrders(orderRows)); setCarriers(asCarriers(carrierRows)); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No fue posible cargar operaciones."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function syncOrder(next: AdminOrderDetail) {
    setSelected(next);
    setOrders((current) => current.map((item) => item.id === next.id ? next : item));
    setPaymentAmount(String(next.productSubtotalCop));
    setShippingCost(next.shippingCostCop === null ? "" : String(next.shippingCostCop));
    setDeliveryType(next.deliveryType);
    setCarrierId(next.carrierId ?? carriers.find((item) => item.active)?.id ?? "");
    setTrackingNumber(next.trackingNumber ?? "");
  }

  async function openOrder(id: string) {
    setError(""); setFeedback(""); setBusy(true);
    try { syncOrder(asDetail(await requestJson(`/api/admin/orders/${id}`))); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "No fue posible cargar el pedido."); }
    finally { setBusy(false); }
  }

  async function mutate(path: string, payload: unknown, success: string) {
    if (!selected) return;
    setError(""); setFeedback(""); setBusy(true);
    try {
      const next = asDetail(await requestJson(`/api/admin/orders/${selected.id}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }));
      syncOrder(next); setFeedback(success);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "No fue posible actualizar el pedido."); }
    finally { setBusy(false); }
  }

  function transition(toStatus: "awaiting_payment" | "preparing" | "shipped" | "delivered") {
    void mutate("transition", { expectedUpdatedAt: selected?.updatedAt, toStatus, note: null }, `Estado actualizado: ${statusLabels[toStatus]}.`);
  }

  function confirmPayment(event: FormEvent) {
    event.preventDefault();
    const amount = Number(paymentAmount);
    if (!Number.isSafeInteger(amount) || amount < 0) { setError("El valor confirmado no es válido."); return; }
    void mutate("payment", { expectedUpdatedAt: selected?.updatedAt, confirmedAmountCop: amount, internalNote: paymentNote.trim() || null }, "Pago confirmado mediante verificación humana.");
  }

  function saveShipping(event: FormEvent) {
    event.preventDefault();
    const cost = Number(shippingCost);
    if (!Number.isSafeInteger(cost) || cost < 0 || !carrierId || !trackingNumber.trim()) { setError("Completa el costo, transportador y número de guía."); return; }
    void mutate("shipping", { expectedUpdatedAt: selected?.updatedAt, shippingCostCop: cost, deliveryType, carrierId, trackingNumber: trackingNumber.trim() }, "Envío actualizado correctamente.");
  }

  function cancel(event: FormEvent) {
    event.preventDefault();
    if (!cancelReason.trim()) { setError("Indica el motivo de cancelación."); return; }
    void mutate("cancel", { expectedUpdatedAt: selected?.updatedAt, reason: cancelReason.trim() }, "Pedido cancelado. El inventario no fue modificado automáticamente.");
  }

  async function saveCarrier(event: FormEvent) {
    event.preventDefault();
    const position = Number(carrierPosition);
    if (!carrierName.trim() || !Number.isSafeInteger(position) || position < 0) { setError("Completa los datos del transportador."); return; }
    setBusy(true); setError(""); setFeedback("");
    try {
      const saved = await requestJson("/api/admin/carriers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: carrierName.trim(), trackingUrlTemplate: carrierTemplate.trim() || null, active: true, position }) }) as CommerceCarrier;
      setCarriers((current) => [...current.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)));
      setCarrierName(""); setCarrierTemplate(""); setCarrierPosition("0"); setFeedback("Transportador guardado correctamente.");
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "No fue posible guardar el transportador."); }
    finally { setBusy(false); }
  }

  if (loading) return <p role="status">Cargando operaciones…</p>;
  return (
    <div className="grid gap-10">
      {error && <p className="rounded-lg border border-red-700/30 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {feedback && <p className="rounded-lg border border-green-700/30 bg-green-50 p-3 text-sm text-green-800" role="status">{feedback}</p>}

      <section className="grid gap-4" aria-labelledby="order-queue-title">
        <div><p className="eyebrow">Cola operativa</p><h2 className="mt-2 font-display text-3xl font-black uppercase" id="order-queue-title">Pedidos</h2></div>
        {orders.length === 0 ? <p className="rounded-xl border border-line bg-canvas p-5 text-muted">No hay pedidos registrados.</p> : orders.map((order) => <article className="grid gap-3 rounded-2xl border border-line bg-canvas p-5 md:grid-cols-[1fr_auto] md:items-center" key={order.id}>
          <div><p className="text-sm text-muted">{order.buyerFullName} · {order.cityMunicipality}</p><h3 className="font-display text-2xl font-black uppercase">{order.number}</h3><p className="mt-2 text-sm"><strong>{statusLabels[order.status]}</strong> · {formatCop(order.productSubtotalCop)}</p></div>
          <button className="rounded-full border border-ink px-4 py-2 text-sm font-bold" disabled={busy} type="button" onClick={() => openOrder(order.id)}>Gestionar {order.number}</button>
        </article>)}
      </section>

      {selected && <section className="grid gap-7 rounded-2xl border border-line bg-cream p-5 sm:p-7" aria-labelledby="order-detail-title">
        <div><p className="eyebrow">Pedido protegido</p><h2 className="mt-2 font-display text-3xl font-black uppercase" id="order-detail-title">{selected.number}</h2><p className="mt-2 font-bold">{statusLabels[selected.status]}</p></div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted">Documento</dt><dd>{selected.colombianDocumentNumber}</dd></div><div><dt className="text-muted">Teléfono</dt><dd>{selected.phone}</dd></div><div><dt className="text-muted">Correo</dt><dd>{selected.email ?? "No indicado"}</dd></div><div><dt className="text-muted">Entrega</dt><dd>{selected.deliveryType === "local" ? "Local" : "Nacional"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted">Dirección</dt><dd>{selected.address}, {selected.neighborhood}, {selected.cityMunicipality}, {selected.department}</dd></div>
        </dl>
        <ul className="grid gap-2 text-sm">{selected.items.map((item) => <li key={item.sku}>{item.brandName} · {item.productName} · {item.size} · {item.color} · {item.sku} × {item.quantity}</li>)}</ul>

        <div className="flex flex-wrap gap-3">
          {selected.status === "pending_confirmation" && <button className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-canvas" disabled={busy} type="button" onClick={() => transition("awaiting_payment")}>Confirmar disponibilidad</button>}
          {selected.status === "payment_confirmed" && <button className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-canvas" disabled={busy} type="button" onClick={() => transition("preparing")}>Iniciar preparación</button>}
          {selected.status === "preparing" && <button className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-canvas" disabled={busy} type="button" onClick={() => transition("shipped")}>Marcar enviado</button>}
          {selected.status === "shipped" && <button className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-canvas" disabled={busy} type="button" onClick={() => transition("delivered")}>Marcar entregado</button>}
        </div>

        {selected.status === "awaiting_payment" && <form className="grid gap-4 border-t border-line pt-5" onSubmit={confirmPayment}><h3 className="font-display text-2xl font-black uppercase">Verificación humana de Nequi</h3><p className="text-sm text-muted">Revisa el comprobante recibido únicamente por WhatsApp. Una captura no confirma el pago automáticamente.</p><label className="grid gap-2 text-sm font-bold">Valor confirmado en Nequi<input className={fieldClass} inputMode="numeric" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label><label className="grid gap-2 text-sm font-bold">Nota interna del pago (opcional)<textarea className={fieldClass} value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} /></label><button className="w-fit rounded-full bg-ink px-5 py-3 font-bold text-canvas" disabled={busy} type="submit">Confirmar pago verificado</button></form>}

        {!(["shipped", "delivered", "canceled"] as OrderStatus[]).includes(selected.status) && <form className="grid gap-4 border-t border-line pt-5" onSubmit={saveShipping}><h3 className="font-display text-2xl font-black uppercase">Envío y guía</h3><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-bold">Costo de envío COP<input className={fieldClass} inputMode="numeric" value={shippingCost} onChange={(event) => setShippingCost(event.target.value)} /></label><label className="grid gap-2 text-sm font-bold">Tipo de entrega<select className={fieldClass} value={deliveryType} onChange={(event) => setDeliveryType(event.target.value as "local" | "national")}><option value="local">Local</option><option value="national">Nacional</option></select></label><label className="grid gap-2 text-sm font-bold">Transportador<select className={fieldClass} value={carrierId} onChange={(event) => setCarrierId(event.target.value)}><option value="">Selecciona</option>{carriers.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="grid gap-2 text-sm font-bold">Número de guía<input className={fieldClass} value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} /></label></div><button className="w-fit rounded-full border border-ink px-5 py-3 font-bold" disabled={busy} type="submit">Guardar envío</button></form>}

        {!(["shipped", "delivered", "canceled"] as OrderStatus[]).includes(selected.status) && <form className="grid gap-4 border-t border-line pt-5" onSubmit={cancel}><h3 className="font-display text-2xl font-black uppercase">Cancelar pedido</h3><p className="text-sm text-muted">La cancelación no repone inventario automáticamente; cualquier ajuste sigue siendo manual y auditado.</p><label className="grid gap-2 text-sm font-bold">Motivo de cancelación<textarea className={fieldClass} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></label><button className="w-fit rounded-full border border-red-800 px-5 py-3 font-bold text-red-800" disabled={busy} type="submit">Cancelar pedido</button></form>}

        <div className="border-t border-line pt-5"><h3 className="font-display text-2xl font-black uppercase">Historial</h3><ol className="mt-3 grid gap-2 text-sm">{selected.history.map((entry) => <li key={entry.id}>{statusLabels[entry.toStatus]} · {new Date(entry.createdAt).toLocaleString("es-CO")}{entry.note ? ` · ${entry.note}` : ""}</li>)}</ol></div>
      </section>}

      <section className="grid gap-5 rounded-2xl border border-line bg-canvas p-5 sm:p-7" aria-labelledby="carrier-title"><div><p className="eyebrow">Configuración operativa</p><h2 className="mt-2 font-display text-3xl font-black uppercase" id="carrier-title">Transportadores</h2></div><ul className="grid gap-2 text-sm">{carriers.map((item) => <li key={item.id}>{item.name} · {item.active ? "Activo" : "Inactivo"}</li>)}</ul><form className="grid gap-4 md:grid-cols-3" onSubmit={saveCarrier}><label className="grid gap-2 text-sm font-bold">Nombre del transportador<input className={fieldClass} value={carrierName} onChange={(event) => setCarrierName(event.target.value)} /></label><label className="grid gap-2 text-sm font-bold">Plantilla HTTPS de seguimiento<input className={fieldClass} placeholder="https://dominio.co/?guia={trackingNumber}" value={carrierTemplate} onChange={(event) => setCarrierTemplate(event.target.value)} /></label><label className="grid gap-2 text-sm font-bold">Posición<input className={fieldClass} inputMode="numeric" value={carrierPosition} onChange={(event) => setCarrierPosition(event.target.value)} /></label><button className="w-fit rounded-full bg-ink px-5 py-3 font-bold text-canvas" disabled={busy} type="submit">Agregar transportador</button></form></section>
    </div>
  );
}
