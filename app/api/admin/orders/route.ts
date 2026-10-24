import { NextResponse } from "next/server";

import { requireActiveAdmin } from "@/lib/auth/server";
import { orderAdminErrorResponse } from "@/lib/orders/admin/route";
import { createOrderAdminService } from "@/lib/orders/admin/service";
import { createSupabaseOrderAdminAdapter } from "@/lib/orders/admin/supabase";

export async function GET() {
  try {
    const { client } = await requireActiveAdmin();
    return NextResponse.json(await createOrderAdminService(createSupabaseOrderAdminAdapter(client)).listOrders());
  } catch (error) { return orderAdminErrorResponse(error); }
}
