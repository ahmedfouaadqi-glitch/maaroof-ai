import { describe, it, expect } from "vitest";
import { interviewSamplingParams } from "./model-params";
describe("interviewSamplingParams", () => {
  it("never sends temperature or reasoning_effort to openai models", () => {
    const p = interviewSamplingParams("openai/gpt-5-mini");
    expect(p).not.toHaveProperty("temperature");
    expect(p).not.toHaveProperty("reasoning_effort");
  });
  it("keeps temperature for gemini", () => {
    expect(interviewSamplingParams("google/gemini-2.5-flash").temperature).toBe(0.35);
  });
});
