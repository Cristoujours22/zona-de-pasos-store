import { NextResponse } from "next/server";

import {
  buildWhatsAppHandoff,
  OrderConflictError,
  OrderInputError,
  OrderPersistenceError,
  OrderRateLimitError,
  OrderWhatsAppNotConfiguredError,
  parseGuestOrderInput,
} from "@/lib/orders/domain";
import { createSupabaseGuestOrderAdapter, getPublicWhatsappPhone } from "@/lib/orders/supabase";
import { createTrackingToken, readTrackingSecret, trackingPath, TrackingConfigurationError } from "@/lib/orders/tracking";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { normalizeWhatsappPhone } from "@/lib/storefront/support";

function errorResponse(error: unknown): NextResponse {
  if (error instanceof OrderInputError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof OrderConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof OrderWhatsAppNotConfiguredError) return NextResponse.json({ error: error.message }, { status: 503 });
  if (error instanceof TrackingConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
  if (error instanceof OrderRateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
  if (error instanceof OrderPersistenceError) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ error: "No fue posible confirmar el pedido. Intenta de nuevo." }, { status: 503 });
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try { body = await request.json(); } catch { throw new OrderInputError(); }
    const input = parseGuestOrderInput(body);
    const trackingSecret = readTrackingSecret();
    const publicClient = createSupabasePublicClient();
    const phone = await getPublicWhatsappPhone(publicClient);
    if (!normalizeWhatsappPhone(phone)) throw new OrderWhatsAppNotConfiguredError();
    const orderAdapter = createSupabaseGuestOrderAdapter(createSupabaseAdminClient());
    const order = await orderAdapter.createOrder(input);
    const path = trackingPath(createTrackingToken(order.id, trackingSecret));
    const publicTrackingUrl = new URL(path, request.url).toString();
    return NextResponse.json({ order, whatsapp: buildWhatsAppHandoff(phone, order, publicTrackingUrl), tracking: { path } }, { status: order.replayed ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
