// Server-only helper: convert a user's GeoScope into a human readable market
// description for AI prompts. Defaults to Iraq for backward compatibility.

export type GeoScope = {
  scope: "world" | "country" | "city" | "province";
  country?: string;
  city?: string;
};

export type MarketDescriptor = {
  /** Short label, e.g. "the Iraqi market", "the global market", "the Erbil, Iraq local market". */
  market: string;
  /** Audience phrase, e.g. "Iraqi users", "global users", "users in Erbil, Iraq". */
  audience: string;
  /** ISO/region label for compact prompt fields, e.g. "Iraq", "Global", "Erbil, Iraq". */
  region: string;
  /** Free-form context bullet listing local cues the model should anchor to. */
  contextHint: string;
};

export function describeMarket(scope?: GeoScope | null): MarketDescriptor {
  if (!scope || !scope.scope) {
    return {
      market: "the Iraqi market",
      audience: "Iraqi users",
      region: "Iraq",
      contextHint:
        "Iraqi cities (Baghdad, Erbil, Basra, Mosul, Najaf, Kirkuk, Sulaymaniyah), IQD pricing, Arabic/Kurdish phrasing, FastPay/Zain Cash/Asia Hawala, WhatsApp & Instagram dominance.",
    };
  }
  if (scope.scope === "world") {
    return {
      market: "a global / worldwide audience",
      audience: "global users (multi-region)",
      region: "Global",
      contextHint:
        "Use neutral, internationally understood phrasing. Avoid country-specific jargon, currencies, or local-only platforms unless the source explicitly mentions them.",
    };
  }
  if (scope.scope === "country" && scope.country) {
    return {
      market: `the ${scope.country} market`,
      audience: `users in ${scope.country}`,
      region: scope.country,
      contextHint: `Anchor to ${scope.country}: its major cities, local currency, dominant social/payment platforms, language/dialects, regulations, and cultural norms.`,
    };
  }
  if (scope.scope === "province" && (scope.country || scope.city)) {
    const region = [scope.city, scope.country].filter(Boolean).join(", ");
    return {
      market: `the ${region} regional market`,
      audience: `users in ${region}`,
      region,
      contextHint: `Anchor to ${region}: provincial cities/towns, regional dialect, local brands and customs, hyper-regional landmarks.`,
    };
  }
  if (scope.scope === "city" && (scope.city || scope.country)) {
    const place = [scope.city, scope.country].filter(Boolean).join(", ");
    return {
      market: `the ${place} local market`,
      audience: `users in ${place}`,
      region: place,
      contextHint: `Anchor hyper-locally to ${place}: neighborhoods/districts, landmarks, local businesses, street/area names, dialect, city-specific events.`,
    };
  }
  return describeMarket(null);
}

export function scopeCacheKey(scope?: GeoScope | null): string {
  if (!scope) return "iq";
  return `${scope.scope}:${scope.country || ""}:${scope.city || ""}`;
}
