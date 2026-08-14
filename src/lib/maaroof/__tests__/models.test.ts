import { describe, expect, it } from "vitest";
import { selectModel, summarizeModelRegistry, type ModelRow } from "@/lib/maaroof/models.server";

const rows: ModelRow[] = [
  {
    model_key: "google/gemini-2.5-flash",
    provider: "google",
    version: "2.5",
    capabilities: { reasoning: 70 },
    strengths: [],
    weaknesses: [],
    speed: 90,
    latency_ms: 500,
    reliability: 0.98,
    cost_in_usd_per_mtok: 0.3,
    cost_out_usd_per_mtok: 2.5,
    recommended_use_cases: [],
    limitations: [],
    status: "active",
  },
  {
    model_key: "google/gemini-2.5-pro",
    provider: "google",
    version: "2.5",
    capabilities: { reasoning: 95 },
    strengths: [],
    weaknesses: [],
    speed: 60,
    latency_ms: 900,
    reliability: 0.99,
    cost_in_usd_per_mtok: 1.25,
    cost_out_usd_per_mtok: 10,
    recommended_use_cases: [],
    limitations: [],
    status: "active",
  },
];

describe("model governance boundary", () => {
  it("summarizes only active registry rows", () => {
    expect(summarizeModelRegistry(rows)).toMatchObject({
      activeModels: 2,
      providers: ["google"],
      realRegistry: true,
      hasGovernedOptions: true,
    });
  });

  it("keeps selection deterministic and zero-cost", async () => {
    const choice = await selectModel({
      phase: "planning",
      enabled: true,
      defaultModel: "google/gemini-2.5-pro",
      fallbackModel: "google/gemini-2.5-flash",
      preferredModels: ["google/gemini-2.5-pro"],
      registry: rows,
    });
    expect(choice.governed).toBe(true);
    expect(choice.model).toBe("google/gemini-2.5-pro");
    expect(choice.reason).toContain("مرحلة");
  });
});
