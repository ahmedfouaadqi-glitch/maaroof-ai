import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Detect the visitor country from request headers set by the edge (Cloudflare).
 * Returns a 2-letter ISO country code, or "" when unknown (local dev / missing headers).
 * No PII is stored or returned.
 */
export const detectCountry = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const req = getRequest();
    const h = req?.headers;
    if (!h) return { country: "" as string };
    const cc =
      h.get("cf-ipcountry") ||
      h.get("x-vercel-ip-country") ||
      h.get("x-country") ||
      "";
    const clean = String(cc).trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(clean) || clean === "XX" || clean === "T1") return { country: "" };
    return { country: clean };
  } catch {
    return { country: "" };
  }
});
