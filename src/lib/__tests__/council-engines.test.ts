import { describe, it, expect } from "vitest";
import { councilEngines } from "@/lib/maaroof/pipeline-cards";

const KEYS = ["chatgpt", "gemini", "claude"] as const;
describe("councilEngines", () => {
  it("all waiting with no events", () => {
    expect(councilEngines([], KEYS, true).map((e) => e.status)).toEqual(["waiting", "waiting", "waiting"]);
  });
  it("asking while visibility tool runs", () => {
    expect(councilEngines([{ type: "tool_call", data: { tool: "visibility" } }], KEYS, true)[0].status).toBe("asking");
  });
  it("answered vs unresponsive from recorded probe", () => {
    const ev = [{ type: "tool_result", data: { tool: "visibility", ok: true, output: { probe: { asked: ["chatgpt", "gemini"], answers: [{ engine: "chatgpt", mentioned: true, rank: 2, answer: "x", brands: ["A"] }] } } } }];
    const r = councilEngines(ev, KEYS, false);
    expect(r[0]).toMatchObject({ status: "answered", mentioned: true, rank: 2 });
    expect(r[1].status).toBe("unresponsive");
    expect(r[2].status).toBe("waiting");
  });
});
