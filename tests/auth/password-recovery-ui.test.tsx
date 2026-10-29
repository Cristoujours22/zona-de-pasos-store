import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { RecoveryForm } from "@/app/auth/forgot-password/recovery-form";
import { metadata as invitationMetadata } from "@/app/auth/invite/page";
import { LoginForm } from "@/app/auth/login/login-form";
import { UpdatePasswordForm } from "@/app/auth/update-password/update-password-form";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("administrator password recovery UI", () => {
  it("marks private invitation acceptance as non-indexable", () => {
    expect(invitationMetadata.robots).toEqual({ index: false, follow: false, noarchive: true });
  });

  it("keeps recovery outside public navigation but links it from the admin login form", () => {
    render(<LoginForm />);
    expect(screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" })).toHaveAttribute("href", "/auth/forgot-password");
  });

  it("shows the same neutral recovery confirmation after an accepted request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<RecoveryForm />);

    fireEvent.change(screen.getByLabelText("Correo administrativo"), { target: { value: "admin@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Si la cuenta existe"));
  });

  it("does not submit mismatched passwords", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<UpdatePasswordForm />);

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "a-secure-new-password" } });
    fireEvent.change(screen.getByLabelText("Confirma la contraseña"), { target: { value: "a-different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar contraseña" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Las contraseñas no coinciden");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns to login after a successful password update", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessionsInvalidated: true }) }));
    render(<UpdatePasswordForm />);

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "a-secure-new-password" } });
    fireEvent.change(screen.getByLabelText("Confirma la contraseña"), { target: { value: "a-secure-new-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar contraseña" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/auth/login?recovery=updated"));
  });

  it("warns when the password changed but global session invalidation failed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessionsInvalidated: false }) }));
    render(<UpdatePasswordForm />);
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "a-secure-new-password" } });
    fireEvent.change(screen.getByLabelText("Confirma la contraseña"), { target: { value: "a-secure-new-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar contraseña" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/auth/login?recovery=updated-sessions-pending"));
  });
});
