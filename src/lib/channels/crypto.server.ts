// Server-only: encryption for per-user publishing channel tokens.
// Never import from client code.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env["CHANNEL_TOKEN_SECRET"];
  if (!raw) throw new Error("CHANNEL_TOKEN_SECRET is not set");
  // Secret is an opaque random string — derive a stable 32-byte key from it.
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptSecret(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

/** Encrypt a JSON config bag (tokens + ids) into one opaque column value. */
export function sealConfig(obj: Record<string, unknown>): string {
  return encryptSecret(JSON.stringify(obj));
}

export function openConfig(stored: string): Record<string, any> {
  try {
    return JSON.parse(decryptSecret(stored));
  } catch {
    return {};
  }
}
