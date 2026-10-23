import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BootstrapAdapter, InvitationAdapter } from "@/lib/auth/domain";
import type { InvitationRecord } from "@/types/auth";

function throwOnError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function makeBootstrapAdapter(): BootstrapAdapter {
  const admin = createSupabaseAdminClient();
  return {
    async getBootstrapState() {
      const { data, error } = await admin.from("bootstrap_state").select("completed_at").eq("singleton", true).single();
      throwOnError(error);
      return data ? { completedAt: data.completed_at ? new Date(data.completed_at) : null } : null;
    },
    async createUser(input) {
      const { data, error } = await admin.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true, user_metadata: { display_name: input.name, role: input.role } });
      throwOnError(error);
      if (!data.user) throw new Error("Supabase did not return the created user");
      return { userId: data.user.id };
    },
    async claimBootstrap(input) {
      const { data, error } = await admin.rpc("claim_bootstrap", { p_user_id: input.userId, p_email: input.email, p_display_name: input.name });
      throwOnError(error);
      return data === true;
    },
    async deleteUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      throwOnError(error);
    },
  };
}

export function makeInvitationAdapter(): InvitationAdapter {
  const admin = createSupabaseAdminClient();
  return {
    async createInvitation(input) {
      const { data, error } = await admin.rpc("create_admin_invitation", { p_email: input.email, p_role: input.role, p_token_hash: input.tokenHash, p_expires_at: input.expiresAt.toISOString(), p_invited_by: input.invitedBy });
      throwOnError(error);
      if (typeof data !== "string") throw new Error("Supabase did not return the invitation id");
      return { id: data };
    },
    async getInvitation(id): Promise<InvitationRecord | null> {
      const { data, error } = await admin.from("admin_invitations").select("id, email, role, token_hash, expires_at, accepted_at").eq("id", id).maybeSingle();
      throwOnError(error);
      return data ? { id: data.id, email: data.email, role: data.role, tokenHash: data.token_hash, expiresAt: new Date(data.expires_at), acceptedAt: data.accepted_at ? new Date(data.accepted_at) : null } : null;
    },
    async createUser(input) {
      const { data, error } = await admin.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true, user_metadata: { display_name: input.name, role: input.role } });
      throwOnError(error);
      if (!data.user) throw new Error("Supabase did not return the created user");
      return { userId: data.user.id };
    },
    async consumeInvitation(input) {
      const { data, error } = await admin.rpc("consume_admin_invitation", { p_id: input.id, p_token_hash: input.tokenHash, p_user_id: input.userId, p_display_name: input.name });
      throwOnError(error);
      return typeof data === "string";
    },
    async deleteUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      throwOnError(error);
    },
  };
}
