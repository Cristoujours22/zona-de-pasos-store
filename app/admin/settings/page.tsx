import type { Metadata } from "next";

import { SettingsAdmin } from "@/components/admin/settings/settings-admin";

export const metadata: Metadata = { title: "Configuración administrativa" };

export default function SettingsPage() {
  return (
    <main className="shell py-12" id="contenido">
      <p className="eyebrow">Panel protegido / configuración</p>
      <h1 className="mt-4 font-display text-6xl font-black uppercase tracking-tight">Configuración</h1>
      <p className="mt-5 max-w-2xl text-muted">Ajusta los datos de contacto, despacho y cómo se presenta la disponibilidad de inventario.</p>
      <div className="mt-10"><SettingsAdmin /></div>
    </main>
  );
}
