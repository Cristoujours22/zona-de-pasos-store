import { redirect } from "next/navigation";

import { AuthorizationError } from "@/lib/auth/authorization";
import { requireActiveAdmin } from "@/lib/auth/server";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  try {
    await requireActiveAdmin();
  } catch (error) {
    const code = error instanceof AuthorizationError ? error.code : "unauthorized";
    redirect(`/auth/login?error=${code}`);
  }
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-line bg-canvas">
        <div className="shell flex items-center justify-between py-5">
          <span className="font-display text-xl font-black uppercase">Zona de pasos / admin</span>
          <form action="/api/auth/logout" method="post"><button className="text-sm font-bold underline" type="submit">Cerrar sesión</button></form>
        </div>
      </header>
      {children}
    </div>
  );
}
