import { NextResponse } from "next/server";

import { requireActiveAdmin } from "@/lib/auth/server";
import { catalogErrorResponse, readJson } from "@/lib/catalog/admin/route";
import { createCatalogAdminService } from "@/lib/catalog/admin/service";
import { createSupabaseCatalogAdminAdapter } from "@/lib/catalog/admin/supabase";

export async function GET() {
  try {
    const { client } = await requireActiveAdmin();
    const settings = await createCatalogAdminService(createSupabaseCatalogAdminAdapter(client)).getSettings();
    return NextResponse.json(settings);
  } catch (error) { return catalogErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const { client } = await requireActiveAdmin();
    const settings = await createCatalogAdminService(createSupabaseCatalogAdminAdapter(client)).updateSettings(await readJson(request));
    return NextResponse.json(settings);
  } catch (error) { return catalogErrorResponse(error); }
}
