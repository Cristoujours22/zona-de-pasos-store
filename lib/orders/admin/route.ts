import { NextResponse } from "next/server";

import { authErrorStatus } from "@/lib/auth/server";
import { OrderAdminError } from "@/lib/orders/admin/domain";

export async function readJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { throw new OrderAdminError("invalid_request", "La solicitud no contiene JSON válido."); }
}

export function orderAdminErrorResponse(error: unknown): NextResponse {
  if (error instanceof OrderAdminError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  const authStatus = authErrorStatus(error);
  if (authStatus === 401) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  if (authStatus === 403) return NextResponse.json({ error: "No tienes permisos para esta operación." }, { status: 403 });
  return NextResponse.json({ error: "No fue posible completar la operación." }, { status: 500 });
}
