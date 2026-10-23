import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/202604020005_order_operations.sql"), "utf8");

describe("order operations migration", () => {
  it("adds configurable carriers, payment provenance, shipment data, and status history", () => {
    expect(sql).toContain("create table public.commerce_carriers");
    expect(sql).toMatch(/payment_confirmed_by uuid references public\.admin_profiles/i);
    expect(sql).toMatch(/payment_confirmed_at timestamptz/i);
    expect(sql).toMatch(/payment_confirmed_amount_cop bigint/i);
    expect(sql).toMatch(/payment_internal_note text/i);
    expect(sql).toContain("tracking_url_template ~ '^https://[^/?#@[:space:]]+([/?#]|$)'");
    expect(sql).toMatch(/carrier_name_snapshot text/i);
    expect(sql).toMatch(/tracking_number text/i);
    expect(sql).toMatch(/tracking_url text/i);
    expect(sql).toContain("create table public.order_status_history");
  });

  it("keeps mutations behind authenticated security-definer RPCs and active-admin checks", () => {
    for (const name of ["admin_transition_order", "admin_confirm_order_payment", "admin_update_order_shipping", "admin_cancel_order", "admin_upsert_carrier"]) {
      expect(sql).toContain(`function public.${name}`);
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${name}[^;]+from public, anon, authenticated`, "i"));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${name}[^;]+to authenticated`, "i"));
    }
    expect(sql).toContain("private.is_active_admin(actor)");
    expect(sql).not.toMatch(/grant update[^;]+orders[^;]+to authenticated/i);
  });

  it("locks rows, enforces optimistic concurrency and legal transitions, and never adjusts inventory", () => {
    expect(sql).toMatch(/from public\.orders[\s\S]+for update/i);
    expect(sql).toContain("order_version_conflict");
    expect(sql).toContain("invalid_order_transition");
    expect(sql).toContain("payment_amount_mismatch");
    expect(sql).toContain("shipping_details_required");
    expect(sql).not.toMatch(/update public\.product_variants[\s\S]+stock_quantity/i);
    expect(sql).not.toMatch(/insert into public\.inventory_adjustments/i);
  });

  it("records actor-bound history and audit metadata without buyer PII", () => {
    expect(sql).toMatch(/insert into public\.order_status_history/i);
    expect(sql).toMatch(/insert into public\.audit_events/i);
    expect(sql).toMatch(/order_status_changed/);
    expect(sql).toMatch(/order_payment_confirmed/);
    expect(sql).toMatch(/order_shipping_updated/);
    expect(sql).toMatch(/order_canceled/);
    for (const pii of ["buyer_full_name", "colombian_document_number", "address", "email", "phone"]) {
      expect(sql).not.toMatch(new RegExp(`jsonb_build_object\\([^;]+${pii}`, "i"));
    }
  });

  it("requires shipping before shipment and keeps canceled/delivered orders terminal", () => {
    expect(sql).toMatch(/current_order\.status = 'preparing'[\s\S]+p_to_status = 'shipped'/i);
    expect(sql).toMatch(/current_order\.carrier_id is null[\s\S]+tracking_number is null/i);
    expect(sql).toMatch(/current_order\.status in \('delivered', 'canceled'\)/i);
  });
});
