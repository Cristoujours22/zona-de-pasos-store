import type { Metadata } from "next";

import { SetupForm } from "@/app/setup/setup-form";
import { makeBootstrapAdapter } from "@/lib/auth/adapters";
import { isBootstrapAvailable } from "@/lib/auth/domain";
import { isHighEntropySetupSecret } from "@/lib/validation/auth";

export const metadata: Metadata = {
  title: "Configuración inicial",
  robots: { index: false, follow: false, noarchive: true },
};
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  let available = false;
  if (isHighEntropySetupSecret(process.env.SETUP_SECRET ?? "")) {
    try {
      available = isBootstrapAvailable(await makeBootstrapAdapter().getBootstrapState());
    } catch {
      // Fail closed: the page must not expose onboarding when its durable state cannot be read.
    }
  }
  return (
    <main className="shell flex min-h-screen max-w-xl flex-col justify-center py-16">
      <p className="eyebrow">Configuración inicial / uso único</p>
      <h1 className="mt-4 font-display text-5xl font-black uppercase tracking-tight">Crea el superadmin</h1>
      {available ? (
        <>
          <p className="mt-4 text-muted">Este formulario deja de funcionar después del primer registro exitoso. Requiere el secreto configurado en el servidor.</p>
          <SetupForm />
        </>
      ) : (
        <p className="mt-4 text-muted" role="status">La configuración inicial ya no está disponible.</p>
      )}
    </main>
  );
}
