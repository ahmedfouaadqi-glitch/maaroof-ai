// Detect visitor location from request headers (Cloudflare-first).
// Returns { country, city, source }. Never throws.
export type DetectedGeo = { country: string; city?: string; source: "cf" | "vercel" | "fallback" | "none" };

export function detectGeoFromRequest(request: Request): DetectedGeo {
  try {
    const h = request.headers;
    const cc = (h.get("cf-ipcountry") || h.get("x-vercel-ip-country") || h.get("x-country") || "").trim().toUpperCase();
    const city = h.get("cf-ipcity") || h.get("x-vercel-ip-city") || undefined;
    if (cc && /^[A-Z]{2}$/.test(cc) && cc !== "XX" && cc !== "T1") {
      const source = h.get("cf-ipcountry") ? "cf" : h.get("x-vercel-ip-country") ? "vercel" : "fallback";
      return { country: cc, city: city ? decodeURIComponent(city) : undefined, source: source as any };
    }
  } catch {}
  return { country: "", source: "none" };
}

export type GeoScope = { mode: "auto" | "country" | "city" | "world"; country?: string; city?: string };

export function effectiveGeo(detected: DetectedGeo, scope?: GeoScope) {
  if (!scope || scope.mode === "auto") {
    return { country: detected.country || "", city: detected.city, label: detected.country || "World" };
  }
  if (scope.mode === "world") return { country: "", city: undefined, label: "World" };
  return { country: scope.country || "", city: scope.city, label: [scope.city, scope.country].filter(Boolean).join(", ") || "World" };
}
