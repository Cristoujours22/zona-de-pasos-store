"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    if (response.ok) router.push("/admin");
    else setMessage((await response.json()).error ?? "No fue posible iniciar sesión.");
  }
  return (
    <form className="mt-8 grid gap-5" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-bold">Correo<input className="rounded-lg border border-line bg-white px-4 py-3 font-normal" name="email" required type="email" autoComplete="email" /></label>
      <label className="grid gap-2 text-sm font-bold">Contraseña<input className="rounded-lg border border-line bg-white px-4 py-3 font-normal" name="password" required type="password" autoComplete="current-password" /></label>
      <button className="rounded-full bg-ink px-5 py-3 font-bold text-canvas" type="submit">Entrar</button>
      {message && <p className="text-sm text-red-700" role="alert">{message}</p>}
    </form>
  );
}
