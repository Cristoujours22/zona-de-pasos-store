import { NextResponse } from "next/server";

import { requireActiveAdmin } from "@/lib/auth/server";
import { orderAdminErrorResponse } from "@/lib/orders/admin/route";
import { createOrderAdminService } from "@/lib/orders/admin/service";
import { createSupabaseOrderAdminAdapter } from "@/lib/orders/admin/supabase";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { client } = await requireActiveAdmin();
    const { id } = await params;
    return NextResponse.json(await createOrderAdminService(createSupabaseOrderAdminAdapter(client)).getOrder(id));
  } catch (error) { return orderAdminErrorResponse(error); }
}
