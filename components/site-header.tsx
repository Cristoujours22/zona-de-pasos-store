import Link from "next/link";

import { navigation } from "@/lib/site";

import { ArrowUpRight } from "./icons";
import { BrandMark } from "./brand-mark";

export function SiteHeader() {
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
        <Link className="group inline-flex items-center gap-2 rounded-full border border-ink px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.13em] text-ink transition-colors hover:bg-ink hover:text-canvas" href="#soporte">
          WhatsApp
          <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </header>
  );
}
