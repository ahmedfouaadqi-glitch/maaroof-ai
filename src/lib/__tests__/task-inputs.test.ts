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

import { councilEngines } from "@/lib/maaroof/pipeline-cards";
describe("ten-model card says why a model was not asked", () => {
  it("probe disabled by user", () => {
    const ev = [{ type: "tool_result", data: { tool: "visibility", ok: false, output: { skipped: "live_probe_disabled_by_user" } } }];
    expect(councilEngines(ev as any, ["chatgpt"], false)[0].why).toBe("probe_disabled");
  });
  it("task ended before probe vs still running", () => {
    expect(councilEngines([], ["chatgpt"], false)[0].why).toBe("job_ended");
    expect(councilEngines([], ["chatgpt"], true)[0].why).toBe("not_reached");
  });
});
