import type { Metadata } from "next";

import { ProductForm } from "@/components/admin/catalog/product-form";

export const metadata: Metadata = { title: "Nuevo producto" };

export default function NewProductPage() {
  return (
    <main className="shell max-w-5xl py-12" id="contenido">
      <p className="eyebrow">Panel protegido / catálogo</p>
      <h1 className="mt-4 font-display text-6xl font-black uppercase tracking-tight">Nuevo producto</h1>
      <p className="mt-5 max-w-2xl text-muted">Completa los datos del producto, carga una imagen accesible y agrega su inventario inicial.</p>
      <div className="mt-10"><ProductForm /></div>
    </main>
  );
}
