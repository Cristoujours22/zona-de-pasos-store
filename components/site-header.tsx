import Link from "next/link";

import { navigation } from "@/lib/site";

import { ArrowUpRight } from "./icons";
import { BrandMark } from "./brand-mark";

interface SiteHeaderProps {
  supportUrl?: string | null;
}

export function SiteHeader({ supportUrl = null }: SiteHeaderProps) {
  return (
    <header className="border-b border-line/80 bg-canvas/90 backdrop-blur" role="banner">
      <div className="shell flex min-h-20 items-center justify-between gap-5">
        <BrandMark />
        <nav aria-label="Navegación principal" className="hidden items-center gap-7 md:flex">
          {navigation.map((item) => (
            <Link className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-muted transition-colors hover:text-ink" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        {supportUrl ? (
          <a className="group inline-flex items-center gap-2 rounded-full border border-ink px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.13em] text-ink transition-colors hover:bg-ink hover:text-canvas" href={supportUrl} rel="noreferrer" target="_blank">
            WhatsApp
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        ) : (
          <span aria-label="WhatsApp no está configurado" className="inline-flex cursor-not-allowed items-center rounded-full border border-line px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.13em] text-muted">
            WhatsApp no disponible
          </span>
        )}
      </div>
    </header>
  );
}
