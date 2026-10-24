import type { Metadata } from "next";

import { InvitationForm } from "@/app/auth/invite/invitation-form";

export const metadata: Metadata = { title: "Aceptar invitación" };

export default function InvitationPage() {
  return (
    <main className="shell flex min-h-screen max-w-xl flex-col justify-center py-16">
      <p className="eyebrow">Invitación privada / un solo uso</p>
      <h1 className="mt-4 font-display text-5xl font-black uppercase tracking-tight">Configura tu cuenta</h1>
      <p className="mt-4 text-muted">La invitación expira y solo puede aceptarse una vez. El acceso es individual.</p>
      <InvitationForm />
    </main>
  );
}
