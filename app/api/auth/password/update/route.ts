import { NextResponse } from "next/server";

import { assertActiveAdmin, AuthorizationError } from "@/lib/auth/authorization";
import { isValidNewPassword } from "@/lib/auth/password-recovery";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const client = await createSupabaseServerClient();
  const { data, error: userError } = await client.auth.getUser();
  if (userError || !data.user) return NextResponse.json({ error: "recovery_session_required" }, { status: 401 });

  const { data: profile } = await client
    .from("admin_profiles")
    .select("id, role, status")
    .eq("id", data.user.id)
    .maybeSingle();

  try {
    assertActiveAdmin(profile ? { id: profile.id, role: profile.role, status: profile.status } : null);
  } catch (error) {
    await client.auth.signOut({ scope: "global" });
    const status = error instanceof AuthorizationError && error.code === "suspended" ? 403 : 401;
    return NextResponse.json({ error: error instanceof AuthorizationError ? error.code : "unauthorized" }, { status });
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!isValidNewPassword(body.password)) {
    return NextResponse.json({ error: "invalid_password" }, { status: 400 });
  }

  const { error } = await client.auth.updateUser({ password: body.password });
  if (error) return NextResponse.json({ error: "password_update_failed" }, { status: 400 });

  const { error: signOutError } = await client.auth.signOut({ scope: "global" });
  return NextResponse.json({ ok: true, passwordUpdated: true, sessionsInvalidated: !signOutError });
}
