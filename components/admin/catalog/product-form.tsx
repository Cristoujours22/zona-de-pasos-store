"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { Brand } from "@/types/catalog";

type UploadedImage = { cloudinaryPublicId: string; secureUrl: string; altText: string; width: number; height: number };
type VariantDraft = { id: string; size: string; color: string; sku: string; stockQuantity: string };
type ProductFields = { brandId: string; name: string; description: string; audience: "" | "men" | "women" | "unisex"; priceCop: string; lifecycle: "draft" | "published"; featured: boolean; altText: string };

const emptyFields: ProductFields = { brandId: "", name: "", description: "", audience: "", priceCop: "", lifecycle: "draft", featured: false, altText: "" };
const newVariant = (id: string): VariantDraft => ({ id, size: "", color: "", sku: "", stockQuantity: "" });

async function responseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export function ProductForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nextVariantId = useRef(2);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [fields, setFields] = useState<ProductFields>(emptyFields);
  const [variants, setVariants] = useState<VariantDraft[]>([newVariant("variant-1")]);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/brands")
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, "No fue posible cargar las marcas."));
        return response.json() as Promise<Brand[]>;
      })
      .then((items) => { if (active) setBrands(items); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No fue posible cargar las marcas."); })
      .finally(() => { if (active) setLoadingBrands(false); });
    return () => { active = false; };
  }, []);

  function updateField<K extends keyof ProductFields>(key: K, value: ProductFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function updateVariant(id: string, key: keyof Omit<VariantDraft, "id">, value: string) {
    setVariants((current) => current.map((variant) => variant.id === id ? { ...variant, [key]: value } : variant));
    setError("");
  }

  function validate(): string | null {
    if (!fields.brandId) return "Selecciona una marca.";
    if (!fields.name.trim()) return "Indica el nombre del producto.";
    if (!fields.audience) return "Selecciona una audiencia adulta.";
    const price = Number(fields.priceCop);
    if (!fields.priceCop.trim() || !Number.isSafeInteger(price) || price < 0) return "El precio debe ser un entero no negativo en pesos colombianos.";
    if (!fields.altText.trim()) return "El texto alternativo de la imagen es obligatorio.";
    if (!uploadedImage && !file) return "Selecciona una imagen para cargar.";
    if (variants.length === 0) return "Agrega al menos una variante.";
    const pairs = new Set<string>();
    const skus = new Set<string>();
    for (const variant of variants) {
      if (!variant.size.trim() || !variant.color.trim() || !variant.sku.trim()) return "Completa talla, color y SKU en cada variante.";
      const pair = `${variant.size.trim().toLowerCase()}::${variant.color.trim().toLowerCase()}`;
      if (pairs.has(pair) || skus.has(variant.sku.trim().toLowerCase())) return "Las variantes no pueden repetirse.";
      pairs.add(pair);
      skus.add(variant.sku.trim().toLowerCase());
      const quantity = Number(variant.stockQuantity);
      if (!variant.stockQuantity.trim() || !Number.isSafeInteger(quantity) || quantity < 0) return "La cantidad inicial debe ser un entero no negativo.";
    }
    return null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setBusy(true);
    try {
      let image = uploadedImage;
      if (!image && file) {
        const form = new FormData();
        form.set("file", file);
        form.set("altText", fields.altText.trim());
        const uploadResponse = await fetch("/api/admin/product-images", { method: "POST", body: form });
        if (!uploadResponse.ok) throw new Error(await responseError(uploadResponse, "No fue posible cargar la imagen. Intenta de nuevo."));
        image = await uploadResponse.json() as UploadedImage;
        setUploadedImage(image);
      }
      if (!image) throw new Error("Selecciona una imagen para cargar.");

      const productResponse = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandId: fields.brandId,
          name: fields.name.trim(),
          description: fields.description.trim(),
          audience: fields.audience,
          priceCop: Number(fields.priceCop),
          lifecycle: fields.lifecycle,
          featured: fields.featured,
          image: { ...image, altText: fields.altText.trim() },
          variants: variants.map((variant) => ({ size: variant.size.trim(), color: variant.color.trim(), sku: variant.sku.trim(), active: true, stockQuantity: Number(variant.stockQuantity) })),
        }),
      });
      if (!productResponse.ok) throw new Error(await responseError(productResponse, productResponse.status === 503 ? "No fue posible confirmar la operación. Puedes reintentar; la imagen cargada permanece disponible." : "No fue posible guardar el producto. Intenta de nuevo."));

      setSuccess("Producto creado correctamente.");
      formRef.current?.reset();
      setFields(emptyFields);
      setVariants([newVariant("variant-1")]);
      setFile(null);
      setUploadedImage(null);
      nextVariantId.current = 2;
      router.push("/admin/catalog");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "No fue posible guardar el producto. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteUploadedImage() {
    if (!uploadedImage) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/product-images", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ publicId: uploadedImage.cloudinaryPublicId }) });
      if (!response.ok) throw new Error(await responseError(response, "No fue posible eliminar la imagen."));
      setUploadedImage(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "No fue posible eliminar la imagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form aria-label="Crear producto" className="grid gap-8" ref={formRef} onSubmit={submit}>
      <fieldset className="grid gap-5" disabled={busy}>
        <legend className="sr-only">Datos del producto</legend>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">Marca<select aria-label="Marca" className="rounded-lg border border-line bg-white px-4 py-3 font-normal" required value={fields.brandId} onChange={(event) => updateField("brandId", event.target.value)}><option value="">{loadingBrands ? "Cargando marcas…" : "Selecciona una marca"}</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-bold">Nombre del producto<input aria-label="Nombre del producto" className="rounded-lg border border-line bg-white px-4 py-3 font-normal" required value={fields.name} onChange={(event) => updateField("name", event.target.value)} /></label>
        </div>
        <label className="grid gap-2 text-sm font-bold">Descripción opcional<textarea aria-label="Descripción opcional" className="rounded-lg border border-line bg-white px-4 py-3 font-normal" rows={3} value={fields.description} onChange={(event) => updateField("description", event.target.value)} /></label>
        <div className="grid gap-5 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold">Audiencia<select aria-label="Audiencia" className="rounded-lg border border-line bg-white px-4 py-3 font-normal" required value={fields.audience} onChange={(event) => updateField("audience", event.target.value as ProductFields["audience"])}><option value="">Selecciona</option><option value="men">Hombre</option><option value="women">Mujer</option><option value="unisex">Unisex</option></select></label>
          <label className="grid gap-2 text-sm font-bold">Precio en COP<input aria-label="Precio en COP" className="rounded-lg border border-line bg-white px-4 py-3 font-normal" inputMode="numeric" min="0" required step="1" type="number" value={fields.priceCop} onChange={(event) => updateField("priceCop", event.target.value)} /></label>
          <label className="grid gap-2 text-sm font-bold">Publicación<select aria-label="Publicación" className="rounded-lg border border-line bg-white px-4 py-3 font-normal" value={fields.lifecycle} onChange={(event) => updateField("lifecycle", event.target.value as ProductFields["lifecycle"])}><option value="draft">Borrador</option><option value="published">Publicado</option></select></label>
        </div>
        <label className="flex items-center gap-3 text-sm font-bold"><input aria-label="Producto destacado" checked={fields.featured} type="checkbox" onChange={(event) => updateField("featured", event.target.checked)} /> Producto destacado</label>
      </fieldset>

      <section className="grid gap-5 rounded-2xl border border-line bg-canvas p-5" aria-labelledby="image-title">
        <div><h2 className="font-display text-2xl font-black uppercase" id="image-title">Imagen principal</h2><p className="mt-1 text-sm text-muted">Primero se carga en Cloudinary y luego se guarda el producto.</p></div>
        <label className="grid gap-2 text-sm font-bold">Archivo de imagen<input aria-label="Archivo de imagen" accept="image/jpeg,image/png,image/webp,image/avif" className="rounded-lg border border-line bg-white px-4 py-3 font-normal" disabled={busy || Boolean(uploadedImage)} ref={fileRef} required={!uploadedImage} type="file" onChange={(event) => { if (uploadedImage) return; setFile(event.target.files?.[0] ?? null); setError(""); }} /></label>
        <label className="grid gap-2 text-sm font-bold">Texto alternativo de la imagen<input aria-label="Texto alternativo de la imagen" className="rounded-lg border border-line bg-white px-4 py-3 font-normal" disabled={busy} required value={fields.altText} onChange={(event) => updateField("altText", event.target.value)} /></label>
        {uploadedImage && <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-white p-3"><img alt={fields.altText || uploadedImage.altText} className="size-16 rounded object-cover" src={uploadedImage.secureUrl} /><span className="text-sm">Imagen cargada: {uploadedImage.altText}. Elimínala antes de reemplazarla.</span><button className="text-sm font-bold underline disabled:opacity-50" disabled={busy} type="button" onClick={deleteUploadedImage}>Eliminar imagen cargada</button></div>}
      </section>

      <section className="grid gap-5" aria-labelledby="variants-title">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-2xl font-black uppercase" id="variants-title">Variantes e inventario inicial</h2><p className="mt-1 text-sm text-muted">Cada combinación de talla y color debe tener un SKU único.</p></div><button className="rounded-full border border-ink px-4 py-2 text-sm font-bold" type="button" onClick={() => { setVariants((current) => [...current, newVariant(`variant-${nextVariantId.current++}`)]); setError(""); }}>Agregar variante</button></div>
        <div className="grid gap-4">
          {variants.map((variant, index) => <fieldset className="grid gap-4 rounded-2xl border border-line bg-canvas p-5" key={variant.id} aria-label={`Variante ${index + 1}`}>
            <legend className="px-1 font-bold">Variante {index + 1}</legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-2 text-sm font-bold">Talla<input aria-label={`Talla ${index + 1}`} className="rounded-lg border border-line bg-white px-3 py-2 font-normal" required value={variant.size} onChange={(event) => updateVariant(variant.id, "size", event.target.value)} /></label>
              <label className="grid gap-2 text-sm font-bold">Color<input aria-label={`Color ${index + 1}`} className="rounded-lg border border-line bg-white px-3 py-2 font-normal" required value={variant.color} onChange={(event) => updateVariant(variant.id, "color", event.target.value)} /></label>
              <label className="grid gap-2 text-sm font-bold">SKU<input aria-label={`SKU ${index + 1}`} className="rounded-lg border border-line bg-white px-3 py-2 font-normal" required value={variant.sku} onChange={(event) => updateVariant(variant.id, "sku", event.target.value)} /></label>
              <label className="grid gap-2 text-sm font-bold">Cantidad inicial<input aria-label={`Cantidad inicial ${index + 1}`} className="rounded-lg border border-line bg-white px-3 py-2 font-normal" min="0" required step="1" type="number" value={variant.stockQuantity} onChange={(event) => updateVariant(variant.id, "stockQuantity", event.target.value)} /></label>
            </div>
            {variants.length > 1 && <button className="justify-self-start text-sm font-bold underline" type="button" onClick={() => setVariants((current) => current.filter((item) => item.id !== variant.id))} aria-label={`Eliminar variante ${index + 1}`}>Eliminar variante</button>}
          </fieldset>)}
        </div>
      </section>

      {error && <p className="rounded-lg border border-red-700/30 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {success && <p className="rounded-lg border border-green-700/30 bg-green-50 p-3 text-sm text-green-800" role="status">{success}</p>}
      <button className="justify-self-start rounded-full bg-ink px-6 py-3 font-bold text-canvas disabled:opacity-50" disabled={busy || loadingBrands} type="submit">{busy ? "Guardando…" : "Crear producto"}</button>
    </form>
  );
}
