import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/202604020001_auth_onboarding.sql", "utf8");

describe("authentication migration security invariants", () => {
  it("stores only hashed invitation tokens and enables RLS on every security table", () => {
    expect(migration).toContain("token_hash text not null unique");
    expect(migration).not.toMatch(/token\s+text\s+not null/i);
    expect(migration).toMatch(/alter table public\.admin_profiles enable row level security/);
    expect(migration).toMatch(/alter table public\.bootstrap_state enable row level security/);
    expect(migration).toMatch(/alter table public\.admin_invitations enable row level security/);
    expect(migration).toMatch(/alter table public\.audit_events enable row level security/);
  });

  it("preserves invitation roles through the RPC signature and insert", () => {
    expect(migration).toContain("p_email text, p_role public.admin_role, p_token_hash text");
    expect(migration).toContain("insert into public.admin_invitations(email, role, token_hash, expires_at, invited_by)");
    expect(migration).toContain("values (lower(trim(p_email)), p_role, p_token_hash");
  });

  it("keeps RLS helpers in a private schema without public RPC exposure", () => {
    expect(migration).toContain("create schema if not exists private");
    expect(migration).toContain("private.is_superadmin");
    expect(migration).not.toContain("public.is_superadmin");
    expect(migration).toContain("revoke all on schema private from public, anon, authenticated");
    expect(migration).toContain("grant usage on schema private to authenticated");
    expect(migration).toContain("grant execute on function private.is_superadmin(uuid) to authenticated");
  });

  it("uses durable and atomic gates for bootstrap and invitation consumption", () => {
    expect(migration).toContain("completed_at is null");
    expect(migration).toContain("accepted_at is null and expires_at >");
    expect(migration).toContain("invitation_created");
    expect(migration).toContain("invitation_accepted");
    expect(migration).toContain("bootstrap_completed");
  });
});
