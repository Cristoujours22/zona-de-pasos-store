import Link from "next/link";

import { ArrowRight, ArrowUpRight, MessageCircle } from "@/components/icons";
import { ProductCard } from "@/components/storefront";
import { SiteHeader } from "@/components/site-header";
import { loadPublicCatalog } from "@/lib/storefront/catalog";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

function SupportAction({ supportUrl }: { supportUrl: string | null }) {
  return supportUrl ? (
    <a className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-ink underline decoration-line underline-offset-8 transition-colors hover:text-muted" href={supportUrl} rel="noreferrer" target="_blank">
      <MessageCircle className="size-4" />
      Hablar por WhatsApp
    </a>
  ) : (
    <span aria-label="WhatsApp no está configurado" className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-4 py-3 text-sm font-bold text-muted">
      <MessageCircle className="size-4" />
      WhatsApp no está configurado
    </span>
  );
}

export default async function HomePage() {
  const catalog = await loadPublicCatalog();
  const featured = catalog.products.filter((product) => product.featured).slice(0, 4);
  const newest = catalog.products.slice(0, 4);
  const supportUrl = catalog.settings.supportUrl;

  return (
    <>
      <SiteHeader supportUrl={supportUrl} />
      <main id="contenido">
        <section aria-labelledby="hero-title" className="overflow-hidden border-b border-line">
          <div className="shell grid min-h-[39rem] items-center gap-12 py-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:py-20">
            <div className="relative z-10 max-w-2xl">
              <p className="eyebrow mb-7">Zona de pasos / {siteConfig.market}</p>
              <h1 className="max-w-xl font-display text-[clamp(3.6rem,9vw,8.3rem)] font-black uppercase leading-[0.83] tracking-[-0.075em] text-ink" id="hero-title">
                Tu próximo paso empieza aquí.
              </h1>
              <p className="mt-8 max-w-md text-lg leading-7 text-muted">
                Tenis para hombre y mujer adultos, elegidos para moverte con intención. Descubre pares publicados por marcas que ya hacen parte de la selección en Colombia.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link className="inline-flex items-center gap-3 rounded-full bg-ink px-6 py-3.5 text-sm font-bold text-canvas transition-transform hover:-translate-y-0.5" href="/catalog">
                  Ver catálogo
                  <ArrowRight className="size-4" />
                </Link>
                <SupportAction supportUrl={supportUrl} />
              </div>
              <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">
                <span>Precios en COP</span>
                <span>Tallas visibles</span>
                <span>Envíos nacionales</span>
              </div>
            </div>

            <div aria-label="Composición abstracta de campaña con un tenis" className="hero-stage relative min-h-[28rem] overflow-hidden rounded-[2rem] bg-ink" role="img">
              <div aria-hidden="true" className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:4rem_4rem]" />
              <div aria-hidden="true" className="absolute -right-16 -top-16 size-64 rounded-full border border-canvas/30" />
              <div aria-hidden="true" className="absolute -bottom-32 -left-20 size-80 rounded-full border border-canvas/20" />
              <p className="absolute left-7 top-7 max-w-28 text-[0.64rem] font-bold uppercase leading-4 tracking-[0.18em] text-canvas/70">Campaña 01 / movimiento diario</p>
              <p className="absolute bottom-7 right-7 text-right text-[0.64rem] font-bold uppercase leading-4 tracking-[0.18em] text-acid">Hecho para moverte</p>
              <div aria-hidden="true" className="absolute left-[15%] top-[36%] h-28 w-[70%] -rotate-[12deg] rounded-[45%_45%_25%_28%] bg-coral shadow-[1.5rem_1.5rem_0_var(--acid)] sm:h-36">
                <span className="absolute -bottom-7 left-[12%] h-10 w-[78%] rounded-[50%] bg-canvas" />
                <span className="absolute left-[26%] top-7 h-1.5 w-[42%] -rotate-3 bg-ink/70 shadow-[0_1.2rem_0_var(--ink)]" />
                <span className="absolute -right-2 top-4 size-12 rounded-full border-4 border-ink/20" />
              </div>
              <span className="absolute left-7 top-1/2 rounded-full bg-acid px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-ink">Nueva selección</span>
            </div>
          </div>
        </section>

        <section aria-label="Promesas de la tienda" className="border-b border-line bg-ink text-canvas">
          <div className="shell grid divide-y divide-canvas/15 py-1 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              ["01", "Solo Colombia", "Una experiencia pensada para nuestro mercado."],
              ["02", "Pago por Nequi", "Pago anticipado y verificación humana antes de confirmar."],
              ["03", "Envío a tu ritmo", "Envíos locales y nacionales con orientación por WhatsApp."],
            ].map(([number, title, copy]) => (
              <div className="flex gap-4 py-6 sm:px-7 sm:first:pl-0 sm:last:pr-0" key={number}>
                <span className="font-mono text-xs text-acid">{number}</span>
                <div>
                  <h2 className="text-sm font-bold">{title}</h2>
                  <p className="mt-1 max-w-xs text-sm leading-5 text-canvas/60">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="audience-title" className="shell py-20 sm:py-24">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Encuentra tu dirección</p>
              <h2 className="mt-4 font-display text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] text-ink sm:text-6xl" id="audience-title">Empieza por tu ritmo.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted">Filtra la selección por audiencia y sigue descubriendo sin perder de vista las tallas y la disponibilidad.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Tenis para hombre", "/catalog?audience=men", "Movimiento diario y siluetas versátiles."],
              ["Tenis para mujer", "/catalog?audience=women", "Pares para acompañar todos tus planes."],
              ["Selección unisex", "/catalog?audience=unisex", "Encuentra tu par sin etiquetas."],
            ].map(([label, href, copy]) => (
              <Link className="group rounded-2xl border border-line bg-cream p-6 transition-transform hover:-translate-y-1" href={href} key={href}>
                <span className="flex items-center justify-between font-display text-2xl font-black uppercase leading-none tracking-tight">{label}<ArrowUpRight className="size-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></span>
                <span className="mt-10 block max-w-xs text-sm leading-5 text-muted">{copy}</span>
              </Link>
            ))}
          </div>
        </section>

        {(catalog.status === "database_error" || catalog.status === "missing_environment") && (
          <section aria-label="Estado del catálogo" className="shell pb-12">
            <p className="rounded-2xl border border-red-700/30 bg-red-50 p-5 text-sm text-red-800" role="alert">{catalog.message ?? "No fue posible cargar el catálogo. Intenta de nuevo más tarde."}</p>
          </section>
        )}

        {catalog.status === "empty" && (
          <section aria-label="Estado del catálogo" className="shell pb-20">
            <div className="rounded-[2rem] border border-dashed border-line bg-cream p-8 sm:p-12" role="status">
              <p className="eyebrow">Selección en preparación</p>
              <h2 className="mt-4 max-w-xl font-display text-4xl font-black uppercase leading-none tracking-tight">La selección se está preparando.</h2>
              <p className="mt-5 max-w-lg leading-6 text-muted">Aún no hay productos publicados. Vuelve pronto para conocer los pares disponibles en Colombia.</p>
            </div>
          </section>
        )}

        {catalog.status === "ready" && (
          <>
            {featured.length > 0 && (
              <section aria-labelledby="featured-title" className="border-y border-line bg-cream" id="coleccion">
                <div className="shell py-20 sm:py-28">
                  <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                    <div>
                      <p className="eyebrow">Selección destacada</p>
                      <h2 className="mt-4 font-display text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] text-ink sm:text-7xl" id="featured-title">Menos ruido. Más movimiento.</h2>
                    </div>
                    <Link className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-8" href="/catalog">Ver toda la selección <ArrowUpRight className="size-4" /></Link>
                  </div>
                  <div className="mt-12 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                    {featured.map((product) => <ProductCard href={`/products/${product.slug}`} key={product.id} product={product} />)}
                  </div>
                </div>
              </section>
            )}
            <section aria-labelledby="new-title" className="shell py-20 sm:py-28" id="novedades">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                <div>
                  <p className="eyebrow">Recién publicados</p>
                  <h2 className="mt-4 font-display text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] text-ink sm:text-7xl" id="new-title">Lo nuevo toma el paso.</h2>
                </div>
                <p className="max-w-xs text-sm leading-6 text-muted">Productos publicados con precio en pesos colombianos, tallas visibles y disponibilidad sujeta a confirmación.</p>
              </div>
              <div className="mt-12 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                {newest.map((product) => <ProductCard href={`/products/${product.slug}`} key={product.id} product={product} />)}
              </div>
            </section>
          </>
        )}

        <section aria-labelledby="guide-title" className="border-y border-line bg-lilac/30" id="guia">
          <div className="shell grid gap-12 py-24 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="eyebrow">Tu compra, sin complicaciones</p>
              <h2 className="mt-4 max-w-md font-display text-5xl font-black uppercase leading-[0.88] tracking-[-0.06em] text-ink sm:text-6xl" id="guide-title">De la idea al paso.</h2>
              <p className="mt-7 max-w-sm leading-6 text-muted">Descubre el producto, revisa talla y color, y conversa con nosotros para confirmar disponibilidad, pago y envío.</p>
            </div>
            <ol className="divide-y divide-ink/15">
              {[
                ["01", "Elige tu ritmo", "Explora la selección y encuentra la silueta que va contigo."],
                ["02", "Confirma tu talla", "La talla, el color, el SKU y la disponibilidad se muestran de forma clara."],
                ["03", "Hablemos por WhatsApp", "Te ayudamos a confirmar disponibilidad, pago anticipado por Nequi y envío."],
              ].map(([number, title, copy]) => (
                <li className="grid gap-4 py-6 first:pt-0 last:pb-0 sm:grid-cols-[3rem_1fr]" key={number}>
                  <span className="font-mono text-xs text-muted">{number}</span>
                  <div><h3 className="text-xl font-bold tracking-tight text-ink">{title}</h3><p className="mt-2 max-w-lg leading-6 text-muted">{copy}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="support-title" className="shell py-24 sm:py-32" id="soporte">
          <div className="relative overflow-hidden rounded-[2rem] bg-acid px-6 py-12 sm:px-12 sm:py-16 lg:px-20">
            <div aria-hidden="true" className="absolute -right-16 -top-24 size-72 rounded-full border-[1.5rem] border-ink/10" />
            <div className="relative max-w-2xl">
              <p className="eyebrow">Estamos a un mensaje</p>
              <h2 className="mt-5 max-w-xl font-display text-5xl font-black uppercase leading-[0.86] tracking-[-0.07em] text-ink sm:text-7xl" id="support-title">¿Listo para dar el siguiente paso?</h2>
              <p className="mt-7 max-w-md text-base leading-6 text-ink/70">Te orientamos sobre tallas, disponibilidad, pago anticipado por Nequi y envíos locales o nacionales.</p>
              <div className="mt-9"><SupportAction supportUrl={supportUrl} /></div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-line">
        <div className="shell flex flex-col gap-4 py-7 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>{siteConfig.name}</span>
          <span>{siteConfig.market} · {siteConfig.currency}</span>
          <span>© {new Date().getFullYear()} · Catálogo público</span>
        </div>
      </footer>
    </>
  );
}
