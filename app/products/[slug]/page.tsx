import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AudienceLabel, Price, StockLabel } from "@/components/storefront";
import { SiteHeader } from "@/components/site-header";
import { loadPublicCatalog } from "@/lib/storefront/catalog";
import { siteConfig } from "@/lib/site";
import type { PublicProduct } from "@/types/storefront";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

const getProduct = cache(async (slug: string): Promise<{ product: PublicProduct | null; catalog: Awaited<ReturnType<typeof loadPublicCatalog>> }> => {
  const catalog = await loadPublicCatalog();
  return { catalog, product: catalog.products.find((item) => item.slug === slug) ?? null };
});

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { catalog, product } = await getProduct(slug);
  if (!product) {
    return { title: catalog.status === "ready" || catalog.status === "empty" ? "Producto no encontrado" : "Catálogo no disponible" };
  }
  return {
    title: product.name,
    description: product.description || `${product.name} en ${siteConfig.name}, con precio en pesos colombianos.`,
  };
}

function SupportLink({ supportUrl }: { supportUrl: string | null }) {
  return supportUrl ? (
    <a className="inline-flex rounded-full bg-ink px-5 py-3 text-sm font-bold text-canvas" href={supportUrl} rel="noreferrer" target="_blank">Hablar por WhatsApp</a>
  ) : (
    <span aria-label="WhatsApp no está configurado" className="inline-flex rounded-full border border-line px-5 py-3 text-sm font-bold text-muted">WhatsApp no está configurado</span>
  );
}

function ProductImage({ product }: { product: PublicProduct }) {
  if (!product.image) return <div aria-label="Imagen no disponible" className="flex aspect-square items-center justify-center rounded-[2rem] border border-dashed border-line bg-cream text-sm text-muted" role="img">Imagen no disponible</div>;
  return <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-line bg-cream"><Image alt={product.image.altText} className="object-cover" fill priority sizes="(min-width: 1024px) 50vw, 100vw" src={product.image.secureUrl} /></div>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const { catalog, product } = await getProduct(slug);

  if (!product && (catalog.status === "ready" || catalog.status === "empty")) notFound();

  if (!product) {
    return (
      <>
        <SiteHeader supportUrl={catalog.settings.supportUrl} />
        <main className="shell py-16" id="contenido">
          <p className="rounded-2xl border border-red-700/30 bg-red-50 p-5 text-sm text-red-800" role="alert">{catalog.message ?? "No fue posible cargar el producto. Intenta de nuevo más tarde."}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader supportUrl={catalog.settings.supportUrl} />
      <main className="shell py-12 sm:py-16" id="contenido">
        <LinkBackToCatalog />
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-16">
          <ProductImage product={product} />
          <div>
            <p className="eyebrow">Detalle del producto</p>
            {product.brand && <p className="mt-5 text-sm font-bold uppercase tracking-[0.14em] text-muted">{product.brand.name}</p>}
            <h1 className="mt-3 font-display text-5xl font-black uppercase leading-[0.88] tracking-[-0.06em] sm:text-7xl">{product.name}</h1>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted"><AudienceLabel audience={product.audience} /><span aria-hidden="true">·</span><span>Solo adultos</span></div>
            <p className="mt-6 text-2xl font-bold"><Price value={product.priceCop} /></p>
            {product.description && <p className="mt-6 max-w-xl leading-7 text-muted">{product.description}</p>}

            <section aria-labelledby="variants-title" className="mt-10 border-t border-line pt-7">
              <div className="flex items-end justify-between gap-4"><h2 className="font-display text-2xl font-black uppercase" id="variants-title">Talla, color y SKU</h2><span className="text-sm text-muted">{product.variants.length} opciones</span></div>
              {product.variants.length > 0 ? (
                <ul className="mt-5 grid gap-3">
                  {product.variants.map((variant) => (
                    <li className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-cream p-4" key={variant.id}>
                      <div className="grid gap-1 text-sm"><span className="font-bold">Talla {variant.size}</span><span className="text-muted">Color: {variant.color}</span><span className="text-muted">SKU: {variant.sku}</span></div>
                      <StockLabel available={variant.available} label={variant.stockLabel} />
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-5 rounded-xl border border-dashed border-line p-4 text-sm text-muted">No hay opciones disponibles para mostrar.</p>}
            </section>

            <section aria-labelledby="fulfillment-title" className="mt-10 grid gap-5 border-t border-line pt-7">
              <h2 className="font-display text-2xl font-black uppercase" id="fulfillment-title">Pago y envío</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-lilac/40 p-4"><h3 className="font-bold">Pago anticipado por Nequi</h3><p className="mt-2 text-sm leading-5 text-muted">El comprobante se revisa por WhatsApp con verificación humana antes de confirmar disponibilidad.</p></div>
                <div className="rounded-xl bg-acid/50 p-4"><h3 className="font-bold">Envíos locales y nacionales</h3><p className="mt-2 text-sm leading-5 text-muted">{catalog.settings.dispatchOriginCity ? `Envío local desde ${catalog.settings.dispatchOriginCity}; para otras ciudades de Colombia coordinamos un envío nacional.` : "Coordinamos envíos locales y nacionales dentro de Colombia según la ciudad de destino."}</p></div>
              </div>
              <p className="text-sm text-muted">La disponibilidad se confirma antes de cualquier operación. El carrito y la creación de pedidos estarán disponibles en el siguiente paso.</p>
            </section>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button aria-label="Carrito: próximo paso" className="cursor-not-allowed rounded-full border border-line bg-line/40 px-5 py-3 text-sm font-bold text-muted" disabled type="button">Carrito: próximo paso</button>
              <SupportLink supportUrl={catalog.settings.supportUrl} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function LinkBackToCatalog() {
  return <a className="text-sm font-bold underline underline-offset-8" href="/catalog">← Volver al catálogo</a>;
}
