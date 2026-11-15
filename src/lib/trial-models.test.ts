import { describe, it, expect } from "vitest";
import { pickTrialModels } from "./trial-models";

const catalog = { chatgpt: { model: "openai/gpt-5" }, gemini: { model: "google/gemini-2.5-pro" }, claude: { model: "openai/gpt-5" } };

describe("pickTrialModels", () => {
  it("picks three different providers when OpenRouter is available", () => {
    const r = pickTrialModels(catalog, true)!;
    expect(r.map((m) => m.model.split("/")[0])).toEqual(["openai", "google", "anthropic"]);
  });
  it("uses a fast non-reasoning model for ChatGPT when OpenRouter is available", () => {
    expect(pickTrialModels(catalog, true)![0].model).toBe("openai/gpt-4o-mini");
  });
  it("refuses with only two real providers", () => {
    expect(pickTrialModels(catalog, false)).toBeNull();
  });
});
