const CANONICAL_PRODUCTION_ORIGIN = "https://zona-de-pasos-store.vercel.app";

export function applicationOrigin(request: Request): string {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) {
    const value = productionHost.startsWith("http://") || productionHost.startsWith("https://")
      ? productionHost
      : `https://${productionHost}`;
    const url = new URL(value);
    if (url.protocol === "https:") return url.origin;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1") return requestUrl.origin;
  return CANONICAL_PRODUCTION_ORIGIN;
}

export function normalizeRecoveryEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function isValidNewPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && value.length <= 128;
}
