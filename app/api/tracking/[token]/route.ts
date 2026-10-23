import { NextResponse } from "next/server";

import { getPublicOrderTracking, TrackingNotFoundError, TrackingPersistenceError } from "@/lib/orders/tracking-supabase";
import { parseTrackingToken, readTrackingSecret, TrackingConfigurationError } from "@/lib/orders/tracking";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const secret = readTrackingSecret();
    const { token } = await params;
    const orderId = parseTrackingToken(token, secret);
    if (!orderId) return NextResponse.json({ error: "Seguimiento no encontrado." }, { status: 404 });
    return NextResponse.json(await getPublicOrderTracking(createSupabaseAdminClient(), orderId));
  } catch (error) {
    if (error instanceof TrackingConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof TrackingNotFoundError) return NextResponse.json({ error: "Seguimiento no encontrado." }, { status: 404 });
    if (error instanceof TrackingPersistenceError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: "No fue posible consultar el seguimiento." }, { status: 503 });
  }
}
