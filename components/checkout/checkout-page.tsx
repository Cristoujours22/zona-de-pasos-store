"use client";

/* eslint-disable react-hooks/set-state-in-effect -- the retry key is hydrated from tab-local storage after SSR. */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { useCart } from "@/components/cart/cart-provider";
import {
  CHECKOUT_FLOW_COPY,
  COLOMBIAN_DEPARTMENTS,
  EMPTY_CHECKOUT_FORM,
  buildCheckoutPayload,
  checkoutErrorMessage,
  forgetIdempotencyKey,
  formatCop,
  getCartIdentity,
  getOrCreateIdempotencyKey,
  parseCheckoutResponse,
  validateCheckoutForm,
} from "@/lib/checkout/domain";
import type { CheckoutField, CheckoutFormData, CheckoutSuccess } from "@/types/checkout";
import type { CartItem } from "@/types/cart";

export interface CheckoutFormProps {
  items: CartItem[];
  subtotalCop: number;
  clearCart: () => void;
  onSuccess: (result: CheckoutSuccess) => void;
}

interface CheckoutPageContentProps {
  navigateToWhatsapp?: (url: string) => void;
}

const defaultNavigateToWhatsapp = (url: string) => { window.location.assign(url); };

function errorForField(field: CheckoutField, errors: Partial<Record<CheckoutField, string>>): string | undefined {
  return errors[field];
}

export function CheckoutForm({ items, subtotalCop, clearCart, onSuccess }: CheckoutFormProps) {
  const [form, setForm] = useState<CheckoutFormData>(EMPTY_CHECKOUT_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CheckoutField, string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const submitLock = useRef(false);
  const cartIdentity = useMemo(() => getCartIdentity(items), [items]);

  useEffect(() => {
    setIdempotencyKey(getOrCreateIdempotencyKey(cartIdentity));
  }, [cartIdentity]);

  function updateField(field: CheckoutField, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError("");
  }

  function fieldProps(field: CheckoutField) {
    const error = errorForField(field, fieldErrors);
    return { "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${field}-error` : undefined };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || busy) return;
    const validation = validateCheckoutForm(form);
    setFieldErrors(validation.fieldErrors);
    if (!validation.valid) {
      const firstError = Object.values(validation.fieldErrors)[0];
      setSubmitError(firstError ?? "Revisa los datos del pedido.");
      return;
    }
    if (!idempotencyKey) {
      setSubmitError("No fue posible preparar el pedido. Intenta de nuevo.");
      return;
    }

    submitLock.current = true;
    setBusy(true);
    try {
      const payload = buildCheckoutPayload(form, items, idempotencyKey);
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setSubmitError(checkoutErrorMessage(response.status));
        return;
      }
      let body: unknown;
      try { body = await response.json(); } catch { setSubmitError("La respuesta del pedido no fue válida. Conserva tus datos e inténtalo nuevamente."); return; }
      const result = parseCheckoutResponse(body);
      if (!result) {
        setSubmitError("El enlace de WhatsApp recibido no es válido. Conserva tus datos e inténtalo nuevamente.");
        return;
      }
      clearCart();
      forgetIdempotencyKey(cartIdentity);
      onSuccess(result);
    } catch {
      setSubmitError("No fue posible conectar con el servicio. Conserva tus datos e intenta nuevamente.");
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  }

  const inputClass = "rounded-xl border border-line bg-white px-4 py-3 font-normal outline-none focus:border-ink";
  const errorText = (field: CheckoutField) => fieldErrors[field] ? <span className="text-sm font-normal text-red-800" id={`${field}-error`}>{fieldErrors[field]}</span> : null;

  return (
    <form aria-label="Checkout de pedido" className="grid gap-8" onSubmit={submit}>
      <section className="grid gap-4 rounded-2xl border border-line bg-cream p-5 sm:p-7" aria-labelledby="checkout-flow-title">
        <div><p className="eyebrow">Antes de enviar</p><h2 className="mt-3 font-display text-3xl font-black uppercase" id="checkout-flow-title">Así funciona el pedido</h2></div>
        <ul className="grid gap-3 text-sm leading-6 text-muted">
          <li>{CHECKOUT_FLOW_COPY.availability}</li>
          <li>{CHECKOUT_FLOW_COPY.products}</li>
          <li>{CHECKOUT_FLOW_COPY.shipping}</li>
          <li>{CHECKOUT_FLOW_COPY.proof}</li>
          <li>{CHECKOUT_FLOW_COPY.screenshot}</li>
        </ul>
      </section>

      <fieldset className="grid gap-5" disabled={busy}>
        <legend className="font-display text-3xl font-black uppercase">Datos del comprador</legend>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">Nombre completo<input {...fieldProps("fullName")} className={inputClass} value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} />{errorText("fullName")}</label>
          <label className="grid gap-2 text-sm font-bold">Número de documento colombiano<input {...fieldProps("colombianDocumentNumber")} className={inputClass} inputMode="numeric" value={form.colombianDocumentNumber} onChange={(event) => updateField("colombianDocumentNumber", event.target.value)} />{errorText("colombianDocumentNumber")}</label>
          <label className="grid gap-2 text-sm font-bold">Celular colombiano<input {...fieldProps("phone")} className={inputClass} inputMode="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />{errorText("phone")}</label>
          <label className="grid gap-2 text-sm font-bold">Correo electrónico <span className="font-normal text-muted">(opcional)</span><input {...fieldProps("email")} className={inputClass} type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />{errorText("email")}</label>
        </div>
      </fieldset>

      <fieldset className="grid gap-5" disabled={busy}>
        <legend className="font-display text-3xl font-black uppercase">Datos de entrega</legend>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">Departamento<select {...fieldProps("department")} className={inputClass} value={form.department} onChange={(event) => updateField("department", event.target.value)}><option value="">Selecciona un departamento</option>{COLOMBIAN_DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}</select>{errorText("department")}</label>
          <label className="grid gap-2 text-sm font-bold">Ciudad o municipio<input {...fieldProps("cityMunicipality")} className={inputClass} value={form.cityMunicipality} onChange={(event) => updateField("cityMunicipality", event.target.value)} />{errorText("cityMunicipality")}</label>
          <label className="grid gap-2 text-sm font-bold">Dirección<input {...fieldProps("address")} className={inputClass} value={form.address} onChange={(event) => updateField("address", event.target.value)} />{errorText("address")}</label>
          <label className="grid gap-2 text-sm font-bold">Barrio<input {...fieldProps("neighborhood")} className={inputClass} value={form.neighborhood} onChange={(event) => updateField("neighborhood", event.target.value)} />{errorText("neighborhood")}</label>
        </div>
        <label className="grid gap-2 text-sm font-bold">Instrucciones de entrega <span className="font-normal text-muted">(opcional)</span><textarea {...fieldProps("deliveryInstructions")} className={inputClass} rows={3} value={form.deliveryInstructions} onChange={(event) => updateField("deliveryInstructions", event.target.value)} />{errorText("deliveryInstructions")}</label>
      </fieldset>

      <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 text-sm leading-6" htmlFor="checkout-consent">
        <input {...fieldProps("consent")} checked={form.consent} className="mt-1 size-4 shrink-0" id="checkout-consent" type="checkbox" onChange={(event) => updateField("consent", event.target.checked)} />
        <span>Acepto que Zona de pasos store use estos datos únicamente para procesar y entregar mi pedido.{errorText("consent")}</span>
      </label>

      {submitError && <p className="rounded-xl border border-red-700/30 bg-red-50 p-4 text-sm text-red-800" role="alert">{submitError}</p>}
      <div className="flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Subtotal informativo: <strong className="text-ink">${formatCop(subtotalCop)} COP</strong>. El servidor confirma el precio y la disponibilidad.</p>
        <button className="rounded-full bg-ink px-6 py-3 font-bold text-canvas disabled:opacity-50" disabled={busy || !idempotencyKey} type="submit">{busy ? "Enviando…" : "Enviar pedido"}</button>
      </div>
    </form>
  );
}

function SuccessSummary({ result, navigateToWhatsapp }: { result: CheckoutSuccess; navigateToWhatsapp: (url: string) => void }) {
  return (
    <main className="shell py-12 sm:py-16" id="contenido">
      <section className="mx-auto grid max-w-2xl gap-6 rounded-[2rem] border border-line bg-cream p-7 sm:p-12" aria-labelledby="checkout-success-title">
        <p className="eyebrow">Pedido recibido</p>
        <h1 className="font-display text-5xl font-black uppercase leading-none" id="checkout-success-title">Pedido recibido</h1>
        <p className="leading-6 text-muted">Tu pedido quedó registrado para confirmación humana por WhatsApp. La disponibilidad y el costo del envío se confirman por ese medio.</p>
        <dl className="grid gap-3 border-y border-line py-5 text-sm sm:grid-cols-3">
          <div><dt className="text-muted">Número</dt><dd className="mt-1 font-bold">{result.orderNumber}</dd></div>
          <div><dt className="text-muted">Subtotal de productos</dt><dd className="mt-1 font-bold">${formatCop(result.subtotalCop)} COP</dd></div>
          <div><dt className="text-muted">Entrega</dt><dd className="mt-1 font-bold">{result.deliveryType === "local" ? "Entrega local" : "Envío nacional"}</dd></div>
        </dl>
        <p className="text-sm leading-6 text-muted">Presiona el botón para abrir WhatsApp y enviar el pedido itemizado. No se abrirá automáticamente.</p>
        <button className="justify-self-start rounded-full bg-ink px-6 py-3 font-bold text-canvas" type="button" onClick={() => navigateToWhatsapp(result.whatsappUrl)}>Abrir WhatsApp para enviar el pedido</button>
        <Link className="justify-self-start text-sm font-bold underline underline-offset-4" href="/catalog">Volver al catálogo</Link>
      </section>
    </main>
  );
}

export function CheckoutPageContent({ navigateToWhatsapp = defaultNavigateToWhatsapp }: CheckoutPageContentProps) {
  const { items, subtotalCop, hydrated, clearCart } = useCart();
  const [success, setSuccess] = useState<CheckoutSuccess | null>(null);

  if (success) return <SuccessSummary navigateToWhatsapp={navigateToWhatsapp} result={success} />;
  if (!hydrated) return <main className="shell py-16" id="contenido"><p role="status">Cargando checkout…</p></main>;
  if (items.length === 0) {
    return (
      <main className="shell py-16" id="contenido">
        <section className="rounded-[2rem] border border-dashed border-line bg-cream p-8 sm:p-12" role="status">
          <p className="eyebrow">Checkout</p>
          <h1 className="mt-4 font-display text-5xl font-black uppercase leading-none">Tu carrito está vacío</h1>
          <p className="mt-5 max-w-lg leading-6 text-muted">Agrega productos al carrito antes de enviar un pedido. No se ha enviado ninguna solicitud.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Link className="inline-flex rounded-full bg-ink px-5 py-3 text-sm font-bold text-canvas" href="/catalog">Ver catálogo</Link><Link className="inline-flex rounded-full border border-ink px-5 py-3 text-sm font-bold" href="/cart">Volver al carrito</Link></div>
        </section>
      </main>
    );
  }
  return <main className="shell py-10 sm:py-16" id="contenido"><div className="mb-10 border-b border-line pb-6"><p className="eyebrow">Compra como invitado</p><h1 className="mt-4 font-display text-6xl font-black uppercase leading-[0.88] tracking-[-0.06em]">Checkout</h1><p className="mt-5 max-w-2xl leading-6 text-muted">Completa tus datos para que podamos confirmar disponibilidad, precio de envío y los siguientes pasos por WhatsApp.</p></div><CheckoutForm items={items} subtotalCop={subtotalCop} clearCart={clearCart} onSuccess={setSuccess} /></main>;
}

/* eslint-enable react-hooks/set-state-in-effect */
