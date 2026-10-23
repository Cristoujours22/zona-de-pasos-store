import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Zona de pasos store | Tenis para Colombia",
    template: "%s | Zona de pasos store",
  },
  description: "Tenis para hombre y mujer adultos, con atención cercana y envíos en Colombia.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#contenido">Saltar al contenido</a>
        {children}
      </body>
    </html>
  );
}
