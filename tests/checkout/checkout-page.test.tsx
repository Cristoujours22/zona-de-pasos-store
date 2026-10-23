import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CartProvider } from "@/components/cart/cart-provider";
import { CheckoutForm, CheckoutPageContent } from "@/components/checkout/checkout-page";
import { CART_STORAGE_KEY, serializeCart } from "@/lib/cart/storage";
import type { CartItem } from "@/types/cart";
import type { CheckoutReceipt } from "@/types/checkout";

const item: CartItem = {
  productId: "11111111-1111-4111-8111-111111111111",
  variantId: "22222222-2222-4222-8222-222222222222",
  productSlug: "ritmo-01",
  productName: "Ritmo 01",
  brandName: "Marca Uno",
  imageUrl: null,
  imageAlt: null,
  size: "38",
  color: "Blanco",
  sku: "R1-38",
  displayPriceCop: 249900,
  quantity: 2,
};

const successBody = {
  order: { number: "ZP-20260403-ABC", subtotalCop: 499800, deliveryType: "local" },
  whatsapp: { url: "https://wa.me/573001234567?text=itemizado" },
};

function storage(): Storage {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), clear: () => values.clear(), key: (index) => [...values.keys()][index] ?? null, get length() { return values.size; } };
}

function renderWithCart() {
  const cartStorage = storage();
  cartStorage.setItem(CART_STORAGE_KEY, serializeCart([item]));
  return render(<CartProvider storage={cartStorage}><CheckoutPageContent navigateToWhatsapp={vi.fn()} /></CartProvider>);
}

function fillForm() {
  fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Ana María Pérez" } });
  fireEvent.change(screen.getByLabelText("Número de documento colombiano"), { target: { value: "1.234.567" } });
  fireEvent.change(screen.getByLabelText("Celular colombiano"), { target: { value: "300 123 4567" } });
  fireEvent.change(screen.getByLabelText(/Correo electrónico/), { target: { value: "ana@example.com" } });
  fireEvent.change(screen.getByLabelText("Departamento"), { target: { value: "Antioquia" } });
  fireEvent.change(screen.getByLabelText("Ciudad o municipio"), { target: { value: "Medellín" } });
  fireEvent.change(screen.getByLabelText("Dirección"), { target: { value: "Calle 10 # 20-30" } });
  fireEvent.change(screen.getByLabelText("Barrio"), { target: { value: "Laureles" } });
  fireEvent.click(screen.getByLabelText(/Acepto que Zona de pasos store/));
}

describe("guest checkout page", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows all required fields, the maintained department list, consent, and exact payment flow", async () => {
    renderWithCart();
    await waitFor(() => expect(screen.getByRole("form", { name: "Checkout de pedido" })).toBeInTheDocument());
    fireEvent.submit(screen.getByRole("form", { name: "Checkout de pedido" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/nombre completo/i);
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(screen.getByRole("option", { name: "Bogotá D.C." })).toBeInTheDocument();
    expect(screen.getByText(/disponibilidad y el costo del envío.*administrador.*WhatsApp/i)).toBeInTheDocument();
    expect(screen.getByText(/productos se pagan por adelantado.*únicamente por Nequi.*después de recibir la instrucción/i)).toBeInTheDocument();
    expect(screen.getByText(/envío se paga contra entrega y lo asume el cliente/i)).toBeInTheDocument();
    expect(screen.getByText(/comprobante se envía únicamente por WhatsApp y requiere verificación humana/i)).toBeInTheDocument();
    expect(screen.getByText(/captura de pantalla confirma automáticamente el pago/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits IDs and quantities, preserves the key on network retry, and never navigates automatically", async () => {
    const firstFetch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ok: true, status: 201, json: async () => successBody });
    vi.stubGlobal("fetch", firstFetch);
    const navigate = vi.fn();
    const cartStorage = storage();
    cartStorage.setItem(CART_STORAGE_KEY, serializeCart([item]));
    const firstRender = render(<CartProvider storage={cartStorage}><CheckoutPageContent navigateToWhatsapp={navigate} /></CartProvider>);
    await waitFor(() => expect(screen.getByRole("form", { name: "Checkout de pedido" })).toBeInTheDocument());
    fillForm();
    fireEvent.submit(screen.getByRole("form", { name: "Checkout de pedido" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/intenta nuevamente/i);
    expect(screen.getByDisplayValue("Ana María Pérez")).toBeInTheDocument();
    const firstPayload = JSON.parse(String(firstFetch.mock.calls[0][1]?.body));
    expect(firstPayload.items).toEqual([{ variantId: item.variantId, quantity: item.quantity }]);
    expect(firstPayload).not.toHaveProperty("productName");
    expect(firstPayload).not.toHaveProperty("displayPriceCop");

    firstRender.unmount();
    render(<CartProvider storage={cartStorage}><CheckoutPageContent navigateToWhatsapp={navigate} /></CartProvider>);
    await waitFor(() => expect(screen.getByRole("form", { name: "Checkout de pedido" })).toBeInTheDocument());
    fillForm();
    fireEvent.submit(screen.getByRole("form", { name: "Checkout de pedido" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: /pedido recibido/i })).toBeInTheDocument());
    const retryPayload = JSON.parse(String(firstFetch.mock.calls[1][1]?.body));
    expect(retryPayload.idempotencyKey).toBe(firstPayload.idempotencyKey);
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /abrir WhatsApp/i }));
    expect(navigate).toHaveBeenCalledWith("https://wa.me/573001234567?text=itemizado");
    expect(screen.getByText(/ZP-20260403-ABC/)).toBeInTheDocument();
    expect(screen.getByText(/499\.800/)).toBeInTheDocument();
    expect(screen.getByText(/entrega local/i)).toBeInTheDocument();
  });

  it.each([
    [409, /disponibilidad/i],
    [429, /límite/i],
    [503, /confirmar/i],
  ])("retains form and cart data for HTTP %s", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({ error: "sensitive server detail" }) }));
    const cartStorage = storage();
    cartStorage.setItem(CART_STORAGE_KEY, serializeCart([item]));
    render(<CartProvider storage={cartStorage}><CheckoutPageContent /></CartProvider>);
    await waitFor(() => expect(screen.getByRole("form", { name: "Checkout de pedido" })).toBeInTheDocument());
    fillForm();
    fireEvent.submit(screen.getByRole("form", { name: "Checkout de pedido" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByDisplayValue("Ana María Pérez")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1.234.567")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Calle 10 # 20-30")).toBeInTheDocument();
    expect(screen.queryByText(/sensitive server detail/i)).not.toBeInTheDocument();
    expect(JSON.parse(cartStorage.getItem(CART_STORAGE_KEY) ?? "{}").items).toHaveLength(1);
  });

  it("retains entered data when a successful response is invalid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => { throw new Error("invalid json"); } }));
    const cartStorage = storage();
    cartStorage.setItem(CART_STORAGE_KEY, serializeCart([item]));
    render(<CartProvider storage={cartStorage}><CheckoutPageContent /></CartProvider>);
    await waitFor(() => expect(screen.getByRole("form", { name: "Checkout de pedido" })).toBeInTheDocument());
    fillForm();
    fireEvent.submit(screen.getByRole("form", { name: "Checkout de pedido" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/respuesta del pedido no fue válida/i);
    expect(screen.getByDisplayValue("Ana María Pérez")).toBeInTheDocument();
    expect(JSON.parse(cartStorage.getItem(CART_STORAGE_KEY) ?? "{}").items).toHaveLength(1);
  });

  it("rejects a compromised response URL, does not clear the cart, and opens only after the explicit action", async () => {
    const navigate = vi.fn();
    const clearCart = vi.fn();
    const onSuccess = vi.fn();
    const receipt = { id: "id", number: "ZP-1", subtotalCop: 1, deliveryType: "local" as const, replayed: false, items: [] } satisfies CheckoutReceipt;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ order: { number: receipt.number, subtotalCop: 1, deliveryType: "local" }, whatsapp: { url: "https://not-wa.example" } }) }));
    render(<CheckoutForm items={[item]} subtotalCop={499800} clearCart={clearCart} onSuccess={onSuccess} />);
    fillForm();
    fireEvent.submit(screen.getByRole("form", { name: "Checkout de pedido" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/enlace de WhatsApp/i);
    expect(clearCart).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("renders an empty-cart path without posting and clears exactly once after valid success", async () => {
    const emptyStorage = storage();
    render(<CartProvider storage={emptyStorage}><CheckoutPageContent /></CartProvider>);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/carrito está vacío/i));
    expect(screen.getByRole("link", { name: /ver catálogo/i })).toHaveAttribute("href", "/catalog");
    expect(screen.getByRole("link", { name: /volver al carrito/i })).toHaveAttribute("href", "/cart");
    expect(fetch).not.toHaveBeenCalled();

    const clearCart = vi.fn();
    const onSuccess = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => successBody }));
    render(<CheckoutForm items={[item]} subtotalCop={499800} clearCart={clearCart} onSuccess={onSuccess} />);
    fillForm();
    fireEvent.submit(screen.getAllByRole("form", { name: "Checkout de pedido" })[0]);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(clearCart).toHaveBeenCalledTimes(1);
  });
});
