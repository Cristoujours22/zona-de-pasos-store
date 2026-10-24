import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthorizationError } from "@/lib/auth/authorization";
import { requireActiveAdmin } from "@/lib/auth/server";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let actor: Awaited<ReturnType<typeof requireActiveAdmin>>["actor"];
  try {
    ({ actor } = await requireActiveAdmin());
  } catch (error) {
    const code = error instanceof AuthorizationError ? error.code : "unauthorized";
    redirect(`/auth/login?error=${code}`);
  }
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-line bg-canvas">
        <div className="shell flex flex-col gap-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center justify-between gap-4"><Link className="font-display text-xl font-black uppercase" href="/admin">Zona de pasos / admin</Link><form action="/api/auth/logout" method="post"><button className="text-sm font-bold underline lg:hidden" type="submit">Cerrar sesión</button></form></div>
          <nav aria-label="Navegación administrativa" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-bold">
            <Link href="/admin/catalog">Catálogo</Link>
            <Link href="/admin/inventory">Inventario</Link>
            <Link href="/admin/orders">Pedidos</Link>
            <Link href="/admin/settings">Configuración</Link>
            {actor.role === "developer_superadmin" && <Link href="/admin#invitaciones">Invitaciones</Link>}
          </nav>
          <form action="/api/auth/logout" method="post"><button className="hidden text-sm font-bold underline lg:block" type="submit">Cerrar sesión</button></form>
        </div>
      </header>
      {children}
    </div>
  );
}
