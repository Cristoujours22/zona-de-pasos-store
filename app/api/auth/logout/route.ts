import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signOut();
  if (error) return NextResponse.json({ error: "logout_failed" }, { status: 500 });
  return NextResponse.redirect(new URL("/auth/login", request.url), 303);
}
