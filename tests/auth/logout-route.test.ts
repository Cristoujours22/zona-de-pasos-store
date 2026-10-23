import { describe, expect, it, vi } from "vitest";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { signOut } }) }));

import { POST } from "@/app/api/auth/logout/route";

describe("logout route", () => {
  it("returns an error instead of redirecting when signOut fails", async () => {
    signOut.mockResolvedValueOnce({ error: { message: "network timeout" } });
    const response = await POST(new Request("https://store.example/api/auth/logout", { method: "POST" }));
    expect(response.status).toBe(500);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects only after signOut succeeds", async () => {
    signOut.mockResolvedValueOnce({ error: null });
    const response = await POST(new Request("https://store.example/api/auth/logout", { method: "POST" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://store.example/auth/login");
  });
});
