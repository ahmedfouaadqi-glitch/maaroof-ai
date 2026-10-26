import { describe, expect, it } from "vitest";
import { getCompactGeoScopeDisplay } from "@/lib/geo-scope-display";

describe("compact geographic scope summary", () => {
  it("localizes the country name and resolves its flag and ISO code", () => {
    expect(getCompactGeoScopeDisplay({ scope: "country", country: "Lebanon" }, "ar")).toMatchObject({
      label: "لبنان",
      code: "LB",
      flag: "🇱🇧",
    });
  });

  it("accepts a saved ISO code as well as a country name", () => {
    expect(getCompactGeoScopeDisplay({ scope: "country", country: "IQ" }, "en")).toMatchObject({
      label: "Iraq",
      code: "IQ",
      flag: "🇮🇶",
    });
  });

  it("keeps worldwide and automatic scopes distinct from country scopes", () => {
    expect(getCompactGeoScopeDisplay({ scope: "world" }, "ar").label).toBe("العالم");
    expect(getCompactGeoScopeDisplay({ scope: "auto" }, "ar").label).toContain("تلقائي");
  });

  it("keeps the compact summary focused on the country even for a city scope", () => {
    expect(getCompactGeoScopeDisplay({ scope: "city", country: "Lebanon", city: "بيروت" }, "ar")).toEqual({
      label: "لبنان",
      code: "LB",
      flag: "🇱🇧",
    });
  });

  it("shows the selected region when no country is required by the current scope", () => {
    expect(getCompactGeoScopeDisplay({ scope: "region", region: "كردستان" }, "ar").label).toBe("كردستان");
  });
});
