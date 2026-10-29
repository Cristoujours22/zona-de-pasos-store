import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = "supabase/migrations";
const migrations = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(migrationsDirectory, file), "utf8"))
  .join("\n");

function finalInvitationConsumer(): string {
  const start = migrations.lastIndexOf("create or replace function public.consume_admin_invitation");
  const end = migrations.indexOf("\n$$;", start);
  return migrations.slice(start, end);
}

describe("administrator invitation acceptance migration", () => {
  it("locks the pending invitation and creates the profile before linking accepted_by", () => {
    const sql = finalInvitationConsumer();
    const profileInsert = sql.indexOf("insert into public.admin_profiles");
    const acceptedByUpdate = sql.indexOf("accepted_by = p_user_id");

    expect(sql).toMatch(/from public\.admin_invitations[\s\S]+for update/i);
    expect(profileInsert).toBeGreaterThanOrEqual(0);
    expect(acceptedByUpdate).toBeGreaterThanOrEqual(0);
    expect(profileInsert).toBeLessThan(acceptedByUpdate);
  });
});
