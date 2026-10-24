import "server-only";

import { assertActiveAdmin, assertSuperadmin, AuthorizationError } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActor } from "@/types/auth";

export async function getCurrentActor() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { client, user: null, actor: null };
  const { data: profile } = await client.from("admin_profiles").select("id, role, status").eq("id", user.id).maybeSingle();
  const actor = profile ? { id: profile.id, role: profile.role, status: profile.status } as AuthActor : null;
  return { client, user, actor };
}

export async function requireActiveAdmin() {
  const context = await getCurrentActor();
  return { ...context, actor: assertActiveAdmin(context.actor) };
}

export async function requireSuperadmin() {
  const context = await getCurrentActor();
  return { ...context, actor: assertSuperadmin(context.actor) };
}

export function authErrorStatus(error: unknown): number {
  if (error instanceof AuthorizationError) return error.code === "unauthenticated" ? 401 : 403;
  return 500;
}
