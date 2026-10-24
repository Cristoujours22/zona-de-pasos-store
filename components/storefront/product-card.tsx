import Image from "next/image";
import Link from "next/link";

import { AudienceLabel } from "@/components/storefront/audience-label";
import { Price } from "@/components/storefront/price";
import { StockLabel } from "@/components/storefront/stock-label";
import { presentPublicStock } from "@/lib/storefront/presentation";
import { isSafeCloudinaryUrl } from "@/lib/storefront/image";
import type { PublicProduct } from "@/types/storefront";

export interface ProductCardProps {
  product: PublicProduct;
  href?: string;
}

export function ProductCard({ product, href }: ProductCardProps) {
  const stock = presentPublicStock(product.variants);
  const image = product.image && isSafeCloudinaryUrl(product.image.secureUrl) ? product.image : null;
  const title = <h3 className="font-display text-2xl font-black uppercase leading-none tracking-tight" id={`product-card-${product.id}`}>{product.name}</h3>;

  return (
    <article aria-labelledby={`product-card-${product.id}`} className="grid gap-4">
      {image ? (
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-cream">
          <Image alt={image.altText} className="object-cover" fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw" src={image.secureUrl} />
        </div>
      ) : (
        <div aria-label="Imagen no disponible" className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-line bg-cream text-sm text-muted" role="img">Imagen no disponible</div>
      )}
      <div className="grid gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {product.brand && <p className="text-sm text-muted">{product.brand.name}</p>}
            {href ? <Link className="hover:underline" href={href}>{title}</Link> : title}
          </div>
          {product.featured && <span className="shrink-0 rounded-full bg-acid px-2.5 py-1 text-[0.62rem] font-bold uppercase">Destacado</span>}
        </div>
        <p className="text-lg font-bold"><Price value={product.priceCop} /></p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <AudienceLabel audience={product.audience} />
          <StockLabel {...stock} />
        </div>
        {product.variants.length > 0 && <p className="text-sm text-muted"><span className="font-bold text-ink">Tallas:</span> {product.variants.map((variant) => variant.size).join(" · ")}</p>}
      </div>
    </article>
  );
}
