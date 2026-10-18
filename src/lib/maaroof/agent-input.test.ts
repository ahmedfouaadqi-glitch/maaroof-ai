import { describe, it, expect } from "vitest";
import {
  fillToolInput,
  missingFields,
  removePlaceholderCompetitors,
  sanitizeReflection,
} from "./agent-input";

describe("agent-input", () => {
  it("fills the tool's own brand key with priority goal > workspace > profile", () => {
    const ctx = { goalBrand: "G", workspace: { name: "W" }, profile: { brand_name: "P" } };
    expect(fillToolInput("brand_boost", {}, ctx).brand_name).toBe("G");
    expect(
      fillToolInput("company_email", {}, { workspace: { name: "W" }, profile: { brand_name: "P" } })
        .company,
    ).toBe("W");
    expect(fillToolInput("visibility", {}, { profile: { brand_name: "P" } }).brand).toBe("P");
  });
  it("never overwrites planner values", () => {
    expect(fillToolInput("visibility", { brand: "X" }, { goalBrand: "G" }).brand).toBe("X");
  });
  it("reports missing required fields", () => {
    expect(missingFields("visibility", fillToolInput("visibility", {}, {}))).toEqual(["brand"]);
    expect(
      missingFields("research", fillToolInput("research", {}, { goal: "best perfume shops" })),
    ).toEqual([]);
  });
  it("turns JSON reflections into plain text", () => {
    const fence = String.fromCharCode(96).repeat(3);
    expect(
      sanitizeReflection(
        fence + "json\n" + '{"decision":"stop","why":"brand missing"}' + "\n" + fence,
      ),
    ).toBe("stop — brand missing");
    expect(sanitizeReflection("continue")).toBe("continue");
  });
  it("removes placeholder competitor names while preserving real competitor names", () => {
    const result = removePlaceholderCompetitors({
      brand: "Maaroof",
      competitors: ["Competitor A", "Example Competitor", "شركة النور", "المنافس الأول", "Rival 2"],
    });
    expect(result.input.competitors).toEqual(["شركة النور"]);
    expect(result.removed).toEqual([
      "Competitor A",
      "Example Competitor",
      "المنافس الأول",
      "Rival 2",
    ]);
  });
  it("leaves explicit real competitors, including named objects, untouched", () => {
    const result = removePlaceholderCompetitors({
      competitors: ["Toyota", "Samsung", { name: "Kia" }],
    });
    expect(result.input.competitors).toEqual(["Toyota", "Samsung", { name: "Kia" }]);
    expect(result.removed).toEqual([]);
  });
});
