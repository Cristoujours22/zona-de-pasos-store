import Link from "next/link";

import { ProductCard } from "@/components/storefront";
import { SiteHeader } from "@/components/site-header";
import { loadPublicCatalog } from "@/lib/storefront/catalog";
import { deriveFilterOptions, filterPublicProducts, sortPublicProducts } from "@/lib/storefront/filters";
import { catalogFilters, parseCatalogQuery, type CatalogSearchParams } from "@/lib/storefront/query";

export const dynamic = "force-dynamic";

interface CatalogPageProps {
  searchParams: Promise<CatalogSearchParams>;
}

function withSelected(values: string[], selected: string | undefined): string[] {
  return selected && !values.includes(selected) ? [selected, ...values] : values;
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? "resultado" : "resultados"}`;
}

function FilterForm({ query, options }: { query: ReturnType<typeof parseCatalogQuery>; options: ReturnType<typeof deriveFilterOptions> }) {
  const brands = withSelected(options.brands.map((brand) => brand.slug), query.brand);
  const sizes = withSelected(options.sizes, query.size);
  const colors = withSelected(options.colors, query.color);
  const active = Boolean(query.audience || query.brand || query.size || query.color || query.minPriceCop !== undefined || query.maxPriceCop !== undefined || query.sort !== "featured");

  return (
    <form action="/catalog" aria-label="Filtrar catálogo" className="rounded-2xl border border-line bg-cream p-5 sm:p-7" method="get">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Descubre tu próximo par</p>
          <h2 className="mt-2 font-display text-3xl font-black uppercase tracking-tight">Filtrar selección</h2>
        </div>
        <Link className="text-sm font-bold underline underline-offset-8" href="/catalog">Limpiar filtros</Link>
      </div>
      <fieldset className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="sr-only">Filtros del catálogo</legend>
        <label className="grid gap-2 text-sm font-bold">Audiencia
          <select aria-label="Audiencia" className="rounded-lg border border-line bg-white px-3 py-3 font-normal" defaultValue={query.audience ?? ""} name="audience">
            <option value="">Todas las audiencias</option>
            {options.audiences.map((audience) => <option key={audience} value={audience}>{audience === "men" ? "Hombre" : audience === "women" ? "Mujer" : "Unisex"}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold">Marca
          <select aria-label="Marca" className="rounded-lg border border-line bg-white px-3 py-3 font-normal" defaultValue={query.brand ?? ""} name="brand">
            <option value="">Todas las marcas</option>
            {brands.map((slug) => {
              const brand = options.brands.find((item) => item.slug === slug);
              return <option key={slug} value={slug}>{brand?.name ?? slug}</option>;
            })}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold">Talla
          <select aria-label="Talla" className="rounded-lg border border-line bg-white px-3 py-3 font-normal" defaultValue={query.size ?? ""} name="size">
            <option value="">Todas las tallas</option>
            {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold">Color
          <select aria-label="Color" className="rounded-lg border border-line bg-white px-3 py-3 font-normal" defaultValue={query.color ?? ""} name="color">
            <option value="">Todos los colores</option>
            {colors.map((color) => <option key={color} value={color}>{color}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold">Precio mínimo en COP
          <input aria-label="Precio mínimo" className="rounded-lg border border-line bg-white px-3 py-3 font-normal" defaultValue={query.minPriceCop ?? ""} inputMode="numeric" min="0" name="min" step="1" type="number" />
        </label>
        <label className="grid gap-2 text-sm font-bold">Precio máximo en COP
          <input aria-label="Precio máximo" className="rounded-lg border border-line bg-white px-3 py-3 font-normal" defaultValue={query.maxPriceCop ?? ""} inputMode="numeric" min="0" name="max" step="1" type="number" />
        </label>
        <label className="grid gap-2 text-sm font-bold sm:col-span-2">Ordenar
          <select aria-label="Ordenar" className="rounded-lg border border-line bg-white px-3 py-3 font-normal" defaultValue={query.sort} name="sort">
            <option value="featured">Destacados</option>
            <option value="newest">Más nuevos</option>
            <option value="name">Nombre</option>
            <option value="price_asc">Precio menor a mayor</option>
            <option value="price_desc">Precio mayor a menor</option>
          </select>
        </label>
      </fieldset>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-canvas" type="submit">Aplicar filtros</button>
        {active && <span className="text-sm text-muted">Las selecciones se conservan en la URL.</span>}
      </div>
    </form>
  );
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const [catalog, rawSearchParams] = await Promise.all([loadPublicCatalog(), searchParams]);
  const query = parseCatalogQuery(rawSearchParams);
  const options = deriveFilterOptions(catalog.products);
  const matchingProducts = sortPublicProducts(filterPublicProducts(catalog.products, catalogFilters(query)), query.sort);

  return (
    <>
      <SiteHeader supportUrl={catalog.settings.supportUrl} />
      <main className="shell py-12 sm:py-16" id="contenido">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">Zona de pasos / catálogo público</p>
            <h1 className="mt-4 font-display text-6xl font-black uppercase leading-[0.88] tracking-[-0.06em] sm:text-8xl">Catálogo</h1>
            <p className="mt-5 max-w-2xl text-lg leading-7 text-muted">Tenis para hombre y mujer adultos, con precios en COP, tallas visibles y disponibilidad sujeta a confirmación.</p>
          </div>
          <Link className="inline-flex items-center justify-center rounded-full border border-ink px-5 py-3 text-sm font-bold" href="/#guia">Cómo funciona</Link>
        </div>

        <div className="mt-10"><FilterForm options={options} query={query} /></div>

        {(catalog.status === "database_error" || catalog.status === "missing_environment") && (
          <p className="mt-10 rounded-2xl border border-red-700/30 bg-red-50 p-5 text-sm text-red-800" role="alert">{catalog.message ?? "No fue posible cargar el catálogo. Intenta de nuevo más tarde."}</p>
        )}
        {catalog.status === "empty" && (
          <p className="mt-10 rounded-2xl border border-dashed border-line bg-cream p-6 text-muted" role="status">Aún no hay productos publicados.</p>
        )}
        {catalog.status === "ready" && (
          <section aria-labelledby="results-title" className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
              <div><p className="eyebrow">Selección pública</p><h2 className="mt-2 font-display text-3xl font-black uppercase" id="results-title">{countLabel(matchingProducts.length)}</h2></div>
              <p className="text-sm text-muted">{catalog.products.length} publicados</p>
            </div>
            {matchingProducts.length > 0 ? (
              <div className="mt-8 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {matchingProducts.map((product) => <ProductCard href={`/products/${product.slug}`} key={product.id} product={product} />)}
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-dashed border-line bg-cream p-8" role="status">
                <h3 className="font-display text-3xl font-black uppercase">No encontramos pares con estos filtros.</h3>
                <p className="mt-3 max-w-lg leading-6 text-muted">Prueba otra audiencia, talla, color o rango de precio para volver a ver la selección publicada.</p>
                <Link className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-bold text-canvas" href="/catalog">Quitar filtros</Link>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
