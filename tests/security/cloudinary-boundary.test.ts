import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const serverConfig = readFileSync("lib/cloudinary/config.ts", "utf8");
const serverAdapter = readFileSync("lib/cloudinary/adapter.ts", "utf8");
const pureBoundary = readFileSync("lib/catalog/image-upload.ts", "utf8");
const uploadRoute = readFileSync("app/api/admin/product-images/route.ts", "utf8");

describe("Cloudinary secret boundary", () => {
  it("keeps credentials in server-only modules and never in public env names", () => {
    expect(serverConfig).toContain('import "server-only"');
    expect(serverAdapter).toContain('import "server-only"');
    expect(serverConfig).toContain("CLOUDINARY_API_SECRET");
    expect(serverConfig).not.toContain("NEXT_PUBLIC_CLOUDINARY");
    expect(pureBoundary).not.toContain("CLOUDINARY_API_SECRET");
    expect(uploadRoute).not.toContain("CLOUDINARY_API_SECRET");
    expect(uploadRoute).not.toContain("process.env");
  });

  it("does not expose credentials through route responses or logging", () => {
    expect(uploadRoute).not.toMatch(/console\.(log|error|warn).*secret/i);
    expect(uploadRoute).not.toContain("api_secret");
  });
});
