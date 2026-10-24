// Server-only helper: convert a user's GeoScope into a human readable market
// description for AI prompts. Defaults to a GLOBAL / worldwide audience.
// Local specificity only kicks in when the user picks a country / region /
// province / city.

export type GeoScope = {
  scope: "world" | "country" | "region" | "province" | "city";
  country?: string;
  /** Region / province / city name depending on `scope`. */
  city?: string;
  region?: string;
};

export type MarketDescriptor = {
  /** Short label, e.g. "a global / worldwide audience", "the Germany market". */
  market: string;
  /** Audience phrase, e.g. "global users", "users in Erbil, Iraq". */
  audience: string;
  /** Region label for compact prompt fields, e.g. "Global", "Erbil, Iraq". */
  region: string;
  /** Free-form context bullet listing cues the model should anchor to. */
  contextHint: string;
};

const GLOBAL: MarketDescriptor = {
  market: "a global / worldwide audience",
  audience: "global users (multi-region, multilingual)",
  region: "Global",
  contextHint:
    "Use neutral, internationally understood phrasing that works across regions and languages. Do not assume any single country, currency, dialect or local platform unless the source content explicitly mentions it.",
};

function place(scope: GeoScope): string {
  return [scope.city, scope.region, scope.country].filter(Boolean).join(", ");
}

export function describeMarket(scope?: GeoScope | null): MarketDescriptor {
  if (!scope || !scope.scope || scope.scope === "world") return GLOBAL;

  if (scope.scope === "country" && scope.country) {
    return {
      market: `the ${scope.country} market`,
      audience: `users in ${scope.country}`,
      region: scope.country,
      contextHint: `Anchor to ${scope.country}: its major cities, local currency, dominant social/payment platforms, language/dialects, regulations, and cultural norms.`,
    };
  }

  if (scope.scope === "region") {
    const p = place(scope) || scope.region || "";
    if (!p) return GLOBAL;
    return {
      market: `the ${p} regional market`,
      audience: `users across ${p}`,
      region: p,
      contextHint: `Anchor to the wider ${p} region: shared languages, cross-border commerce, regional platforms, currencies and cultural references common across ${p}.`,
    };
  }

  if (scope.scope === "province") {
    const p = place(scope);
    if (!p) return GLOBAL;
    return {
      market: `the ${p} provincial market`,
      audience: `users in ${p}`,
      region: p,
      contextHint: `Anchor to ${p}: provincial cities/towns, regional dialect, local brands and customs, hyper-regional landmarks.`,
    };
  }

  if (scope.scope === "city") {
    const p = place(scope);
    if (!p) return GLOBAL;
    return {
      market: `the ${p} local market`,
      audience: `users in ${p}`,
      region: p,
      contextHint: `Anchor hyper-locally to ${p}: neighborhoods/districts, landmarks, local businesses, street/area names, dialect, city-specific events.`,
    };
  }

  return GLOBAL;
}

export function scopeCacheKey(scope?: GeoScope | null): string {
  if (!scope) return "world";
  return `${scope.scope}:${scope.country || ""}:${scope.region || ""}:${scope.city || ""}`;
}
