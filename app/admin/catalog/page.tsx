import type { Metadata } from "next";

import { CatalogAdmin } from "@/components/admin/catalog/catalog-admin";

export const metadata: Metadata = { title: "Catálogo administrativo" };

export default function CatalogPage() {
  return (
    <main className="shell py-12" id="contenido">
      <p className="eyebrow">Panel protegido / catálogo</p>
      <h1 className="mt-4 font-display text-6xl font-black uppercase tracking-tight">Catálogo</h1>
      <p className="mt-5 max-w-2xl text-muted">Administra marcas, productos, imágenes, variantes y publicación desde un solo lugar.</p>
      <div className="mt-10"><CatalogAdmin /></div>
    </main>
  );
}
