import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/202604020006_database_lint_corrections.sql"), "utf8");

describe("deployed database lint corrections", () => {
  it("removes the unused bootstrap claim variable without weakening the atomic update gate", () => {
    expect(sql).toContain("create or replace function public.claim_bootstrap");
    expect(sql).not.toMatch(/declare\s+claimed boolean/i);
    expect(sql).toMatch(/update public\.bootstrap_state[\s\S]+if not found then return false/i);
  });

  it("avoids output-parameter shadowing and casts delivery enum assignments explicitly", () => {
    expect(sql).toContain("create or replace function public.create_guest_order_atomic");
    expect(sql).toContain("result_item_summaries jsonb := '[]'::jsonb");
    expect(sql).not.toMatch(/\n\s*item_summaries jsonb :=/i);
    expect(sql).toContain("'local'::public.delivery_type");
    expect(sql).toContain("'national'::public.delivery_type");
  });

  it("preserves service-role-only guest-order execution", () => {
    expect(sql).toMatch(/revoke all on function public\.create_guest_order_atomic[^;]+from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.create_guest_order_atomic[^;]+to service_role/i);
  });
});
