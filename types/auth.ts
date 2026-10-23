export type AdminRole = "developer_superadmin" | "admin";
export type AccountStatus = "active" | "suspended";

export interface AuthActor {
  id: string;
  role: AdminRole;
  status: AccountStatus;
}

export interface InvitationRecord {
  id: string;
  email: string;
  role: AdminRole;
  tokenHash: string;
  expiresAt: Date;
  acceptedAt: Date | null;
}
