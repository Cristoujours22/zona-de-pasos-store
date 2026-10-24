import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsAdmin } from "@/components/admin/settings/settings-admin";

const initialSettings = {
  whatsappPhone: "+57 300 123 4567",
  nequiDetails: "Nequi 3001234567 · Zona de pasos",
  dispatchOriginCity: "Bogotá",
  dispatchOriginAddress: "Calle 10 # 20-30",
  inventoryLowThreshold: 3,
  stockDisplayMode: "detailed" as const,
};

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("admin settings dashboard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/settings" && init?.method === "PATCH") return Promise.resolve(jsonResponse({ ...initialSettings, whatsappPhone: "+57 311 999 0000", inventoryLowThreshold: 4 }));
      if (String(input) === "/api/admin/settings") return Promise.resolve(jsonResponse(initialSettings));
      return Promise.reject(new Error("unexpected request"));
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("loads editable settings and explains local delivery using the configured city", async () => {
    render(<SettingsAdmin />);

    expect(screen.getByText("Cargando configuración…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByDisplayValue("+57 300 123 4567")).toBeInTheDocument());
    expect(screen.getByText(/La entrega local aplica cuando la ciudad de destino coincide con Bogotá/)).toBeInTheDocument();
    expect(screen.getByLabelText("Umbral de pocas unidades")).toHaveValue(3);
  });

  it("saves settings and retains entered values when the server rejects the update", async () => {
    render(<SettingsAdmin />);
    await waitFor(() => expect(screen.getByDisplayValue("+57 300 123 4567")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "+57 311 999 0000" } });
    fireEvent.change(screen.getByLabelText("Umbral de pocas unidades"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
    await waitFor(() => expect(screen.getByText("Configuración guardada correctamente.")).toBeInTheDocument());
    expect(screen.getByDisplayValue("+57 311 999 0000")).toBeInTheDocument();

    vi.mocked(fetch).mockImplementationOnce(() => Promise.resolve(jsonResponse({ error: "No fue posible guardar los cambios." }, false)));
    fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "+57 322 111 2222" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No fue posible guardar los cambios."));
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("+57 322 111 2222");
  });

  it("validates required values and nonnegative integer thresholds before saving", async () => {
    render(<SettingsAdmin />);
    await waitFor(() => expect(screen.getByDisplayValue("+57 300 123 4567")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
    expect(screen.getByRole("alert")).toHaveTextContent("El WhatsApp es obligatorio.");
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);

    cleanup();
    render(<SettingsAdmin />);
    await waitFor(() => expect(screen.getByDisplayValue("+57 300 123 4567")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Umbral de pocas unidades"), { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("El umbral debe ser un entero no negativo."));
  });

  it("previews detailed, availability-only, and hidden modes", async () => {
    render(<SettingsAdmin />);
    await waitFor(() => expect(screen.getByDisplayValue("+57 300 123 4567")).toBeInTheDocument());

    expect(screen.getByRole("option", { name: "Detallado: muestra Disponible, Pocas unidades o Sin stock" })).toBeInTheDocument();
    expect(screen.getByTestId("stock-preview-detailed")).toHaveTextContent("Pocas unidades");
    expect(screen.getByTestId("stock-preview-detailed")).not.toHaveTextContent("3 unidades");
    fireEvent.change(screen.getByLabelText("Modo de visibilidad de existencias"), { target: { value: "availability_only" } });
    expect(screen.getByTestId("stock-preview-availability_only")).toHaveTextContent("Disponible");
    fireEvent.change(screen.getByLabelText("Modo de visibilidad de existencias"), { target: { value: "hidden" } });
    expect(screen.getByTestId("stock-preview-hidden")).toHaveTextContent("La información de existencias está oculta");
  });

  it("reports network and invalid JSON failures in Spanish", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    render(<SettingsAdmin />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No fue posible cargar la configuración."));
    cleanup();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => { throw new Error("invalid json"); } } as unknown as Response)));
    render(<SettingsAdmin />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No fue posible cargar la configuración."));
  });
});
