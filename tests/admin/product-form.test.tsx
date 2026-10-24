import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks }));

import { ProductForm } from "@/components/admin/catalog/product-form";

const brands = [{ id: "brand-1", name: "Nike", slug: "nike" }];
const imageMetadata = {
  cloudinaryPublicId: "zona-de-pasos/products/air-runner",
  secureUrl: "https://cdn.example/air-runner.jpg",
  altText: "Tenis negros para correr",
  width: 900,
  height: 900,
};

function brandResponse() {
  return { ok: true, status: 200, json: async () => brands };
}

function fillProduct() {
  fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "brand-1" } });
  fireEvent.change(screen.getByLabelText("Nombre del producto"), { target: { value: "Air Runner" } });
  fireEvent.change(screen.getByLabelText("Audiencia"), { target: { value: "men" } });
  fireEvent.change(screen.getByLabelText("Precio en COP"), { target: { value: "249900" } });
  fireEvent.change(screen.getByLabelText("Texto alternativo de la imagen"), { target: { value: "Tenis negros para correr" } });
  fireEvent.change(screen.getByLabelText("Talla 1"), { target: { value: "39" } });
  fireEvent.change(screen.getByLabelText("Color 1"), { target: { value: "Negro" } });
  fireEvent.change(screen.getByLabelText("SKU 1"), { target: { value: "AIR-39-NEG" } });
  fireEvent.change(screen.getByLabelText("Cantidad inicial 1"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Archivo de imagen"), { target: { files: [new File(["image"], "air.jpg", { type: "image/jpeg" })] } });
}

describe("admin product form", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(brandResponse()));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("requires the product fields and keeps the form in Spanish", async () => {
    render(<ProductForm />);
    await waitFor(() => expect(screen.getByLabelText("Marca")).toBeInTheDocument());

    fireEvent.submit(screen.getByRole("form", { name: "Crear producto" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Selecciona una marca.");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("adds/removes variants and prevents duplicate size-color or SKU rows", async () => {
    render(<ProductForm />);
    await waitFor(() => expect(screen.getByLabelText("Marca")).toBeInTheDocument());

    expect(screen.getAllByRole("group", { name: /Variante/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Agregar variante" }));
    expect(screen.getAllByRole("group", { name: /Variante/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar variante 2" }));
    expect(screen.getAllByRole("group", { name: /Variante/ })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Agregar variante" }));
    fireEvent.change(screen.getByLabelText("Talla 2"), { target: { value: "39" } });
    fireEvent.change(screen.getByLabelText("Color 2"), { target: { value: "Negro" } });
    fireEvent.change(screen.getByLabelText("SKU 2"), { target: { value: "AIR-39-NEG" } });
    fillProduct();
    fireEvent.submit(screen.getByRole("form", { name: "Crear producto" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Las variantes no pueden repetirse.");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("uploads before atomic product creation and sends the returned metadata", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([input, init]);
      if (String(input) === "/api/admin/brands") return Promise.resolve(brandResponse());
      if (String(input) === "/api/admin/product-images") return Promise.resolve({ ok: true, status: 201, json: async () => imageMetadata });
      return Promise.resolve({ ok: true, status: 201, json: async () => ({ id: "product-1" }) });
    }));
    render(<ProductForm />);
    await waitFor(() => expect(screen.getByLabelText("Marca")).toBeInTheDocument());
    fillProduct();

    fireEvent.submit(screen.getByRole("form", { name: "Crear producto" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin/catalog"));

    expect(calls.map(([input]) => String(input))).toEqual([
      "/api/admin/brands",
      "/api/admin/product-images",
      "/api/admin/products",
    ]);
    expect(calls[1][1]?.body).toBeInstanceOf(FormData);
    expect(JSON.parse(String(calls[2][1]?.body))).toMatchObject({ image: imageMetadata, brandId: "brand-1", priceCop: 249900 });
  });

  it("locks uploaded image controls, rejects silent replacement, and preserves metadata after ambiguous persistence", async () => {
    let finishProduct: (response: unknown) => void = () => undefined;
    const productPending = new Promise((resolve) => { finishProduct = resolve; });
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/admin/brands") return Promise.resolve(brandResponse());
      if (String(input) === "/api/admin/product-images") return Promise.resolve({ ok: true, status: 201, json: async () => imageMetadata });
      return productPending;
    }));
    render(<ProductForm />);
    await waitFor(() => expect(screen.getByLabelText("Marca")).toBeInTheDocument());
    fillProduct();

    fireEvent.submit(screen.getByRole("form", { name: "Crear producto" }));
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3));
    expect(screen.getByLabelText("Archivo de imagen")).toBeDisabled();
    expect(screen.getByLabelText("Texto alternativo de la imagen")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Eliminar imagen cargada" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Archivo de imagen"), { target: { files: [new File(["replacement"], "new.jpg", { type: "image/jpeg" })] } });
    expect(screen.getByText(/Imagen cargada: Tenis negros para correr/)).toBeInTheDocument();

    finishProduct({ ok: false, status: 503, json: async () => ({ error: "No fue posible confirmar la operación. Puedes reintentar; la imagen cargada permanece disponible." }) });
    expect(await screen.findByRole("alert")).toHaveTextContent("imagen cargada permanece disponible");
    expect(screen.getByDisplayValue("Air Runner")).toBeInTheDocument();
    expect(screen.getByText(/Imagen cargada: Tenis negros para correr/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar imagen cargada" })).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows Spanish upload errors and resets plus navigates after success", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/admin/brands") return Promise.resolve(brandResponse());
      return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: "El formato debe ser JPEG, PNG, WebP o AVIF." }) });
    }));
    render(<ProductForm />);
    await waitFor(() => expect(screen.getByLabelText("Marca")).toBeInTheDocument());
    fillProduct();
    fireEvent.submit(screen.getByRole("form", { name: "Crear producto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El formato debe ser JPEG");

    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === "/api/admin/brands") return Promise.resolve(brandResponse() as unknown as Response);
      if (String(input) === "/api/admin/product-images") return Promise.resolve({ ok: true, status: 201, json: async () => imageMetadata } as unknown as Response);
      return Promise.resolve({ ok: true, status: 201, json: async () => ({ id: "product-1" }) } as unknown as Response);
    });
    fireEvent.submit(screen.getByRole("form", { name: "Crear producto" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin/catalog"));
    expect(screen.getByLabelText("Nombre del producto")).toHaveValue("");
    expect(screen.queryByText(/Imagen cargada/)).not.toBeInTheDocument();
  });
});
