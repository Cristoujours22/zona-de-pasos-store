import { describe, expect, it } from "vitest";

import { assertActiveAdmin, assertSuperadmin, AuthorizationError } from "@/lib/auth/authorization";
import type { AuthActor } from "@/types/auth";

describe("administrative authorization", () => {
  it("rejects suspended users before role checks", () => {
    const suspended: AuthActor = { id: "root", role: "developer_superadmin", status: "suspended" };
    expect(() => assertActiveAdmin(suspended)).toThrowError(new AuthorizationError("suspended"));
  });

  it("rejects an ordinary administrator from superadmin actions", () => {
    const admin: AuthActor = { id: "admin", role: "admin", status: "active" };
    expect(() => assertSuperadmin(admin)).toThrowError(new AuthorizationError("forbidden"));
  });

  it("allows an active superadmin and administrator through their scopes", () => {
    const superadmin: AuthActor = { id: "root", role: "developer_superadmin", status: "active" };
    const admin: AuthActor = { id: "admin", role: "admin", status: "active" };
    expect(assertActiveAdmin(admin)).toEqual(admin);
    expect(assertSuperadmin(superadmin)).toEqual(superadmin);
  });
});
