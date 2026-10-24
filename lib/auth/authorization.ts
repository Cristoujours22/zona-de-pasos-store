import type { AdminRole, AuthActor } from "@/types/auth";

export type AuthorizationCode = "unauthenticated" | "suspended" | "forbidden";

export class AuthorizationError extends Error {
  readonly code: AuthorizationCode;

  constructor(code: AuthorizationCode) {
    super(code);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

export function assertActiveAdmin(actor: AuthActor | null): AuthActor {
  if (!actor) throw new AuthorizationError("unauthenticated");
  if (actor.status !== "active") throw new AuthorizationError("suspended");
  if (!isAdminRole(actor.role)) throw new AuthorizationError("forbidden");
  return actor;
}

export function assertSuperadmin(actor: AuthActor | null): AuthActor {
  const active = assertActiveAdmin(actor);
  if (active.role !== "developer_superadmin") throw new AuthorizationError("forbidden");
  return active;
}

export function isAdminRole(role: string): role is AdminRole {
  return role === "admin" || role === "developer_superadmin";
}
