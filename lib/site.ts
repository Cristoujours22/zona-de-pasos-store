export const siteConfig = {
  name: "Zona de pasos store",
  market: "solo para Colombia",
  audience: "tenis para hombre y mujer adultos",
  currency: "pesos colombianos",
  supportHref: "/#soporte",
} as const;

export const navigation = [
  { label: "Catálogo", href: "/catalog" },
  { label: "Cómo comprar", href: "/#guia" },
  { label: "Soporte", href: siteConfig.supportHref },
] as const;
