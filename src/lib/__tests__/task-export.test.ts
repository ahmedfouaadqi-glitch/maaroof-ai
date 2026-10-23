import { describe, it, expect } from "vitest";
import { buildTaskExportPayload } from "@/lib/maaroof/task-export";
import { taskEntity, taskEntityInput } from "@/lib/maaroof/agent-input";

const results = [
  { tool: "known", ok: true, output: { brand: "Mengotti Couture", url: "https://mengotti.example", faqs: [{ q: "Where?", a: "Milan" }], note: "via Firecrawl https://src.example/a" } },
  { tool: "visibility", ok: true, output: { probe: { answers: [{ engine: "chatgpt", mentioned: true, rank: 2, answer: "x", sources: [{ url: "https://cite.example" }] }] } } },
];

describe("task export", () => {
  it("includes engine answers, machine pack for the examined entity, and real links", () => {
    const p = buildTaskExportPayload({ title: "R", goal: "g", finalText: "done", results, lang: "en" });
    const j = JSON.stringify(p);
    expect(j).toContain("ChatGPT");
    expect(j).toContain("Mengotti Couture");
    expect(j).toContain("FAQPage");
    expect(j).toContain("https://cite.example");
    expect(j).not.toMatch(/firecrawl/i);
  });
  it("later steps inherit the examined entity, not the account", () => {
    expect(taskEntity(results)?.brand).toBe("Mengotti Couture");
    expect(taskEntityInput("brand_authority", {}, results).url).toBe("https://mengotti.example");
  });
});
