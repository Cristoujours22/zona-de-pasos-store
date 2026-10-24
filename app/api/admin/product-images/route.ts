import { NextResponse } from "next/server";

import { authErrorStatus, requireActiveAdmin } from "@/lib/auth/server";
import {
  deleteProductImage,
  ImageUploadError,
  uploadProductImage,
} from "@/lib/catalog/image-upload";
import { createCloudinaryImageAdapter } from "@/lib/cloudinary/adapter";

export const runtime = "nodejs";

function authorizationResponse(error: unknown): NextResponse {
  const status = authErrorStatus(error);
  const message = status === 401
    ? "Debes iniciar sesión para administrar imágenes."
    : status === 403
      ? "No tienes permisos para administrar imágenes."
      : "No fue posible validar tu autorización.";
  return NextResponse.json({ error: message }, { status });
}

function imageErrorResponse(error: unknown): NextResponse {
  if (error instanceof ImageUploadError) {
    const status = error.code === "provider_failure" ? 502 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ error: "No fue posible procesar la imagen. Intenta de nuevo." }, { status: 502 });
}

function isFileEntry(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
    typeof value !== "string" &&
    typeof value.arrayBuffer === "function" &&
    typeof value.size === "number" &&
    typeof value.type === "string",
  );
}

export async function POST(request: Request) {
  try {
    await requireActiveAdmin();
  } catch (error) {
    return authorizationResponse(error);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "La solicitud de imagen no es válida." }, { status: 400 });
  }

  const file = form.get("file");
  if (!isFileEntry(file)) {
    return NextResponse.json({ error: "Selecciona una imagen para cargar." }, { status: 400 });
  }

  try {
    const metadata = await uploadProductImage(file, form.get("altText"), createCloudinaryImageAdapter());
    return NextResponse.json(metadata, { status: 201 });
  } catch (error) {
    return imageErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireActiveAdmin();
  } catch (error) {
    return authorizationResponse(error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La solicitud de eliminación no es válida." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("publicId" in body) || typeof body.publicId !== "string") {
    return NextResponse.json({ error: "Indica la imagen que deseas eliminar." }, { status: 400 });
  }

  try {
    const result = await deleteProductImage(body.publicId, createCloudinaryImageAdapter());
    if (!result.deleted) {
      return NextResponse.json({ error: "La imagen no existe en el almacenamiento." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return imageErrorResponse(error);
  }
}
