import { NextResponse } from "next/server";

import { makeInvitationAdapter } from "@/lib/auth/adapters";
import { acceptInvitation, AuthDomainError } from "@/lib/auth/domain";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await acceptInvitation({ id: body.id, token: body.token, password: body.password, name: body.name }, makeInvitationAdapter());
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthDomainError) {
      const status = error.code === "invitation_used" || error.code === "invitation_expired" ? 410 : 400;
      return NextResponse.json({ error: error.code }, { status });
    }
    return NextResponse.json({ error: "Unable to accept invitation" }, { status: 500 });
  }
}
