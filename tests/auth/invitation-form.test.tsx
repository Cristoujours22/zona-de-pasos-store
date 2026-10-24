import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvitationForm } from "@/app/auth/invite/invitation-form";

const token = "bearer-token-that-must-not-be-visible";

describe("invitation form URL handling", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", `/auth/invite?id=invite-1#token=${encodeURIComponent(token)}`);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("scrubs the token from the visible URL and retains it only for submission", async () => {
    render(<InvitationForm />);

    await waitFor(() => expect(window.location.href).toBe("http://localhost:3000/auth/invite?id=invite-1"));
    expect(window.location.href).not.toContain(token);
    expect(document.body.textContent).not.toContain(token);

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "New Admin" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "correct horse" } });
    fireEvent.click(screen.getByRole("button", { name: /aceptar invitación/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(options?.body))).toMatchObject({ id: "invite-1", token });
  });
});
