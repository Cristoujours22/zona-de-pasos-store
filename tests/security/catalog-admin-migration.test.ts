import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/202604020003_catalog_admin_workflows.sql", "utf8");
const baseMigration = readFileSync("supabase/migrations/202604020002_catalog_inventory.sql", "utf8");
const schema = `${baseMigration}\n${migration}`;

describe("catalog admin workflow migration", () => {
  it("keeps product creation atomic and authoritatively checks active admins", () => {
    expect(migration).toMatch(/create or replace function public\.create_product_atomic[\s\S]*?security definer set search_path = public/);
    expect(migration).toContain("if not private.is_active_admin(auth.uid()) then");
    expect(migration).toContain("insert into public.products");
    expect(migration).toContain("insert into public.product_images");
    expect(migration).toContain("insert into public.product_variants");
    expect(migration).toMatch(/grant execute on function public\.create_product_atomic[\s\S]*?to authenticated/);
  });

  it("does not expose Nequi or direct stock mutation grants", () => {
    expect(schema).toContain("revoke all on public.commerce_settings from anon, authenticated");
    expect(schema).toContain("revoke all on function public.adjust_inventory");
    expect(schema).toContain("grant execute on function public.adjust_inventory(uuid, integer, text, text) to authenticated");
    expect(schema).not.toMatch(/grant update [^;]*stock_quantity/);
  });

  it("preserves recoverable image metadata constraints", () => {
    expect(schema).toContain("cloudinary_public_id text not null");
    expect(schema).toContain("secure_url text not null check (secure_url like 'https://%')");
    expect(migration).toContain("zona-de-pasos/products/%");
  });
});
