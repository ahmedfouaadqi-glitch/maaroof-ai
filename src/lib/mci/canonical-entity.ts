// Separates the request fingerprint (cache identity) from the canonical entity
// key (cross-tool identity, e.g. "iq:brand:zain"). Pure.
import { requestFingerprint } from "./registry";

export type CanonicalEntity = { fingerprint: string; entityKey: string; market: string; name: string };

export function normalizeEntityName(input: string): string {
  return String(input || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "") // Arabic diacritics + tatweel
    .replace(/[أإآ]/g, "ا")
    .replace(/https?:\/\/(www\.)?/g, "")
    .replace(/\.(com|net|org|iq|io|ai|co)(\/.*)?$/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveCanonicalEntity(
  input: string,
  marketCode = "WORLD",
  kind = "brand",
  extra: (string | null | undefined)[] = [],
): CanonicalEntity {
  const market = String(marketCode || "WORLD").trim().toLowerCase() || "world";
  const name = normalizeEntityName(input);
  return {
    name,
    market,
    entityKey: `${market}:${kind}:${name}`,
    fingerprint: requestFingerprint([input, marketCode, ...extra]),
  };
}
