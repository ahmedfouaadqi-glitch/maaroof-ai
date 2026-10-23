import { describe, it, expect } from "vitest";
import { marketStatus, nameConsistency, startStale } from "@/lib/market-names";

describe("market names", () => {
  const rows = [
    { country_code: "LB", name: "Maaroof Ai", lang: "en", status: "owner_confirmed" },
    { country_code: "SA", name: "Maaroof AI", lang: "en", status: "unconfirmed" },
    { country_code: "AE", name: "Marouf", lang: "en", status: "unconfirmed" },
  ];
  it("evidence beats owner confirmation", () => expect(marketStatus(rows, "LB", ["LB"])).toBe("evidence_confirmed"));
  it("owner confirmation is its own state", () => expect(marketStatus(rows, "LB")).toBe("owner_confirmed"));
  it("no proof stays unconfirmed", () => expect(marketStatus(rows, "SA")).toBe("unconfirmed"));
  it("flags spelling variants per language", () => expect(nameConsistency(rows)[0].variants.length).toBe(2));
});

describe("job start watchdog", () => {
  const created = new Date(0).toISOString();
  it("running with no events after 45s is stale", () => expect(startStale({ status: "running", created_at: created }, 0, 46_000)).toBe(true));
  it("not stale at 44s", () => expect(startStale({ status: "running", created_at: created }, 0, 44_000)).toBe(false));
  it("any event means it started", () => expect(startStale({ status: "running", created_at: created }, 1, 600_000)).toBe(false));
});
