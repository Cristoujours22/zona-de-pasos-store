import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { getBootstrapState } = vi.hoisted(() => ({ getBootstrapState: vi.fn() }));
vi.mock("@/lib/auth/adapters", () => ({
  makeBootstrapAdapter: () => ({ getBootstrapState }),
}));

import SetupPage, { dynamic } from "@/app/setup/page";

describe("setup page availability", () => {
  it("opts out of static generation so bootstrap state is checked per request", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("does not render the setup form after durable bootstrap completion", async () => {
    const previousSecret = process.env.SETUP_SECRET;
    process.env.SETUP_SECRET = "0123456789abcdef".repeat(4);
    getBootstrapState.mockResolvedValue({ completedAt: new Date("2026-01-01T12:00:00.000Z") });

    render(await SetupPage());
    if (previousSecret === undefined) delete process.env.SETUP_SECRET;
    else process.env.SETUP_SECRET = previousSecret;

    expect(screen.getByRole("status")).toHaveTextContent(/no está disponible/i);
    expect(screen.queryByRole("button", { name: /crear superadmin/i })).not.toBeInTheDocument();
  });
});
