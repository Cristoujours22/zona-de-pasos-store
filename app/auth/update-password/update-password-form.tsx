"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (password !== confirmation) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    const response = await fetch("/api/auth/password/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      router.push(result.sessionsInvalidated === false ? "/auth/login?recovery=updated-sessions-pending" : "/auth/login?recovery=updated");
      return;
    }

    setMessage(result.error === "recovery_session_required"
      ? "El enlace venció o ya fue utilizado. Solicita uno nuevo."
      : "No fue posible actualizar la contraseña.");
  }

  return (
    <form className="mt-8 grid gap-5" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-bold">
        Nueva contraseña
        <input className="rounded-lg border border-line bg-white px-4 py-3 font-normal" name="password" required minLength={12} maxLength={128} type="password" autoComplete="new-password" />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Confirma la contraseña
        <input className="rounded-lg border border-line bg-white px-4 py-3 font-normal" name="confirmation" required minLength={12} maxLength={128} type="password" autoComplete="new-password" />
      </label>
      <button className="rounded-full bg-ink px-5 py-3 font-bold text-canvas" type="submit">Actualizar contraseña</button>
      {message && <p className="text-sm text-red-700" role="alert">{message}</p>}
    </form>
  );
}
