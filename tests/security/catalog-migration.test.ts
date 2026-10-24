import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/202604020002_catalog_inventory.sql", "utf8");

describe("catalog and inventory migration security invariants", () => {
  it("adds the catalog, settings, image, and inventory tables with RLS", () => {
    for (const table of ["brands", "products", "product_variants", "product_images", "commerce_settings", "inventory_adjustments"]) {
      expect(migration).toMatch(new RegExp(`create table public\\.${table}\\b`));
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain("create type public.product_audience as enum");
    expect(migration).toContain("create type public.product_lifecycle as enum");
    expect(migration).toContain("create type public.stock_display_mode as enum");
  });

  it("keeps Cloudinary data public and excludes upload secrets", () => {
    expect(migration).toContain("cloudinary_public_id text not null");
    expect(migration).toContain("secure_url text not null");
    expect(migration).not.toMatch(/cloudinary_(api_key|api_secret|upload_preset)/i);
  });

  it("exposes only safe storefront settings through the public projection", () => {
    const projection = migration.match(/create or replace view public\.storefront_settings[\s\S]*?from public\.commerce_settings/i)?.[0] ?? "";
    expect(projection).toContain("whatsapp_phone");
    expect(projection).toContain("dispatch_origin_city");
    expect(projection).toContain("inventory_low_threshold");
    expect(projection).toContain("stock_display_mode");
    expect(projection).not.toMatch(/nequi|address|payment/i);
    expect(migration).toMatch(/grant select on public\.storefront_settings to anon, authenticated/);
    expect(migration).toMatch(/revoke all on public\.commerce_settings from anon, authenticated/);
  });

  it("allows active admins to create variants with initial stock without granting direct stock updates", () => {
    expect(migration).toContain("create policy variants_admin_insert on public.product_variants for insert to authenticated with check (private.is_active_admin((select auth.uid())));");
    expect(migration).toContain("grant insert (product_id, size, color, sku, active, stock_quantity) on public.product_variants to authenticated;");
    expect(migration).not.toMatch(/grant update [^;]*stock_quantity/);
  });

  it("protects stock changes behind an atomic, audited admin function", () => {
    expect(migration).toContain("private.is_active_admin(actor)");
    expect(migration).toContain("for update");
    expect(migration).toContain("if current_stock + p_delta < 0 then");
    expect(migration).toContain("insert into public.inventory_adjustments");
    expect(migration).toMatch(/adjust_inventory\([\s\S]*?security definer set search_path = public/);
    expect(migration).toMatch(/revoke all on function public\.adjust_inventory\([\s\S]*?grant execute on function public\.adjust_inventory/);
  });

  it("uses constrained COP prices, stock quantities, thresholds, and safe helper grants", () => {
    expect(migration).toContain("price_cop integer not null check (price_cop >= 0)");
    expect(migration).toContain("stock_quantity integer not null default 0 check (stock_quantity >= 0)");
    expect(migration).toContain("inventory_low_threshold integer not null default 3 check (inventory_low_threshold >= 0)");
    expect(migration).toContain("set search_path = public");
    expect(migration).toContain("private.is_active_admin");
    expect(migration).not.toContain("public.is_active_admin");
  });
});
