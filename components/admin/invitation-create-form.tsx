"use client";

import { FormEvent, useState } from "react";

export function InvitationCreateForm() {
  const [result, setResult] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), role: "admin" }) });
    const body = await response.json();
    setResult(response.ok ? `Enlace de un solo uso: ${body.path}` : (body.error ?? "No fue posible crear la invitación."));
  }
  return (
    <section className="mt-12 max-w-xl rounded-2xl border border-line bg-canvas p-6" aria-labelledby="invite-title">
      <h2 className="font-display text-3xl font-black uppercase" id="invite-title">Invitar administrador</h2>
      <form className="mt-5 flex flex-col gap-4 sm:flex-row" onSubmit={submit}>
        <input className="min-w-0 flex-1 rounded-lg border border-line px-4 py-3" name="email" required type="email" placeholder="admin@ejemplo.com" aria-label="Correo del administrador" />
        <button className="rounded-full bg-ink px-5 py-3 font-bold text-canvas" type="submit">Crear invitación</button>
      </form>
      {result && <p className="mt-4 break-all text-sm" role="status">{result}</p>}
    </section>
  );
}
