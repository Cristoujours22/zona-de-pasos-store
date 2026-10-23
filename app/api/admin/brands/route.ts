import { NextResponse } from "next/server";

import { requireActiveAdmin } from "@/lib/auth/server";
import { catalogErrorResponse, readJson } from "@/lib/catalog/admin/route";
import { createCatalogAdminService } from "@/lib/catalog/admin/service";
import { createSupabaseCatalogAdminAdapter } from "@/lib/catalog/admin/supabase";

export async function GET() {
  try {
    const { client } = await requireActiveAdmin();
    const brands = await createCatalogAdminService(createSupabaseCatalogAdminAdapter(client)).listBrands();
    return NextResponse.json(brands);
  } catch (error) { return catalogErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { client } = await requireActiveAdmin();
    const brand = await createCatalogAdminService(createSupabaseCatalogAdminAdapter(client)).createBrand(await readJson(request));
    return NextResponse.json(brand, { status: 201 });
  } catch (error) { return catalogErrorResponse(error); }
}
