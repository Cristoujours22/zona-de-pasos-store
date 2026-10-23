import type { Metadata } from "next";

import { LoginForm } from "@/app/auth/login/login-form";

export const metadata: Metadata = { title: "Acceso administrativo" };

export default function LoginPage() {
  return (
    <main className="shell flex min-h-screen max-w-xl flex-col justify-center py-16">
      <p className="eyebrow">Zona de pasos store / administración</p>
      <h1 className="mt-4 font-display text-5xl font-black uppercase tracking-tight">Inicia sesión</h1>
      <p className="mt-4 text-muted">Usa tu cuenta individual. Las cuentas suspendidas no pueden acceder al panel.</p>
      <LoginForm />
    </main>
  );
}
