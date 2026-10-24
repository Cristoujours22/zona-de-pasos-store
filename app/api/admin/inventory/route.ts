import { NextResponse } from "next/server";

import { requireActiveAdmin } from "@/lib/auth/server";
import { catalogErrorResponse, readJson } from "@/lib/catalog/admin/route";
import { createCatalogAdminService } from "@/lib/catalog/admin/service";
import { createSupabaseCatalogAdminAdapter } from "@/lib/catalog/admin/supabase";

export async function POST(request: Request) {
  try {
    const { client } = await requireActiveAdmin();
    const result = await createCatalogAdminService(createSupabaseCatalogAdminAdapter(client)).adjustInventory(await readJson(request));
    return NextResponse.json(result);
  } catch (error) { return catalogErrorResponse(error); }
}
