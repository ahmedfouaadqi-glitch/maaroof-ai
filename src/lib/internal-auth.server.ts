const INTERNAL_HEADER = "x-maaroof-internal-auth";
const VERSION = "v1";
const MAX_AGE_MS = 120_000;
const MAX_FUTURE_SKEW_MS = 30_000;
const encoder = new TextEncoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function payloadFor(version: string, timestamp: string, userId: string, method: string, pathname: string): string {
  return [version, timestamp, userId, method.toUpperCase(), pathname].join("\n");
}

async function signingKey(): Promise<CryptoKey | null> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !globalThis.crypto?.subtle) return null;
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Create a short-lived, request-bound proof for server-to-server dispatch. */
export async function createInternalAuthHeader(userId: string, pathname: string, method = "POST"): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !pathname.startsWith("/") || pathname.includes("\n")) return null;
  const key = await signingKey();
  if (!key) return null;
  const timestamp = String(Date.now());
  const payload = payloadFor(VERSION, timestamp, userId, method, pathname);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return VERSION + "." + timestamp + "." + userId + "." + encodeBase64Url(signature);
}

/** Verify a signed internal dispatch proof; invalid proofs never authenticate a user. */
export async function verifyInternalAuth(request: Request): Promise<string | null> {
  const value = request.headers.get(INTERNAL_HEADER);
  if (!value) return null;
  const [version, timestamp, userId, encodedSignature, extra] = value.split(".");
  if (extra !== undefined || version !== VERSION || !/^\d{13}$/.test(timestamp || "") || !/^[0-9a-f-]{36}$/i.test(userId || "")) return null;
  const at = Number(timestamp);
  const now = Date.now();
  if (!Number.isSafeInteger(at) || now - at > MAX_AGE_MS || at - now > MAX_FUTURE_SKEW_MS) return null;
  const signature = decodeBase64Url(encodedSignature || "");
  if (!signature) return null;
  const key = await signingKey();
  if (!key) return null;
  let pathname = "";
  try { pathname = new URL(request.url).pathname; } catch { return null; }
  const payload = payloadFor(version, timestamp, userId, request.method, pathname);
  try {
    const valid = await crypto.subtle.verify("HMAC", key, signature as BufferSource, encoder.encode(payload));
    return valid ? userId : null;
  } catch {
    return null;
  }
}
