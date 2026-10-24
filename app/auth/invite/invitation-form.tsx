"use client";

import { FormEvent, useEffect, useState } from "react";

function readInvitationDetails(): { invitationId: string; token: string | null } {
  if (typeof window === "undefined") return { invitationId: "", token: null };
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return { invitationId: params.get("id") ?? "", token: hash.get("token") };
}

export function InvitationForm() {
  const [{ invitationId, token }] = useState(readInvitationDetails);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!invitationId || !token) {
      setMessage("La invitación no es válida o ya no está disponible.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: invitationId, token, name: form.get("name"), password: form.get("password") }) });
    const result = await response.json();
    setMessage(response.ok ? "Cuenta creada. Ya puedes iniciar sesión." : (result.error ?? "No fue posible aceptar la invitación."));
  }

  return (
    <form className="mt-8 grid gap-5" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-bold">Nombre<input className="rounded-lg border border-line bg-white px-4 py-3 font-normal" name="name" required minLength={2} /></label>
      <label className="grid gap-2 text-sm font-bold">Contraseña<input className="rounded-lg border border-line bg-white px-4 py-3 font-normal" name="password" required minLength={12} type="password" autoComplete="new-password" /></label>
      <button className="rounded-full bg-ink px-5 py-3 font-bold text-canvas" type="submit">Aceptar invitación</button>
      {message && <p className="text-sm" role="status">{message}</p>}
    </form>
  );
}
