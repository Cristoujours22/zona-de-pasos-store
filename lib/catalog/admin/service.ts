import { normalizeAltText, isProductImagePublicId } from "@/lib/catalog/image-upload";
import type { AdminProductSummary, Brand, CommerceSettings } from "@/types/catalog";

export interface ProductImageCreateInput {
  cloudinaryPublicId: string;
  secureUrl: string;
  altText: string;
  width: number;
  height: number;
}

export interface ProductVariantCreateInput {
  size: string;
  color: string;
  sku: string;
  active: boolean;
  stockQuantity: number;
}

export interface ProductCreateInput {
  brandId: string;
  name: string;
  slug: string;
  description: string;
  audience: "men" | "women" | "unisex";
  priceCop: number;
  lifecycle: "draft" | "published" | "archived";
  featured: boolean;
  image: ProductImageCreateInput;
  variants: ProductVariantCreateInput[];
}

export interface ProductUpdateInput {
  name?: string;
  slug?: string;
  description?: string;
  audience?: ProductCreateInput["audience"];
  priceCop?: number;
  lifecycle?: ProductCreateInput["lifecycle"];
  featured?: boolean;
}

export type SettingsUpdateInput = Partial<CommerceSettings>;

export interface InventoryAdjustInput {
  variantId: string;
  delta: number;
  reason: string;
  orderReference?: string | null;
}

export interface CatalogAdminAdapter {
  listBrands(): Promise<Brand[]>;
  createBrand(input: { name: string; slug: string }): Promise<Brand>;
  createProduct(input: ProductCreateInput): Promise<{ id: string }>;
  listProducts(): Promise<AdminProductSummary[]>;
  updateProduct(id: string, input: ProductUpdateInput): Promise<unknown>;
  getSettings(): Promise<CommerceSettings>;
  updateSettings(input: SettingsUpdateInput): Promise<CommerceSettings>;
  adjustInventory(input: InventoryAdjustInput): Promise<{ stockQuantity: number }>;
}

export class CatalogPersistenceError extends Error {
  readonly ambiguous: boolean;

  constructor(message: string, ambiguous = false) {
    super(message);
    this.name = "CatalogPersistenceError";
    this.ambiguous = ambiguous;
  }
}

export type CatalogAdminErrorCode =
  | "invalid_request"
  | "invalid_brand"
  | "invalid_product"
  | "invalid_variant"
  | "duplicate_variant"
  | "invalid_price"
  | "invalid_stock"
  | "invalid_image"
  | "invalid_threshold"
  | "invalid_settings"
  | "invalid_whatsapp"
  | "invalid_nequi"
  | "invalid_inventory"
  | "invalid_delta"
  | "invalid_reason"
  | "not_found"
  | "persistence"
  | "ambiguous_persistence";

export class CatalogAdminError extends Error {
  readonly code: CatalogAdminErrorCode;
  readonly status: number;

  constructor(code: CatalogAdminErrorCode, message: string, status = 400) {
    super(message);
    this.name = "CatalogAdminError";
    this.code = code;
    this.status = status;
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CatalogAdminError("invalid_request", "La solicitud no es válida.");
  return value as Record<string, unknown>;
}

function text(value: unknown, message: string, code: CatalogAdminErrorCode): string {
  if (typeof value !== "string") throw new CatalogAdminError(code, message);
  const normalized = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ").replace(/\s+/gu, " ").trim();
  if (!normalized) throw new CatalogAdminError(code, message);
  return normalized;
}

function slug(value: string): string {
  const result = value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  if (!result) throw new CatalogAdminError("invalid_product", "El nombre debe producir un identificador válido.");
  return result;
}

function integer(value: unknown, code: "invalid_price" | "invalid_stock" | "invalid_threshold", message: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new CatalogAdminError(code, message);
  return value;
}

export function parseBrandInput(value: unknown): { name: string; slug: string } {
  const body = record(value);
  const name = text(body.name, "Indica el nombre de la marca.", "invalid_brand");
  return { name, slug: slug(name) };
}

export function parseCreateProductInput(value: unknown): ProductCreateInput {
  const body = record(value);
  const brandId = text(body.brandId, "Indica la marca del producto.", "invalid_product");
  const name = text(body.name, "Indica el nombre del producto.", "invalid_product");
  const audience = body.audience;
  if (audience !== "men" && audience !== "women" && audience !== "unisex") throw new CatalogAdminError("invalid_product", "Selecciona una audiencia adulta.");
  const lifecycle = body.lifecycle === undefined ? "draft" : body.lifecycle;
  if (lifecycle !== "draft" && lifecycle !== "published" && lifecycle !== "archived") throw new CatalogAdminError("invalid_product", "El ciclo de vida del producto no es válido.");
  const imageBody = record(body.image);
  const cloudinaryPublicId = imageBody.cloudinaryPublicId;
  if (!isProductImagePublicId(cloudinaryPublicId) || typeof imageBody.secureUrl !== "string" || !imageBody.secureUrl.startsWith("https://")) throw new CatalogAdminError("invalid_image", "La imagen del producto no es válida.");
  let altText: string;
  try { altText = normalizeAltText(imageBody.altText); } catch { throw new CatalogAdminError("invalid_image", "El texto alternativo de la imagen no es válido."); }
  if (typeof imageBody.width !== "number" || !Number.isSafeInteger(imageBody.width) || imageBody.width < 1 || typeof imageBody.height !== "number" || !Number.isSafeInteger(imageBody.height) || imageBody.height < 1) throw new CatalogAdminError("invalid_image", "Las dimensiones de la imagen no son válidas.");
  const width = imageBody.width;
  const height = imageBody.height;
  if (!Array.isArray(body.variants) || body.variants.length === 0) throw new CatalogAdminError("invalid_variant", "Agrega al menos una variante.");
  const seenPairs = new Set<string>();
  const seenSkus = new Set<string>();
  const variants = body.variants.map((entry) => {
    const item = record(entry);
    const size = text(item.size, "Cada variante debe tener una talla.", "invalid_variant");
    const color = text(item.color, "Cada variante debe tener un color.", "invalid_variant");
    const sku = text(item.sku, "Cada variante debe tener un SKU.", "invalid_variant");
    const pair = `${size.toLowerCase()}::${color.toLowerCase()}`;
    if (seenPairs.has(pair) || seenSkus.has(sku.toLowerCase())) throw new CatalogAdminError("duplicate_variant", "Las tallas, colores y SKU no pueden repetirse.");
    seenPairs.add(pair);
    seenSkus.add(sku.toLowerCase());
    if (item.active !== undefined && typeof item.active !== "boolean") throw new CatalogAdminError("invalid_variant", "El estado de la variante no es válido.");
    return { size, color, sku, active: item.active === undefined ? true : item.active, stockQuantity: integer(item.stockQuantity, "invalid_stock", "El inventario inicial debe ser un entero no negativo.") };
  });
  if (body.active !== undefined) throw new CatalogAdminError("invalid_product", "La activación se configura por variante.");
  return {
    brandId,
    name,
    slug: body.slug === undefined ? slug(name) : slug(text(body.slug, "El identificador del producto no es válido.", "invalid_product")),
    description: body.description === undefined ? "" : typeof body.description === "string" ? body.description.normalize("NFKC").replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ").replace(/\s+/gu, " ").trim() : (() => { throw new CatalogAdminError("invalid_product", "La descripción no es válida."); })(),
    audience,
    priceCop: integer(body.priceCop, "invalid_price", "El precio debe ser un entero no negativo en pesos colombianos."),
    lifecycle,
    featured: body.featured === undefined ? false : typeof body.featured === "boolean" ? body.featured : (() => { throw new CatalogAdminError("invalid_product", "El estado destacado no es válido."); })(),
    image: { cloudinaryPublicId, secureUrl: imageBody.secureUrl, altText, width, height },
    variants,
  };
}

export function parseProductUpdateInput(value: unknown): ProductUpdateInput {
  const body = record(value);
  if (body.stockQuantity !== undefined || body.stock !== undefined || body.variants !== undefined) throw new CatalogAdminError("invalid_product", "El inventario solo se modifica mediante el ajuste autorizado.");
  const input: ProductUpdateInput = {};
  if (body.name !== undefined) { const name = text(body.name, "El nombre del producto no es válido.", "invalid_product"); input.name = name; input.slug = slug(name); }
  if (body.slug !== undefined) input.slug = slug(text(body.slug, "El identificador del producto no es válido.", "invalid_product"));
  if (body.description !== undefined) input.description = typeof body.description === "string" ? body.description.normalize("NFKC").replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ").replace(/\s+/gu, " ").trim() : (() => { throw new CatalogAdminError("invalid_product", "La descripción no es válida."); })();
  if (body.audience !== undefined) { if (body.audience !== "men" && body.audience !== "women" && body.audience !== "unisex") throw new CatalogAdminError("invalid_product", "Selecciona una audiencia adulta."); input.audience = body.audience; }
  if (body.priceCop !== undefined) input.priceCop = integer(body.priceCop, "invalid_price", "El precio debe ser un entero no negativo en pesos colombianos.");
  if (body.lifecycle !== undefined) { if (body.lifecycle !== "draft" && body.lifecycle !== "published" && body.lifecycle !== "archived") throw new CatalogAdminError("invalid_product", "El ciclo de vida del producto no es válido."); input.lifecycle = body.lifecycle; }
  if (body.featured !== undefined) { if (typeof body.featured !== "boolean") throw new CatalogAdminError("invalid_product", "El estado destacado no es válido."); input.featured = body.featured; }
  if (Object.keys(input).length === 0) throw new CatalogAdminError("invalid_product", "Indica al menos un campo del producto para actualizar.");
  return input;
}

export function parseSettingsInput(value: unknown): SettingsUpdateInput {
  const body = record(value);
  const input: SettingsUpdateInput = {};
  if (body.whatsappPhone !== undefined) {
    const phone = text(body.whatsappPhone, "El WhatsApp es obligatorio.", "invalid_whatsapp");
    if (!/^[+\d][\d ()-]{6,}$/u.test(phone)) throw new CatalogAdminError("invalid_whatsapp", "El WhatsApp no es válido.");
    input.whatsappPhone = phone;
  }
  if (body.nequiDetails !== undefined) input.nequiDetails = text(body.nequiDetails, "Los datos de Nequi son obligatorios.", "invalid_nequi");
  if (body.dispatchOriginCity !== undefined) input.dispatchOriginCity = text(body.dispatchOriginCity, "Indica la ciudad de despacho.", "invalid_settings");
  if (body.dispatchOriginAddress !== undefined) input.dispatchOriginAddress = text(body.dispatchOriginAddress, "Indica la dirección de despacho.", "invalid_settings");
  if (body.inventoryLowThreshold !== undefined) input.inventoryLowThreshold = integer(body.inventoryLowThreshold, "invalid_threshold", "El umbral de inventario debe ser un entero no negativo.");
  if (body.stockDisplayMode !== undefined) { if (body.stockDisplayMode !== "detailed" && body.stockDisplayMode !== "availability_only" && body.stockDisplayMode !== "hidden") throw new CatalogAdminError("invalid_settings", "El modo de existencias no es válido."); input.stockDisplayMode = body.stockDisplayMode; }
  if (Object.keys(input).length === 0) throw new CatalogAdminError("invalid_settings", "Indica al menos una configuración para actualizar.");
  return input;
}

export function parseInventoryInput(value: unknown): InventoryAdjustInput {
  const body = record(value);
  const variantId = text(body.variantId, "Indica la variante.", "invalid_inventory");
  if (typeof body.delta !== "number" || !Number.isSafeInteger(body.delta) || body.delta === 0) throw new CatalogAdminError("invalid_delta", "El ajuste debe ser un entero distinto de cero.");
  const reason = text(body.reason, "Indica el motivo del ajuste.", "invalid_reason");
  if (body.orderReference !== undefined && body.orderReference !== null && typeof body.orderReference !== "string") throw new CatalogAdminError("invalid_inventory", "La referencia de la orden no es válida.");
  return { variantId, delta: body.delta, reason, orderReference: body.orderReference === null ? null : body.orderReference?.trim() || null };
}

async function persist<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) {
    if (error instanceof CatalogAdminError) throw error;
    if (error instanceof CatalogPersistenceError && error.ambiguous) throw new CatalogAdminError("ambiguous_persistence", "No fue posible confirmar la operación. Puedes reintentar; la imagen cargada permanece disponible.", 503);
    throw new CatalogAdminError("persistence", "No fue posible guardar los cambios. Intenta de nuevo.", 502);
  }
}

export function createCatalogAdminService(adapter: CatalogAdminAdapter) {
  return {
    listBrands: () => persist(() => adapter.listBrands()),
    createBrand: (value: unknown) => persist(() => adapter.createBrand(parseBrandInput(value))),
    createProduct: (value: unknown) => persist(() => adapter.createProduct(parseCreateProductInput(value))),
    listProducts: () => persist(() => adapter.listProducts()),
    updateProduct: (id: string, value: unknown) => persist(() => {
      const productId = text(id, "Indica el producto.", "invalid_product");
      return adapter.updateProduct(productId, parseProductUpdateInput(value));
    }),
    getSettings: () => persist(() => adapter.getSettings()),
    updateSettings: (value: unknown) => persist(() => adapter.updateSettings(parseSettingsInput(value))),
    adjustInventory: (value: unknown) => persist(() => adapter.adjustInventory(parseInventoryInput(value))),
  };
}
