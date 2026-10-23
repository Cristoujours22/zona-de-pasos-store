import { requireActiveAdmin } from "@/lib/auth/server";
import { InvitationCreateForm } from "@/components/admin/invitation-create-form";

export default async function AdminPage() {
  const { actor } = await requireActiveAdmin();
  return (
    <main className="shell py-16">
      <p className="eyebrow">Panel protegido</p>
      <h1 className="mt-4 font-display text-6xl font-black uppercase tracking-tight">Operaciones</h1>
      <p className="mt-5 max-w-xl text-muted">Sesión activa como <strong>{actor.role === "developer_superadmin" ? "developer superadmin" : "administrador"}</strong>. Las mutaciones administrativas deben verificar sesión, estado y rol en el servidor.</p>
      {actor.role === "developer_superadmin" && <InvitationCreateForm />}
    </main>
  );
}
