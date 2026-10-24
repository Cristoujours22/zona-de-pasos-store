import type { Metadata } from "next";

import { InventoryAdmin } from "@/components/admin/inventory/inventory-admin";

export const metadata: Metadata = { title: "Inventario administrativo" };

export default function InventoryPage() {
  return (
    <main className="shell py-12" id="contenido">
      <p className="eyebrow">Panel protegido / inventario</p>
      <h1 className="mt-4 font-display text-6xl font-black uppercase tracking-tight">Inventario</h1>
      <p className="mt-5 max-w-2xl text-muted">Consulta las variantes activas y registra manualmente los movimientos confirmados por el equipo.</p>
      <div className="mt-10"><InventoryAdmin /></div>
    </main>
  );
}
