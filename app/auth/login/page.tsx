import type { Metadata } from "next";

import { LoginForm } from "@/app/auth/login/login-form";

export const metadata: Metadata = {
  title: "Acceso administrativo",
  robots: { index: false, follow: false, noarchive: true },
};

type LoginPageProps = {
  searchParams: Promise<{ recovery?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const recovery = (await searchParams).recovery;
  const notice = recovery === "updated"
    ? "Contraseña actualizada. Inicia sesión nuevamente."
    : recovery === "updated-sessions-pending"
      ? "Contraseña actualizada, pero no pudimos confirmar el cierre de todas las sesiones. Inicia sesión con la nueva contraseña y revisa los accesos en Supabase."
      : recovery === "invalid"
        ? "El enlace de recuperación venció o ya fue utilizado. Solicita uno nuevo."
        : null;

  return (
    <main className="shell flex min-h-screen max-w-xl flex-col justify-center py-16">
      <p className="eyebrow">Zona de pasos store / administración</p>
      <h1 className="mt-4 font-display text-5xl font-black uppercase tracking-tight">Inicia sesión</h1>
      <p className="mt-4 text-muted">Usa tu cuenta individual. Las cuentas suspendidas no pueden acceder al panel.</p>
      {notice && <p className="mt-4 rounded-lg border border-line bg-white p-4 text-sm" role="status">{notice}</p>}
      <LoginForm />
    </main>
  );
}
