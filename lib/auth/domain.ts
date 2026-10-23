import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { assertSuperadmin, type AuthorizationCode } from "@/lib/auth/authorization";
import { isHighEntropySetupSecret } from "@/lib/validation/auth";
import type { AdminRole, AuthActor, InvitationRecord } from "@/types/auth";

export type AuthErrorCode = AuthorizationCode | "invalid_setup_secret" | "bootstrap_completed" | "invalid_input" | "bootstrap_race" | "invalid_invitation" | "invitation_expired" | "invitation_used";

export class AuthDomainError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    super(code);
    this.name = "AuthDomainError";
    this.code = code;
  }
}

export interface BootstrapAdapter {
  getBootstrapState(): Promise<{ completedAt: Date | null } | null>;
  createUser(input: { email: string; password: string; name: string; role: AdminRole }): Promise<{ userId: string }>;
  claimBootstrap(input: { userId: string; email: string; name: string; now: Date }): Promise<boolean>;
  deleteUser(userId: string): Promise<void>;
}

export interface InvitationAdapter {
  createInvitation(input: { email: string; role: AdminRole; tokenHash: string; expiresAt: Date; invitedBy: string }): Promise<{ id: string }>;
  getInvitation(id: string): Promise<InvitationRecord | null>;
  createUser(input: { email: string; password: string; name: string; role: AdminRole }): Promise<{ userId: string }>;
  consumeInvitation(input: { id: string; tokenHash: string; userId: string; name: string; now: Date }): Promise<boolean>;
  deleteUser(userId: string): Promise<void>;
}

export function isBootstrapAvailable(state: { completedAt: Date | null } | null): boolean {
  return state !== null && state.completedAt === null;
}

function sameSecret(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function cleanEmail(email: string): string {
  return email.trim().toLowerCase();
}

function requireCredentials(email: string, password: string, name: string): void {
  if (!email.includes("@") || password.length < 12 || name.trim().length < 2) throw new AuthDomainError("invalid_input");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function equalToken(actual: string, expectedHash: string): boolean {
  const actualHash = Buffer.from(hashToken(actual), "hex");
  const storedHash = Buffer.from(expectedHash, "hex");
  return actualHash.length === storedHash.length && timingSafeEqual(actualHash, storedHash);
}

export async function bootstrapFirstSuperadmin(input: { email: string; password: string; name: string; setupSecret: string }, adapter: BootstrapAdapter, expectedSecret: string, now = new Date()): Promise<{ userId: string }> {
  if (!isHighEntropySetupSecret(expectedSecret) || typeof input.setupSecret !== "string" || !sameSecret(input.setupSecret, expectedSecret)) throw new AuthDomainError("invalid_setup_secret");
  requireCredentials(input.email, input.password, input.name);
  const state = await adapter.getBootstrapState();
  if (state?.completedAt) throw new AuthDomainError("bootstrap_completed");

  const email = cleanEmail(input.email);
  const created = await adapter.createUser({ email, password: input.password, name: input.name.trim(), role: "developer_superadmin" });
  try {
    const claimed = await adapter.claimBootstrap({ userId: created.userId, email, name: input.name.trim(), now });
    if (claimed) return created;
    throw new AuthDomainError("bootstrap_race");
  } catch (error) {
    await adapter.deleteUser(created.userId);
    throw error;
  }
}

export async function createAdminInvitation(actor: AuthActor, input: { email: string; role: AdminRole }, adapter: Pick<InvitationAdapter, "createInvitation">, now = new Date()): Promise<{ id: string; token: string; expiresAt: Date }> {
  assertSuperadmin(actor);
  const email = cleanEmail(input.email);
  if (!email.includes("@") || (input.role !== "admin" && input.role !== "developer_superadmin")) throw new AuthDomainError("invalid_input");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const invitation = await adapter.createInvitation({ email, role: input.role, tokenHash: hashToken(token), expiresAt, invitedBy: actor.id });
  return { ...invitation, token, expiresAt };
}

export async function acceptInvitation(input: { id: string; token: string; password: string; name: string }, adapter: InvitationAdapter, now = new Date()): Promise<{ userId: string }> {
  if (!input.id || !input.token) throw new AuthDomainError("invalid_invitation");
  const invitation = await adapter.getInvitation(input.id);
  if (!invitation || !equalToken(input.token, invitation.tokenHash)) throw new AuthDomainError("invalid_invitation");
  if (invitation.acceptedAt) throw new AuthDomainError("invitation_used");
  if (invitation.expiresAt <= now) throw new AuthDomainError("invitation_expired");
  requireCredentials(invitation.email, input.password, input.name);

  const created = await adapter.createUser({ email: invitation.email, password: input.password, name: input.name.trim(), role: invitation.role });
  try {
    const consumed = await adapter.consumeInvitation({ id: invitation.id, tokenHash: invitation.tokenHash, userId: created.userId, name: input.name.trim(), now });
    if (consumed) return created;
    throw new AuthDomainError("invalid_invitation");
  } catch (error) {
    await adapter.deleteUser(created.userId);
    throw error;
  }
}

export { hashToken };
