"use client";

import { FormEvent, useState } from "react";

export function SetupForm() {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/setup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const result = await response.json();
    setMessage(response.ok ? "Configuración completa. Ya puedes iniciar sesión." : (result.error ?? "No fue posible completar la configuración."));
  }
  return (
    <form className="mt-8 grid gap-5" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-bold">Nombre<input className="rounded-lg border border-line bg-white px-4 py-3 font-normal" name="name" required minLength={2} /></label>
      <label className="grid gap-2 text-sm font-bold">Correo<input className="rounded-lg border border-line bg-white px-4 py-3 font-normal" name="email" required type="email" autoComplete="email" /></label>
      <label className="grid gap-2 text-sm font-bold">Contraseña<input className="rounded-lg border border-line bg-white px-4 py-3 font-normal" name="password" required minLength={12} type="password" autoComplete="new-password" /></label>
      <label className="grid gap-2 text-sm font-bold">Secreto de despliegue<input className="rounded-lg border border-line bg-white px-4 py-3 font-normal" name="setupSecret" required minLength={64} maxLength={64} pattern="[0-9a-fA-F]{64}" type="password" autoComplete="off" /></label>
      <button className="rounded-full bg-ink px-5 py-3 font-bold text-canvas" type="submit">Crear superadmin</button>
      {message && <p className="text-sm" role="status">{message}</p>}
    </form>
  );
}
