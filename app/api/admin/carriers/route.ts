import { NextResponse } from "next/server";

import { requireActiveAdmin } from "@/lib/auth/server";
import { orderAdminErrorResponse, readJson } from "@/lib/orders/admin/route";
import { createOrderAdminService } from "@/lib/orders/admin/service";
import { createSupabaseOrderAdminAdapter } from "@/lib/orders/admin/supabase";

export async function GET() {
  try {
    const { client } = await requireActiveAdmin();
    return NextResponse.json(await createOrderAdminService(createSupabaseOrderAdminAdapter(client)).listCarriers());
  } catch (error) { return orderAdminErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { client } = await requireActiveAdmin();
    return NextResponse.json(await createOrderAdminService(createSupabaseOrderAdminAdapter(client)).createCarrier(await readJson(request)), { status: 201 });
  } catch (error) { return orderAdminErrorResponse(error); }
}
