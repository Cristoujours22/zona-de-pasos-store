import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createTrackingToken, parseTrackingToken, trackingPath } from "@/lib/orders/tracking";

const secret = "a".repeat(64);
const orderId = "11111111-1111-4111-8111-111111111111";

describe("opaque public order tracking tokens", () => {
  it("creates a stable signed token and validates only the intended order", () => {
    const first = createTrackingToken(orderId, secret);
    expect(createTrackingToken(orderId, secret)).toBe(first);
    expect(first).not.toContain(secret);
    expect(parseTrackingToken(first, secret)).toBe(orderId);
    expect(trackingPath(first)).toBe(`/track/${first}`);
  });

  it("rejects tampering, wrong secrets, malformed UUIDs, and weak secrets", () => {
    const token = createTrackingToken(orderId, secret);
    expect(parseTrackingToken(`${token.slice(0, -1)}x`, secret)).toBeNull();
    expect(parseTrackingToken(token, "b".repeat(64))).toBeNull();
    expect(() => createTrackingToken("not-a-uuid", secret)).toThrow();
    expect(() => createTrackingToken(orderId, "weak")).toThrow();
    expect(() => trackingPath("../admin")).toThrow();
  });
});
