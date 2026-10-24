import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/202604020004_guest_orders.sql", "utf8");

describe("guest order migration security invariants", () => {
  it("stores statuses, delivery data, COP totals, snapshots, and no payment proof", () => {
    expect(migration).toContain("create type public.order_status as enum");
    expect(migration).toContain("pending_confirmation");
    expect(migration).toContain("awaiting_payment");
    expect(migration).toContain("payment_confirmed");
    expect(migration).toContain("preparing");
    expect(migration).toContain("shipped");
    expect(migration).toContain("delivered");
    expect(migration).toContain("canceled");
    for (const field of ["order_number", "idempotency_key", "buyer_full_name", "colombian_document_number", "phone", "department", "city_municipality", "address", "neighborhood", "delivery_instructions", "product_subtotal_cop", "shipping_cost_cop"]) expect(migration).toContain(field);
    for (const field of ["product_brand_name", "product_name", "variant_size", "variant_color", "variant_sku", "unit_price_cop", "requested_quantity", "line_total_cop"]) expect(migration).toContain(field);
    expect(migration).not.toMatch(/payment_proof|proof_url|proof_image/i);
  });

  it("protects orders and items with RLS and denies direct public table writes", () => {
    for (const table of ["orders", "order_items"]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`revoke all on public.${table} from anon, authenticated`);
      expect(migration).toMatch(new RegExp(`create policy .* on public\\.${table} for select to authenticated`));
    }
    expect(migration).not.toMatch(/grant (insert|update|delete)[^;]*public\.(orders|order_items)/i);
    expect(migration).toContain("revoke all on function public.create_guest_order_atomic");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toMatch(/grant execute on function public\.create_guest_order_atomic[\s\S]*to service_role/);
    expect(migration).not.toMatch(/grant execute on function public\.create_guest_order_atomic[^;]*to (public|anon|authenticated)/);
  });

  it("makes the public RPC security-definer, atomic, idempotent, and non-mutating for stock", () => {
    expect(migration).toMatch(/create or replace function public\.create_guest_order_atomic[\s\S]*?security definer set search_path = public/);
    expect(migration).toContain("on conflict (idempotency_key) do nothing");
    expect(migration).toContain("insert into public.orders");
    expect(migration).toContain("insert into public.order_items");
    expect(migration).toContain("v.active");
    expect(migration).toContain("p.lifecycle = 'published'");
    expect(migration).toContain("p.price_cop");
    expect(migration).toContain("v.stock_quantity");
    expect(migration).toContain("private.normalize_order_city");
    expect(migration).toContain("[[:space:]]+");
    expect(migration).toContain("orders_phone_created_at_idx");
    expect(migration).toContain("orders_document_created_at_idx");
    expect(migration).toContain("order_rate_limited");
    expect(migration).toContain("interval '15 minutes'");
    expect(migration).not.toMatch(/update public\.product_variants|insert into public\.inventory_adjustments/);
    expect(migration).toMatch(/revoke all on function public\.create_guest_order_atomic[\s\S]*grant execute on function public\.create_guest_order_atomic/);
  });

  it("serializes phone/document rate checks with ordered transaction locks after replay lookup", () => {
    const body = migration.slice(migration.indexOf("create or replace function public.create_guest_order_atomic"));
    const replay = body.indexOf("select * into existing_order from public.orders where idempotency_key");
    const phoneLock = body.indexOf("pg_advisory_xact_lock(hashtextextended('guest-order-phone:' || p_phone");
    const documentLock = body.indexOf("pg_advisory_xact_lock(hashtextextended('guest-order-document:' || p_colombian_document_number");
    const rateCount = body.indexOf("select count(*) from public.orders where created_at >= now() - interval '15 minutes'");
    const orderInsert = body.indexOf("insert into public.orders(");
    expect(phoneLock).toBeGreaterThan(replay);
    expect(documentLock).toBeGreaterThan(phoneLock);
    expect(rateCount).toBeGreaterThan(documentLock);
    expect(orderInsert).toBeGreaterThan(rateCount);
  });

  it("exposes no order lookup or sensitive public projection", () => {
    expect(migration).not.toMatch(/create (or replace )?view public\.(orders|order_items)/i);
    expect(migration).not.toMatch(/grant select on public\.(orders|order_items) to anon/);
    expect(migration).toContain("replayed boolean");
    expect(migration).toContain("item_summaries jsonb");
    expect(migration).toContain("jsonb_agg(jsonb_build_object");
    expect(migration).toContain("product_brand_name");
    expect(migration).toContain("delivery_type");
  });

  it("keeps SQL validation at least as strict as the route contract", () => {
    expect(migration).toMatch(/buyer_full_name[\s\S]*\[\[:cntrl:\]\]/);
    expect(migration).toMatch(/p_department[\s\S]*\[0-9\]/);
    expect(migration).toMatch(/p_city_municipality[\s\S]*\[0-9\]/);
    expect(migration).toMatch(/p_address[\s\S]*\[\[:cntrl:\]\]/);
    expect(migration).toMatch(/p_neighborhood[\s\S]*\[\[:cntrl:\]\]/);
    expect(migration).toMatch(/p_email[\s\S]*\[\^\[:space:\]@\]/);
    expect(migration).toMatch(/p_delivery_instructions[\s\S]*\[\[:cntrl:\]\]/);
    expect(migration).toContain("jsonb_typeof(item) <> 'object'");
    expect(migration).toContain("jsonb_typeof(item->'quantity') <> 'number'");
  });

  it("keeps the service-role client server-only and out of the route source", () => {
    const adminSource = readFileSync("lib/supabase/admin.ts", "utf8");
    const routeSource = readFileSync("app/api/orders/route.ts", "utf8");
    expect(adminSource).toContain('import "server-only"');
    expect(adminSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(routeSource).toContain("createSupabaseAdminClient");
    expect(routeSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(routeSource).not.toContain('"use client"');
  });
});
