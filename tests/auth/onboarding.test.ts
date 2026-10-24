import { describe, expect, it, vi } from "vitest";

const { invitationRpc } = vi.hoisted(() => ({ invitationRpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc: invitationRpc }),
}));

import {
  acceptInvitation,
  bootstrapFirstSuperadmin,
  createAdminInvitation,
  hashToken,
  type InvitationAdapter,
  type ReconciliationResult,
  type BootstrapAdapter,
} from "@/lib/auth/domain";
import { makeInvitationAdapter } from "@/lib/auth/adapters";
import type { AuthActor, InvitationRecord } from "@/types/auth";

const now = new Date("2026-01-01T12:00:00.000Z");
const setupSecret = "0123456789abcdef".repeat(4);

function bootstrapAdapter(overrides: Partial<BootstrapAdapter> = {}): BootstrapAdapter {
  return {
    getBootstrapState: async () => ({ completedAt: null }),
    createUser: async () => ({ userId: "user-1" }),
    claimBootstrap: async () => true,
    reconcileBootstrap: async () => "unknown",
    deleteUser: async () => undefined,
    ...overrides,
  };
}

function invitationAdapter(record: InvitationRecord, overrides: Partial<InvitationAdapter> = {}): InvitationAdapter {
  return {
    createInvitation: async () => ({ id: "invite-1" }),
    getInvitation: async () => record,
    createUser: async () => ({ userId: "user-2" }),
    consumeInvitation: async () => true,
    reconcileInvitation: async () => "unknown",
    deleteUser: async () => undefined,
    ...overrides,
  };
}

const superadmin: AuthActor = { id: "root", role: "developer_superadmin", status: "active" };
const admin: AuthActor = { id: "admin", role: "admin", status: "active" };

describe("secure onboarding domain", () => {
  it("rejects an incorrect setup secret before creating a user", async () => {
    await expect(
      bootstrapFirstSuperadmin(
        { email: "root@example.com", password: "correct horse", name: "Root", setupSecret: "wrong" },
        bootstrapAdapter(),
        setupSecret,
        now,
      ),
    ).rejects.toMatchObject({ code: "invalid_setup_secret" });
  });

  it("rejects bootstrap after the durable completion marker is set", async () => {
    await expect(
      bootstrapFirstSuperadmin(
        { email: "root@example.com", password: "correct horse", name: "Root", setupSecret },
        bootstrapAdapter({ getBootstrapState: async () => ({ completedAt: now }) }),
        setupSecret,
        now,
      ),
    ).rejects.toMatchObject({ code: "bootstrap_completed" });
  });

  it("creates the first superadmin with the expected secret", async () => {
    const result = await bootstrapFirstSuperadmin(
      { email: "root@example.com", password: "correct horse", name: "Root", setupSecret },
      bootstrapAdapter(),
      setupSecret,
      now,
    );

    expect(result).toEqual({ userId: "user-1" });
  });

  it("rejects a deployment secret that is not exactly 64 hexadecimal characters", async () => {
    const invalidSecret = `${"A1!".repeat(21)}A`;
    await expect(
      bootstrapFirstSuperadmin(
        { email: "root@example.com", password: "correct horse", name: "Root", setupSecret: invalidSecret },
        bootstrapAdapter(),
        invalidSecret,
        now,
      ),
    ).rejects.toMatchObject({ code: "invalid_setup_secret" });
  });

  it("cleans up the created auth user when bootstrap loses its claim race", async () => {
    const deleteUser = vi.fn();
    await expect(
      bootstrapFirstSuperadmin(
        { email: "root@example.com", password: "correct horse", name: "Root", setupSecret },
        bootstrapAdapter({ claimBootstrap: async () => false, deleteUser }),
        setupSecret,
        now,
      ),
    ).rejects.toMatchObject({ code: "bootstrap_race" });
    expect(deleteUser).toHaveBeenCalledWith("user-1");
  });

  it.each(["committed", "not_committed", "unknown"] as ReconciliationResult[])("reconciles bootstrap after an ambiguous claim: %s", async (result) => {
    const rpcError = new Error("timeout");
    const deleteUser = vi.fn();
    const promise = bootstrapFirstSuperadmin({ email: "root@example.com", password: "correct horse", name: "Root", setupSecret }, bootstrapAdapter({ claimBootstrap: async () => { throw rpcError; }, reconcileBootstrap: async () => result, deleteUser }), setupSecret, now);
    if (result === "committed") await expect(promise).resolves.toEqual({ userId: "user-1" });
    else if (result === "not_committed") await expect(promise).rejects.toBe(rpcError);
    else await expect(promise).rejects.toMatchObject({ code: "manual_reconciliation_required" });
    expect(deleteUser).toHaveBeenCalledTimes(result === "not_committed" ? 1 : 0);
  });

  it("rejects a weak deployment setup secret", async () => {
    await expect(
      bootstrapFirstSuperadmin(
        { email: "root@example.com", password: "correct horse", name: "Root", setupSecret: "short" },
        bootstrapAdapter(),
        "short",
        now,
      ),
    ).rejects.toMatchObject({ code: "invalid_setup_secret" });
  });

  it("preserves a requested elevated invitation role through the Supabase adapter contract", async () => {
    invitationRpc.mockResolvedValueOnce({ data: "invite-1", error: null });
    const adapter = makeInvitationAdapter();
    await adapter.createInvitation({ email: "new@example.com", role: "developer_superadmin", tokenHash: "a".repeat(64), expiresAt: now, invitedBy: "root" });
    expect(invitationRpc).toHaveBeenCalledWith("create_admin_invitation", expect.objectContaining({ p_role: "developer_superadmin" }));
  });

  it("allows invitation creation only for a superadmin", async () => {
    const adapter = invitationAdapter({
      id: "invite-1",
      email: "new@example.com",
      role: "admin",
      tokenHash: "unused",
      expiresAt: new Date("2026-01-02T12:00:00.000Z"),
      acceptedAt: null,
    });

    await expect(createAdminInvitation(admin, { email: "new@example.com", role: "admin" }, adapter, now)).rejects.toMatchObject({ code: "forbidden" });
    await expect(createAdminInvitation(superadmin, { email: "new@example.com", role: "admin" }, adapter, now)).resolves.toMatchObject({ id: "invite-1", token: expect.any(String) });
  });

  it("cleans up the created auth user when invitation consumption loses its race", async () => {
    const deleteUser = vi.fn();
    const adapter = invitationAdapter({
      id: "invite-1",
      email: "new@example.com",
      role: "admin",
      tokenHash: hashToken("token"),
      expiresAt: new Date("2026-01-02T12:00:00.000Z"),
      acceptedAt: null,
    }, { consumeInvitation: async () => false, deleteUser });
    await expect(acceptInvitation({ id: "invite-1", token: "token", password: "correct horse", name: "New Admin" }, adapter, now)).rejects.toMatchObject({ code: "invalid_invitation" });
    expect(deleteUser).toHaveBeenCalledWith("user-2");
  });

  it.each(["committed", "not_committed", "unknown"] as ReconciliationResult[])("reconciles invitation consumption after an ambiguous call: %s", async (result) => {
    const rpcError = new Error("timeout");
    const deleteUser = vi.fn();
    const record = { id: "invite-1", email: "new@example.com", role: "admin" as const, tokenHash: hashToken("token"), expiresAt: new Date("2026-01-02T12:00:00.000Z"), acceptedAt: null };
    const promise = acceptInvitation({ id: record.id, token: "token", password: "correct horse", name: "New Admin" }, invitationAdapter(record, { consumeInvitation: async () => { throw rpcError; }, reconcileInvitation: async () => result, deleteUser }), now);
    if (result === "committed") await expect(promise).resolves.toEqual({ userId: "user-2" });
    else if (result === "not_committed") await expect(promise).rejects.toBe(rpcError);
    else await expect(promise).rejects.toMatchObject({ code: "manual_reconciliation_required" });
    expect(deleteUser).toHaveBeenCalledTimes(result === "not_committed" ? 1 : 0);
  });

  it("accepts a valid invitation once", async () => {
    const adapter = invitationAdapter({ id: "invite-1", email: "new@example.com", role: "admin", tokenHash: hashToken("token"), expiresAt: new Date("2026-01-02T12:00:00.000Z"), acceptedAt: null });
    await expect(acceptInvitation({ id: "invite-1", token: "token", password: "correct horse", name: "New Admin" }, adapter, now)).resolves.toEqual({ userId: "user-2" });
  });

  it.each([
    ["expired", new Date("2025-12-31T12:00:00.000Z"), null, "invitation_expired"],
    ["used", new Date("2026-01-02T12:00:00.000Z"), now, "invitation_used"],
  ])("rejects a %s invitation", async (_label, expiresAt, acceptedAt, code) => {
    const adapter = invitationAdapter({ id: "invite-1", email: "new@example.com", role: "admin", tokenHash: hashToken("token"), expiresAt, acceptedAt });
    await expect(acceptInvitation({ id: "invite-1", token: "token", password: "correct horse", name: "New Admin" }, adapter, now)).rejects.toMatchObject({ code });
  });
});
