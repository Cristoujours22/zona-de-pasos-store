import type { Metadata } from "next";

import { UpdatePasswordForm } from "@/app/auth/update-password/update-password-form";

export const metadata: Metadata = {
  title: "Actualizar contraseña administrativa",
  robots: { index: false, follow: false, noarchive: true },
};

export default function UpdatePasswordPage() {
  return (
    <main className="shell flex min-h-screen max-w-xl flex-col justify-center py-16">
      <p className="eyebrow">Zona de pasos store / administración</p>
      <h1 className="mt-4 font-display text-5xl font-black uppercase tracking-tight">Nueva contraseña</h1>
      <p className="mt-4 text-muted">Usa una contraseña única de entre 12 y 128 caracteres. Al guardarla se cerrarán todas las sesiones.</p>
      <UpdatePasswordForm />
    </main>
  );
}
