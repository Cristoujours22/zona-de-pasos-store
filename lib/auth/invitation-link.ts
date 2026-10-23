export function buildInvitationUrl(origin: string, invitationId: string, token: string): string {
  const url = new URL("/auth/invite", origin);
  url.searchParams.set("id", invitationId);
  url.hash = `token=${encodeURIComponent(token)}`;
  return url.toString();
}
