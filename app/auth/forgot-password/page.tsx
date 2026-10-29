import type { Metadata } from "next";

import { RecoveryForm } from "@/app/auth/forgot-password/recovery-form";

export const metadata: Metadata = {
  title: "Recuperar acceso administrativo",
  robots: { index: false, follow: false, noarchive: true },
};

export default function ForgotPasswordPage() {
  return (
    <main className="shell flex min-h-screen max-w-xl flex-col justify-center py-16">
      <p className="eyebrow">Zona de pasos store / administración</p>
      <h1 className="mt-4 font-display text-5xl font-black uppercase tracking-tight">Recupera tu acceso</h1>
      <p className="mt-4 text-muted">Enviaremos un enlace de un solo uso al correo de la cuenta administrativa.</p>
      <RecoveryForm />
    </main>
  );
}
