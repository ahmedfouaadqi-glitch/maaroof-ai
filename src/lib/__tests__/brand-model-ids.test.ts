import { describe, it, expect } from "vitest";
import { brandModelIds } from "@/lib/maaroof/model-council";

describe("brandModelIds", () => {
  it("shows Maaroof instead of the model behind it", () => {
    expect(brandModelIds("تخطيط: openai/gpt-5-mini — إجابة: google/gemini-2.5-pro", "ar")).toBe("تخطيط: معروف — إجابة: معروف");
    expect(brandModelIds("Planning: openai/gpt-5-mini", "en")).toBe("Planning: Maaroof");
  });
  it("keeps the ten engine names being measured", () => {
    expect(brandModelIds("ChatGPT و Gemini ذكرا العلامة", "ar")).toBe("ChatGPT و Gemini ذكرا العلامة");
  });
});
