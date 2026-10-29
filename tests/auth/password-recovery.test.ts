import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  exchangeCodeForSession,
  getUser,
  maybeSingle,
  resetPasswordForEmail,
  signOut,
  updateUser,
} = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      exchangeCodeForSession,
      getUser,
      resetPasswordForEmail,
      signOut,
      updateUser,
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    }),
  }),
}));

import { GET as callback } from "@/app/auth/callback/route";
import { POST as requestRecovery } from "@/app/api/auth/password/recovery/route";
import { POST as updatePassword } from "@/app/api/auth/password/update/route";

describe("administrator password recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "zona-de-pasos-store.vercel.app");
    resetPasswordForEmail.mockResolvedValue({ error: null });
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { id: "admin-1", role: "developer_superadmin", status: "active" }, error: null });
    updateUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
  });

  it("returns the same accepted response when Supabase rejects an unknown email", async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ error: new Error("User not found") });

    const response = await requestRecovery(new Request("https://attacker.example/api/auth/password/recovery", {
      method: "POST",
      body: JSON.stringify({ email: "missing@example.com" }),
    }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("missing@example.com", {
      redirectTo: "https://zona-de-pasos-store.vercel.app/auth/callback",
    });
  });

  it("falls back to the canonical production origin instead of trusting the request Host", async () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");

    const response = await requestRecovery(new Request("https://attacker.example/api/auth/password/recovery", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com" }),
    }));

    expect(response.status).toBe(202);
    expect(resetPasswordForEmail).toHaveBeenCalledWith("admin@example.com", {
      redirectTo: "https://zona-de-pasos-store.vercel.app/auth/callback",
    });
  });

  it("rejects malformed recovery input before calling Supabase", async () => {
    const response = await requestRecovery(new Request("https://zona-de-pasos-store.vercel.app/api/auth/password/recovery", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email" }),
    }));

    expect(response.status).toBe(400);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("redirects a valid recovery callback to the password update page", async () => {
    const response = await callback(new Request("https://zona-de-pasos-store.vercel.app/auth/callback?code=valid-code"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(response.headers.get("location")).toBe("https://zona-de-pasos-store.vercel.app/auth/update-password");
  });

  it("redirects missing or expired recovery callbacks to a generic login error", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: new Error("expired") });
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");

    const missing = await callback(new Request("https://attacker.example/auth/callback"));
    const expired = await callback(new Request("https://zona-de-pasos-store.vercel.app/auth/callback?code=expired-code"));

    expect(missing.headers.get("location")).toBe("https://zona-de-pasos-store.vercel.app/auth/login?recovery=invalid");
    expect(expired.headers.get("location")).toBe("https://zona-de-pasos-store.vercel.app/auth/login?recovery=invalid");
  });

  it("requires a recovery session before changing the password", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("missing session") });

    const response = await updatePassword(new Request("https://zona-de-pasos-store.vercel.app/api/auth/password/update", {
      method: "POST",
      body: JSON.stringify({ password: "a-secure-new-password" }),
    }));

    expect(response.status).toBe(401);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects weak passwords without changing the account", async () => {
    const response = await updatePassword(new Request("https://zona-de-pasos-store.vercel.app/api/auth/password/update", {
      method: "POST",
      body: JSON.stringify({ password: "too-short" }),
    }));

    expect(response.status).toBe(400);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ["missing profile", null],
    ["unexpected role", { id: "admin-1", role: "customer", status: "active" }],
  ])("rejects an administrator with %s", async (_label, profile) => {
    maybeSingle.mockResolvedValueOnce({ data: profile, error: null });

    const response = await updatePassword(new Request("https://zona-de-pasos-store.vercel.app/api/auth/password/update", {
      method: "POST",
      body: JSON.stringify({ password: "a-secure-new-password" }),
    }));

    expect(response.status).toBe(401);
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("rejects suspended administrators before changing the password", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: "admin-1", role: "admin", status: "suspended" }, error: null });

    const response = await updatePassword(new Request("https://zona-de-pasos-store.vercel.app/api/auth/password/update", {
      method: "POST",
      body: JSON.stringify({ password: "a-secure-new-password" }),
    }));

    expect(response.status).toBe(403);
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it.each([12, 128])("accepts a password at the %i-character boundary", async (length) => {
    const password = "x".repeat(length);
    const response = await updatePassword(new Request("https://zona-de-pasos-store.vercel.app/api/auth/password/update", {
      method: "POST",
      body: JSON.stringify({ password }),
    }));

    expect(response.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({ password });
  });

  it.each([11, 129])("rejects a password outside the boundary at %i characters", async (length) => {
    const response = await updatePassword(new Request("https://zona-de-pasos-store.vercel.app/api/auth/password/update", {
      method: "POST",
      body: JSON.stringify({ password: "x".repeat(length) }),
    }));

    expect(response.status).toBe(400);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("reports a committed password update when global session invalidation fails", async () => {
    signOut.mockResolvedValueOnce({ error: new Error("network failure") });
    const response = await updatePassword(new Request("https://zona-de-pasos-store.vercel.app/api/auth/password/update", {
      method: "POST",
      body: JSON.stringify({ password: "a-secure-new-password" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, passwordUpdated: true, sessionsInvalidated: false });
  });

  it("updates a valid active administrator password and invalidates all sessions", async () => {
    const response = await updatePassword(new Request("https://zona-de-pasos-store.vercel.app/api/auth/password/update", {
      method: "POST",
      body: JSON.stringify({ password: "a-secure-new-password" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, passwordUpdated: true, sessionsInvalidated: true });
    expect(updateUser).toHaveBeenCalledWith({ password: "a-secure-new-password" });
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
  });
});
