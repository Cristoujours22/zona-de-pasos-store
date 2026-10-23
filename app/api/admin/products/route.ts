import { NextResponse } from "next/server";

import { requireActiveAdmin } from "@/lib/auth/server";
import { catalogErrorResponse, readJson } from "@/lib/catalog/admin/route";
import { createCatalogAdminService } from "@/lib/catalog/admin/service";
import { createSupabaseCatalogAdminAdapter } from "@/lib/catalog/admin/supabase";

export async function GET() {
  try {
    const { client } = await requireActiveAdmin();
    const products = await createCatalogAdminService(createSupabaseCatalogAdminAdapter(client)).listProducts();
    return NextResponse.json(products);
  } catch (error) { return catalogErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { client } = await requireActiveAdmin();
    const product = await createCatalogAdminService(createSupabaseCatalogAdminAdapter(client)).createProduct(await readJson(request));
    return NextResponse.json(product, { status: 201 });
  } catch (error) { return catalogErrorResponse(error); }
}
