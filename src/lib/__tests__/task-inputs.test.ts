import { describe, it, expect } from "vitest";
import { fillFromTask, priorCompetitors } from "@/lib/maaroof/agent-input";

const prior = [
  { tool: "known", ok: true, output: { brands: ["Webspot", "Maaroof Ai", "Nexa"] } },
  { tool: "research", ok: false, output: { competitors: ["Fake"] } },
];
describe("tool inputs from earlier task steps", () => {
  it("compare gets competitors named by earlier successful steps, not own brand or failed ones", () => {
    expect(priorCompetitors(prior, "Maaroof Ai")).toEqual(["Webspot", "Nexa"]);
    expect(fillFromTask("compare", { brand: "Maaroof Ai" }, prior).competitors).toEqual(["Webspot", "Nexa"]);
  });
  it("competitor_monitor without valid action defaults to create", () => {
    expect(fillFromTask("competitor_monitor", { action: "bogus" }, []).action).toBe("create");
    expect(fillFromTask("competitor_monitor", { action: "list" }, []).action).toBe("list");
  });
  it("never overwrites competitors already set", () => {
    expect(fillFromTask("compare", { brand: "x", competitors: ["A"] }, prior).competitors).toEqual(["A"]);
  });
});
