import { NextResponse } from "next/server";

import { assertActiveAdmin, AuthorizationError } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const client = await createSupabaseServerClient();
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { data, error } = await client.auth.signInWithPassword({ email: body.email ?? "", password: body.password ?? "" });
  if (error || !data.user) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });

  const { data: profile } = await client.from("admin_profiles").select("id, role, status").eq("id", data.user.id).maybeSingle();
  try {
    assertActiveAdmin(profile ? { id: profile.id, role: profile.role, status: profile.status } : null);
  } catch (authError) {
    await client.auth.signOut();
    const status = authError instanceof AuthorizationError && authError.code === "suspended" ? 403 : 401;
    return NextResponse.json({ error: authError instanceof AuthorizationError ? authError.code : "unauthorized" }, { status });
  }
  return NextResponse.json({ ok: true });
}
