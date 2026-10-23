import { describe, expect, it } from "vitest";

import { buildInvitationUrl } from "@/lib/auth/invitation-link";

describe("invitation links", () => {
  it("keeps the bearer token in the URL fragment, never the query string", () => {
    const result = new URL(buildInvitationUrl("https://store.example", "invite-1", "token/secret"));

    expect(result.searchParams.get("id")).toBe("invite-1");
    expect(result.searchParams.has("token")).toBe(false);
    expect(result.hash).toBe("#token=token%2Fsecret");
  });
});
