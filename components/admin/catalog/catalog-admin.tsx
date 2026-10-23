"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useState } from "react";

import type { AdminProductSummary, Brand, ProductLifecycle } from "@/types/catalog";
import { audienceLabel, formatCop, getAggregateStockState, lifecycleLabel } from "@/lib/catalog/presentation";

type ProductPatch = { lifecycle?: ProductLifecycle; featured?: boolean };

async function responseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

const stockClass: Record<ReturnType<typeof getAggregateStockState>["status"], string> = {
  full: "text-ink",
  low: "text-orange-700",
  out_of_stock: "text-red-700",
};

export function CatalogAdmin() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<AdminProductSummary[]>([]);
  const [brandName, setBrandName] = useState("");
  const [loading, setLoading] = useState(true);
  const [brandBusy, setBrandBusy] = useState(false);
  const [updating, setUpdating] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/admin/brands").then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No fue posible cargar las marcas.")); return response.json() as Promise<Brand[]>; }),
      fetch("/api/admin/products").then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No fue posible cargar los productos.")); return response.json() as Promise<AdminProductSummary[]>; }),
    ])
      .then(([brandItems, productItems]) => { if (active) { setBrands(brandItems); setProducts(productItems); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error && reason.message !== "network" ? reason.message : "No fue posible cargar el catálogo."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function createBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFeedback("");
    if (!brandName.trim()) { setError("Indica el nombre de la marca."); return; }
    setBrandBusy(true);
    try {
      const response = await fetch("/api/admin/brands", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: brandName.trim() }) });
      if (!response.ok) throw new Error(await responseError(response, "No fue posible crear la marca."));
      const brand = await response.json() as Brand;
      setBrands((current) => [...current, brand].sort((left, right) => left.name.localeCompare(right.name)));
      setBrandName("");
      setFeedback("Marca creada correctamente.");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "No fue posible crear la marca.");
    } finally {
      setBrandBusy(false);
    }
  }

  async function updateProduct(product: AdminProductSummary, patch: ProductPatch) {
    setError("");
    setFeedback("");
    setUpdating(`${product.id}-${Object.keys(patch)[0]}`);
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      if (!response.ok) throw new Error(await responseError(response, "No fue posible actualizar el producto."));
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, ...patch } : item));
      setFeedback("Producto actualizado correctamente.");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "No fue posible actualizar el producto.");
    } finally {
      setUpdating("");
    }
  }

  if (loading) return <p className="rounded-lg border border-line bg-canvas p-5 text-sm" role="status">Cargando catálogo…</p>;

  return (
    <div className="grid gap-10">
      <section className="grid gap-5 rounded-2xl border border-line bg-canvas p-5" aria-labelledby="brands-title">
        <div><p className="eyebrow">Marcas</p><h2 className="mt-2 font-display text-3xl font-black uppercase" id="brands-title">Construye la selección</h2></div>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={createBrand}>
          <label className="sr-only" htmlFor="new-brand">Nueva marca</label>
          <input className="min-w-0 flex-1 rounded-lg border border-line bg-white px-4 py-3" id="new-brand" name="brand" placeholder="Ej. Nike" value={brandName} onChange={(event) => setBrandName(event.target.value)} />
          <button className="rounded-full bg-ink px-5 py-3 font-bold text-canvas disabled:opacity-50" disabled={brandBusy} type="submit">{brandBusy ? "Creando…" : "Crear marca"}</button>
        </form>
        <ul className="flex flex-wrap gap-2" aria-label="Marcas registradas">{brands.map((brand) => <li className="rounded-full border border-line px-3 py-1 text-sm" key={brand.id}>{brand.name}</li>)}</ul>
      </section>

      <section aria-labelledby="products-title">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Productos</p><h2 className="mt-2 font-display text-4xl font-black uppercase" id="products-title">Catálogo activo</h2></div><a className="rounded-full bg-ink px-5 py-3 text-center text-sm font-bold text-canvas" href="/admin/catalog/new">Nuevo producto</a></div>
        {products.length === 0 ? <p className="mt-6 rounded-lg border border-line bg-canvas p-5 text-sm text-muted">Aún no hay productos en el catálogo.</p> : <div className="mt-6 grid gap-4 lg:grid-cols-2">{products.map((product) => {
          const stock = getAggregateStockState(product.variants);
          const publicationKey = `${product.id}-lifecycle`;
          const featuredKey = `${product.id}-featured`;
          return <article aria-labelledby={`product-${product.id}`} className="grid gap-5 rounded-2xl border border-line bg-cream p-5" key={product.id}>
            <div className="grid gap-5 sm:grid-cols-[7rem_1fr]">
              {product.image ? <><img alt={product.image.altText} className="aspect-square w-full rounded-xl border border-line object-cover" loading="lazy" src={product.image.secureUrl} /></> : <div aria-label="Sin imagen" className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-line text-center text-xs text-muted">Sin imagen</div>}
              <div className="min-w-0"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm text-muted">{product.brand.name}</p><h3 className="font-display text-2xl font-black uppercase" id={`product-${product.id}`}>{product.name}</h3></div>{product.featured && <span className="rounded-full bg-acid px-3 py-1 text-xs font-bold">Destacado</span>}</div><p className="mt-3 text-xl font-bold">{formatCop(product.priceCop)}</p><dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-muted">Audiencia</dt><dd>{audienceLabel(product.audience)}</dd></div><div><dt className="text-muted">Ciclo</dt><dd>{lifecycleLabel(product.lifecycle)}</dd></div></dl><p className={`mt-3 text-sm font-bold ${stockClass[stock.status]}`} data-stock-status={stock.status} data-testid={`stock-${product.id}`}><strong>{stock.quantity} unidades</strong> · {stock.label}</p></div>
            </div>
            <div className="border-t border-line pt-4"><h4 className="text-sm font-bold">Variantes</h4><ul className="mt-2 grid gap-1 text-sm text-muted">{product.variants.map((variant) => <li key={variant.id}>{variant.size} · {variant.color} · {variant.sku} · {variant.stockQuantity} unidades</li>)}</ul></div>
            <div className="flex flex-wrap gap-2"><button className="rounded-full border border-ink px-4 py-2 text-sm font-bold disabled:opacity-50" disabled={updating === publicationKey} type="button" onClick={() => updateProduct(product, { lifecycle: product.lifecycle === "published" ? "draft" : "published" })}>{product.lifecycle === "published" ? "Pasar a borrador" : "Publicar"} {product.name}</button><button className="rounded-full border border-ink px-4 py-2 text-sm font-bold disabled:opacity-50" disabled={updating === featuredKey} type="button" onClick={() => updateProduct(product, { featured: !product.featured })}>{product.featured ? "Quitar destacado" : "Destacar"} {product.name}</button></div>
          </article>;
        })}</div>}
      </section>

      {error && <p className="rounded-lg border border-red-700/30 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {feedback && <p className="rounded-lg border border-green-700/30 bg-green-50 p-3 text-sm text-green-800" role="status">{feedback}</p>}
    </div>
  );
}
