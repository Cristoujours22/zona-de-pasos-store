import { NextResponse } from "next/server";

import { requireActiveAdmin } from "@/lib/auth/server";
import { catalogErrorResponse, readJson } from "@/lib/catalog/admin/route";
import { createCatalogAdminService } from "@/lib/catalog/admin/service";
import { createSupabaseCatalogAdminAdapter } from "@/lib/catalog/admin/supabase";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { client } = await requireActiveAdmin();
    const { id } = await context.params;
    const product = await createCatalogAdminService(createSupabaseCatalogAdminAdapter(client)).updateProduct(id, await readJson(request));
    return NextResponse.json(product);
  } catch (error) { return catalogErrorResponse(error); }
}
