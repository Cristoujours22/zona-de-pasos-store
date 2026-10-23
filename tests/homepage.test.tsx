import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

function renderShell() {
  return render(<HomePage />);
}

describe("public storefront shell", () => {
  it("introduces the store and its Colombia-only market", () => {
    renderShell();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getAllByText(/Zona de pasos store/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/solo para Colombia/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /tu próximo paso empieza aquí/i })).toBeInTheDocument();
  });

  it("provides accessible discovery and support routes", () => {
    renderShell();

    expect(screen.getByRole("link", { name: /ver la selección/i })).toHaveAttribute("href", "#coleccion");
    expect(screen.getByRole("link", { name: /hablar por whatsapp/i })).toHaveAttribute("href", "#soporte");
    expect(screen.getByRole("navigation", { name: /navegación principal/i })).toBeInTheDocument();
  });

  it("sets honest expectations for the placeholder release", () => {
    renderShell();

    expect(screen.getAllByText(/próximamente/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/precios en COP/i)).toBeInTheDocument();
    expect(screen.getByText(/pago por Nequi/i)).toBeInTheDocument();
    expect(screen.getByText(/canal de atención por WhatsApp será configurable/i)).toBeInTheDocument();
  });
});
