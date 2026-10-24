import { NextResponse } from "next/server";

import { authErrorStatus } from "@/lib/auth/server";
import { AuthorizationError } from "@/lib/auth/authorization";
import { CatalogAdminError } from "@/lib/catalog/admin/service";

export function catalogErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthorizationError) {
    const status = authErrorStatus(error);
    const message = status === 401 ? "Debes iniciar sesión para administrar el catálogo." : error.code === "suspended" ? "Tu cuenta está suspendida." : "No tienes permisos para administrar el catálogo.";
    return NextResponse.json({ error: message }, { status });
  }
  if (error instanceof CatalogAdminError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: "No fue posible completar la operación. Intenta de nuevo." }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { throw new CatalogAdminError("invalid_request", "La solicitud no es válida."); }
}
