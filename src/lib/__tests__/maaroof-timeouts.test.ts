import { describe, it, expect } from "vitest";
import { toolTimeoutMs, withTimeout, STAGE_TIMEOUTS } from "@/lib/maaroof/timeouts";
import { TOOL_UI, toolName } from "@/components/workspace/SkillToolsPanel";
import { TOOL_CATALOG } from "@/lib/tool-catalog";

describe("time budgets", () => {
  it("light tool 45s", () => expect(toolTimeoutMs("translate")).toBe(45_000));
  it("medium tool 90s", () => expect(toolTimeoutMs("compare")).toBe(90_000));
  it("heavy tool 180s", () => expect(toolTimeoutMs("research")).toBe(180_000));
  it("ten-model council 150s", () => expect(toolTimeoutMs("visibility")).toBe(150_000));
  it("planning 60s", () => expect(STAGE_TIMEOUTS.plan).toBe(60_000));
  it("withTimeout rejects a hung stage", async () => {
    await expect(withTimeout(new Promise(() => {}), 10, "setup")).rejects.toThrow("stage_timeout:setup");
  });
});

describe("direct tools", () => {
  const userTools = TOOL_CATALOG.filter((t) => t.group === "tools" && !["maaroof", "translate", "brand_authority", "geo_rewrite"].includes(t.key));
  it("every user tool has a screen", () => { for (const t of userTools) expect(TOOL_UI[t.key], t.key).toBeTruthy(); });
  it("names follow the language", () => {
    expect(toolName("research", "en")).toBe("Smart Research");
    expect(toolName("research", "ar")).toBe("بحث ذكي");
    expect(toolName("research", "ku")).toBe("گەڕانی زیرەک");
  });
});
