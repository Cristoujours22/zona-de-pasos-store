import Link from "next/link";

export function BrandMark() {
  return (
    <Link aria-label="Zona de pasos store, inicio" className="group inline-flex items-center gap-3" href="/">
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-acid font-display text-sm font-black tracking-[-0.08em] text-ink transition-transform group-hover:-rotate-6">
        ZP
      </span>
      <span className="font-display text-[0.82rem] font-black uppercase leading-[0.9] tracking-[0.08em] text-ink">
        Zona de pasos
        <span className="block text-muted">store</span>
      </span>
    </Link>
  );
}
