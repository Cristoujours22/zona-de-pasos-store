import { NextResponse } from "next/server";

import { applicationOrigin, normalizeRecoveryEmail } from "@/lib/auth/password-recovery";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const email = normalizeRecoveryEmail(body.email);
  if (!email) return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  const client = await createSupabaseServerClient();
  const redirectTo = new URL("/auth/callback", applicationOrigin(request)).toString();

  try {
    await client.auth.resetPasswordForEmail(email, { redirectTo });
  } catch {
    // Recovery requests intentionally return the same response for every account.
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
