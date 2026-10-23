import { NextResponse } from "next/server";

import { makeBootstrapAdapter } from "@/lib/auth/adapters";
import { AuthDomainError, bootstrapFirstSuperadmin } from "@/lib/auth/domain";
import { isHighEntropySetupSecret } from "@/lib/validation/auth";

function statusFor(code: string): number {
  if (code === "invalid_setup_secret" || code === "bootstrap_completed" || code === "invalid_input") return 400;
  return 409;
}

export async function POST(request: Request) {
  const expectedSecret = process.env.SETUP_SECRET;
  if (!expectedSecret || !isHighEntropySetupSecret(expectedSecret)) return NextResponse.json({ error: "Setup is not securely configured" }, { status: 503 });
  try {
    const body = await request.json();
    const result = await bootstrapFirstSuperadmin({ email: body.email, password: body.password, name: body.name, setupSecret: body.setupSecret }, makeBootstrapAdapter(), expectedSecret);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthDomainError) return NextResponse.json({ error: error.code }, { status: statusFor(error.code) });
    return NextResponse.json({ error: "Unable to complete setup" }, { status: 500 });
  }
}
