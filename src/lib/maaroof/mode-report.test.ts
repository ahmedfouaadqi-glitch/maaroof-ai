import { describe, it, expect } from "vitest";
import { sanitizeReport, planAsList, simulationSummary } from "./mode-report";

describe("mode-report", () => {
  it("removes code and JSON", () => {
    expect(sanitizeReport("Hi\n```json\n{\"a\":1}\n```\nBye")).not.toContain("{");
    expect(sanitizeReport('{"steps":[]}')).toBe("");
  });
  it("lists plan without JSON", () => {
    const t = planAsList({ steps: [{ tool: "visibility", why: "baseline" }] }, "ar");
    expect(t).toContain("1. visibility — baseline");
    expect(t).not.toContain("{");
  });
  it("labels simulation as estimate", () => {
    expect(simulationSummary({ steps: [] }, [], null, "en")).toContain("estimate");
  });
});
