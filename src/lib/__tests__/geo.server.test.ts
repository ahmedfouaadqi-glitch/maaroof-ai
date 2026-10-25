import { describe, expect, it } from "vitest";
import { effectiveGeo, normalizeGeoScope } from "@/lib/maaroof/geo.server";

describe("geographic scope", () => {
  it("does not invent a country when visitor location is unavailable", () => {
    expect(effectiveGeo(undefined, { mode: "auto" })).toEqual({
      country: "",
      city: undefined,
      label: "Visitor location unavailable; no country assumed",
    });
  });

  it("uses request-derived visitor location for automatic scope", () => {
    expect(effectiveGeo({ country: "IQ", city: "Baghdad", source: "cf" }, { mode: "auto" })).toEqual({
      country: "IQ",
      city: "Baghdad",
      label: "Baghdad, IQ",
    });
  });

  it("keeps worldwide selection distinct from unresolved automatic location", () => {
    expect(effectiveGeo({ country: "IQ", source: "cf" }, { mode: "world" })).toEqual({
      country: "",
      city: undefined,
      label: "World",
    });
  });

  it("normalizes UI region/province scopes without inventing fields", () => {
    expect(normalizeGeoScope({ scope: "region", country: "Iraq", region: "Kurdistan" })).toEqual({
      mode: "city",
      country: "Iraq",
      city: "Kurdistan",
    });
    expect(normalizeGeoScope({ scope: "country", country: "" })).toBeUndefined();
  });

  it("never throws for malformed scope or missing detection", () => {
    expect(() => effectiveGeo(null, null)).not.toThrow();
    expect(() => effectiveGeo(undefined, { mode: "city" } as any)).not.toThrow();
    expect(effectiveGeo(undefined, { mode: "city" } as any).country).toBe("");
  });
});
