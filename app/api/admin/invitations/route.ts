import { NextResponse } from "next/server";

import { makeInvitationAdapter } from "@/lib/auth/adapters";
import { AuthDomainError, createAdminInvitation } from "@/lib/auth/domain";
import { buildInvitationUrl } from "@/lib/auth/invitation-link";
import { AuthorizationError } from "@/lib/auth/authorization";
import { requireSuperadmin } from "@/lib/auth/server";

export async function POST(request: Request) {
  try {
    const { actor } = await requireSuperadmin();
    const body = await request.json();
    const invitation = await createAdminInvitation(actor, { email: body.email, role: body.role ?? "admin" }, makeInvitationAdapter());
    return NextResponse.json({ id: invitation.id, expiresAt: invitation.expiresAt, path: buildInvitationUrl(new URL(request.url).origin, invitation.id, invitation.token) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthDomainError) return NextResponse.json({ error: error.code }, { status: 400 });
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.code }, { status: error.code === "unauthenticated" ? 401 : 403 });
    return NextResponse.json({ error: "Unable to create invitation" }, { status: 500 });
  }
}
