"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export function RecoveryForm() {
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/auth/password/recovery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });

    if (response.ok) {
      setMessage("Si la cuenta existe, recibirás un enlace para restablecer la contraseña.");
      formElement.reset();
      return;
    }

    setMessage("Revisa el correo ingresado e intenta nuevamente.");
  }

  return (
    <form className="mt-8 grid gap-5" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-bold">
        Correo administrativo
        <input className="rounded-lg border border-line bg-white px-4 py-3 font-normal" name="email" required type="email" autoComplete="email" />
      </label>
      <button className="rounded-full bg-ink px-5 py-3 font-bold text-canvas" type="submit">Enviar enlace</button>
      {message && <p className="text-sm text-muted" role="status">{message}</p>}
      <Link className="text-sm font-bold underline" href="/auth/login">Volver al acceso administrativo</Link>
    </form>
  );
}
