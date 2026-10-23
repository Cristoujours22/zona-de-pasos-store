import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TOKEN = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/u;
const SECRET = /^[0-9a-f]{64}$/iu;

export class TrackingConfigurationError extends Error {
  constructor() { super("El seguimiento de pedidos no está configurado."); this.name = "TrackingConfigurationError"; }
}

export function readTrackingSecret(): string {
  const value = process.env.ORDER_TRACKING_SECRET;
  if (!value || !SECRET.test(value)) throw new TrackingConfigurationError();
  return value.toLowerCase();
}

function signature(orderId: string, secret: string): string {
  if (!UUID.test(orderId) || !SECRET.test(secret)) throw new TrackingConfigurationError();
  return createHmac("sha256", Buffer.from(secret, "hex")).update(`zona-de-pasos-order:${orderId.toLowerCase()}`, "utf8").digest("base64url");
}

export function createTrackingToken(orderId: string, secret = readTrackingSecret()): string {
  const normalized = orderId.toLowerCase();
  return `${normalized}.${signature(normalized, secret)}`;
}

export function parseTrackingToken(token: string, secret = readTrackingSecret()): string | null {
  const match = TOKEN.exec(token);
  if (!match) return null;
  const orderId = match[1].toLowerCase();
  const expected = Buffer.from(signature(orderId, secret), "utf8");
  const actual = Buffer.from(match[2], "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? orderId : null;
}

export function trackingPath(token: string): string {
  if (!TOKEN.test(token)) throw new Error("invalid tracking token");
  return `/track/${token}`;
}
