"use client";

import { FormEvent, useEffect, useState } from "react";

import { presentStock } from "@/lib/catalog/domain";
import type { CommerceSettings, StockDisplayMode } from "@/types/catalog";

const modeLabels: Record<StockDisplayMode, string> = {
  detailed: "Detallado: muestra Disponible, Pocas unidades o Sin stock",
  availability_only: "Solo disponibilidad: muestra disponible o no disponible",
  hidden: "Oculto: no muestra información de existencias",
};

function responseError(response: Response, fallback: string): Promise<string> {
  return response.json()
    .then((body: unknown) => body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : fallback)
    .catch(() => fallback);
}

async function readJson(response: Response, fallback: string): Promise<unknown> {
  try { return await response.json(); } catch { throw new Error(fallback); }
}

function isSettings(value: unknown): value is CommerceSettings {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const threshold = item.inventoryLowThreshold;
  return typeof item.whatsappPhone === "string" && typeof item.nequiDetails === "string" && typeof item.dispatchOriginCity === "string" && typeof item.dispatchOriginAddress === "string" && typeof threshold === "number" && Number.isSafeInteger(threshold) && threshold >= 0 && (item.stockDisplayMode === "detailed" || item.stockDisplayMode === "availability_only" || item.stockDisplayMode === "hidden");
}

const fieldClass = "rounded-lg border border-line bg-white px-4 py-3";

export function SettingsAdmin() {
  const [settings, setSettings] = useState<CommerceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/settings")
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, "No fue posible cargar la configuración."));
        const body = await readJson(response, "No fue posible cargar la configuración.");
        if (!isSettings(body)) throw new Error("No fue posible cargar la configuración.");
        return body;
      })
      .then((value) => { if (active) setSettings(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error && reason.message !== "network" && reason.message !== "Failed to fetch" ? reason.message : "No fue posible cargar la configuración."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function validate(value: CommerceSettings): string {
    if (!value.whatsappPhone.trim()) return "El WhatsApp es obligatorio.";
    if (!value.nequiDetails.trim()) return "Los datos de Nequi son obligatorios.";
    if (!value.dispatchOriginCity.trim()) return "Indica la ciudad de despacho.";
    if (!value.dispatchOriginAddress.trim()) return "Indica la dirección de despacho.";
    if (!Number.isSafeInteger(value.inventoryLowThreshold) || value.inventoryLowThreshold < 0) return "El umbral debe ser un entero no negativo.";
    return "";
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setError("");
    setFeedback("");
    const formData = new FormData(event.currentTarget);
    const thresholdValue = String(formData.get("inventoryLowThreshold") ?? "");
    const candidate: CommerceSettings = { ...settings, whatsappPhone: String(formData.get("whatsappPhone") ?? ""), nequiDetails: String(formData.get("nequiDetails") ?? ""), dispatchOriginCity: String(formData.get("dispatchOriginCity") ?? ""), dispatchOriginAddress: String(formData.get("dispatchOriginAddress") ?? ""), inventoryLowThreshold: thresholdValue === "" ? Number.NaN : Number(thresholdValue), stockDisplayMode: String(formData.get("stockDisplayMode") ?? settings.stockDisplayMode) as StockDisplayMode };
    const validationError = validate(candidate);
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(candidate) });
      if (!response.ok) throw new Error(await responseError(response, "No fue posible guardar los cambios."));
      const body = await readJson(response, "No fue posible guardar los cambios.");
      if (!isSettings(body)) throw new Error("No fue posible guardar los cambios.");
      setSettings(body);
      setFeedback("Configuración guardada correctamente.");
    } catch (reason: unknown) {
      setError(reason instanceof Error && reason.message !== "network" && reason.message !== "Failed to fetch" ? reason.message : "No fue posible guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="rounded-lg border border-line bg-canvas p-5 text-sm" role="status">Cargando configuración…</p>;
  if (!settings) return <p className="rounded-lg border border-red-700/30 bg-red-50 p-3 text-sm text-red-800" role="alert">{error || "No fue posible cargar la configuración."}</p>;

  const previewThreshold = Number.isSafeInteger(settings.inventoryLowThreshold) && settings.inventoryLowThreshold >= 0 ? settings.inventoryLowThreshold : 0;
  const previewQuantity = Math.max(1, previewThreshold);
  const preview = presentStock(previewQuantity, previewThreshold, settings.stockDisplayMode);
  const previewLabel = preview.label ?? "La información de existencias está oculta";

  return (
    <div className="grid gap-8">
      <form className="grid gap-6 rounded-2xl border border-line bg-canvas p-5 sm:p-7" noValidate onSubmit={save}>
        <div><p className="eyebrow">Datos comerciales</p><h2 className="mt-2 font-display text-3xl font-black uppercase">Información operativa</h2><p className="mt-3 max-w-2xl text-sm text-muted">Estos datos se usan para coordinar pagos, despachos y la comunicación con tus clientes.</p></div>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold" htmlFor="settings-whatsapp">WhatsApp<input className={fieldClass} id="settings-whatsapp" name="whatsappPhone" value={settings.whatsappPhone} onChange={(event) => setSettings((current) => current ? { ...current, whatsappPhone: event.target.value } : current)} /></label>
          <label className="grid gap-2 text-sm font-bold" htmlFor="settings-nequi">Datos de Nequi<textarea className={fieldClass} id="settings-nequi" name="nequiDetails" rows={2} value={settings.nequiDetails} onChange={(event) => setSettings((current) => current ? { ...current, nequiDetails: event.target.value } : current)} /></label>
          <label className="grid gap-2 text-sm font-bold" htmlFor="settings-city">Ciudad de origen de despacho<input className={fieldClass} id="settings-city" name="dispatchOriginCity" value={settings.dispatchOriginCity} onChange={(event) => setSettings((current) => current ? { ...current, dispatchOriginCity: event.target.value } : current)} /></label>
          <label className="grid gap-2 text-sm font-bold" htmlFor="settings-address">Dirección de origen de despacho<input className={fieldClass} id="settings-address" name="dispatchOriginAddress" value={settings.dispatchOriginAddress} onChange={(event) => setSettings((current) => current ? { ...current, dispatchOriginAddress: event.target.value } : current)} /></label>
          <label className="grid gap-2 text-sm font-bold" htmlFor="settings-threshold">Umbral de pocas unidades<input aria-label="Umbral de pocas unidades" className={fieldClass} id="settings-threshold" min="0" name="inventoryLowThreshold" step="1" type="number" value={settings.inventoryLowThreshold} onChange={(event) => setSettings((current) => current ? { ...current, inventoryLowThreshold: event.target.value === "" ? Number.NaN : Number(event.target.value) } : current)} /><span className="font-normal text-muted">Un producto es de pocas unidades cuando tiene esta cantidad o menos.</span></label>
          <label className="grid gap-2 text-sm font-bold" htmlFor="settings-display-mode">Modo de visibilidad de existencias<select aria-label="Modo de visibilidad de existencias" className={fieldClass} id="settings-display-mode" name="stockDisplayMode" value={settings.stockDisplayMode} onChange={(event) => setSettings((current) => current ? { ...current, stockDisplayMode: event.target.value as StockDisplayMode } : current)}>{Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <p className="rounded-lg border border-line bg-cream p-4 text-sm" role="note">{`La entrega local aplica cuando la ciudad de destino coincide con ${settings.dispatchOriginCity || "la ciudad de origen"}. Las demás ciudades de Colombia se tratan como envíos nacionales.`}</p>
        <button className="w-full rounded-full bg-ink px-5 py-3 font-bold text-canvas sm:w-fit disabled:opacity-50" disabled={saving} type="submit">{saving ? "Guardando…" : "Guardar configuración"}</button>
      </form>

      <section className="grid gap-4 rounded-2xl border border-line bg-cream p-5 sm:p-7" aria-labelledby="preview-title">
        <div><p className="eyebrow">Vista previa pública</p><h2 className="mt-2 font-display text-3xl font-black uppercase" id="preview-title">Así verá existencias un cliente</h2><p className="mt-2 text-sm text-muted">La vista previa respeta el modo seleccionado. El inventario real siempre queda visible en el panel administrativo.</p></div>
        <div className="rounded-xl border border-line bg-canvas p-5 text-sm" data-testid={`stock-preview-${settings.stockDisplayMode}`}><p className="font-bold">Tenis de muestra</p><p className="mt-2">{previewLabel}</p></div>
      </section>

      {error && <p className="rounded-lg border border-red-700/30 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {feedback && <p className="rounded-lg border border-green-700/30 bg-green-50 p-3 text-sm text-green-800" role="status">{feedback}</p>}
    </div>
  );
}
