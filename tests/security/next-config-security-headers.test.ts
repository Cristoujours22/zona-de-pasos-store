import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("Next.js security headers", () => {
  it("applies the security policy to every route", async () => {
    const routes = await nextConfig.headers?.();
    const globalRoute = routes?.find(({ source }) => source === "/(.*)");

    expect(globalRoute).toBeDefined();

    const headers = new Map(globalRoute?.headers.map(({ key, value }) => [key, value]));
    expect(headers.get("Content-Security-Policy")).toBe(
      "default-src 'self'; base-uri 'self'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://res.cloudinary.com; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'",
    );
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Permissions-Policy")).toBe(
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    );
  });
});
