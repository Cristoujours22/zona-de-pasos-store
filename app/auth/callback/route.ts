import { NextResponse } from "next/server";

import { applicationOrigin } from "@/lib/auth/password-recovery";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function redirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, applicationOrigin(request)));
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return redirect(request, "/auth/login?recovery=invalid");

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) return redirect(request, "/auth/login?recovery=invalid");

  return redirect(request, "/auth/update-password");
}
