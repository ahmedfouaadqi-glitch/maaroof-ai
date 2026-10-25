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

/** Validate and normalize a scope received from a UI or API. Invalid values never invent a location. */
export function normalizeGeoScope(value: unknown): GeoScope | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  let mode = v.mode;
  if (typeof mode !== "string" && typeof v.scope === "string") mode = v.scope;
  if (mode === "region" || mode === "province") mode = "city";
  if (mode !== "auto" && mode !== "world" && mode !== "country" && mode !== "city") return undefined;
  if (mode === "auto" || mode === "world") return { mode };
  const country = typeof v.country === "string" ? v.country.trim().slice(0, 120) : "";
  const city = typeof v.city === "string" ? v.city.trim().slice(0, 120) : "";
  if (mode === "country") return country ? { mode, country } : undefined;
  if (mode === "city") {
    const region = typeof v.region === "string" ? v.region.trim().slice(0, 120) : "";
    const place = [city, region].filter(Boolean).join(", ");
    if (place && country) return { mode, country, city: place };
    if (place) return { mode, city: place };
    return country ? { mode: "country", country } : undefined;
  }
  return undefined;
}

/**
 * Resolve a geographic target defensively. An unresolved automatic scope is explicit
 * instead of being silently relabelled as a real country or as a confirmed world scope.
 */
export function effectiveGeo(detected?: DetectedGeo | null, scope?: GeoScope | null) {
  const safeDetected: DetectedGeo = detected && typeof detected === "object"
    ? detected
    : { country: "", source: "none" };
  const selected = normalizeGeoScope(scope) || { mode: "auto" as const };
  const visitorCountry = typeof safeDetected.country === "string" ? safeDetected.country.trim() : "";
  const visitorCity = typeof safeDetected.city === "string" ? safeDetected.city.trim() : "";

  if (selected.mode === "auto") {
    if (visitorCountry) return { country: visitorCountry, city: visitorCity || undefined, label: [visitorCity, visitorCountry].filter(Boolean).join(", ") };
    return { country: "", city: undefined, label: "Visitor location unavailable; no country assumed" };
  }
  if (selected.mode === "world") return { country: "", city: undefined, label: "World" };

  const country = String(selected.country || "").trim();
  const city = selected.mode === "city" ? String(selected.city || "").trim() : "";
  if (selected.mode === "country" && !country) {
    return { country: "", city: undefined, label: "Country not selected" };
  }
  return { country, city: city || undefined, label: [city, country].filter(Boolean).join(", ") || "Location not specified" };
}
