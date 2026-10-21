import { describe, it, expect } from "vitest";
import { sidebarCollapsed } from "./WorkspaceShell";
import { MAAROOF_SKILLS, skillFramework } from "@/lib/maaroof/skill-catalog";
import { TOOL_CATALOG } from "@/lib/tool-catalog";

describe("workspace sidebar", () => {
  it("collapses while a task runs", () => expect(sidebarCollapsed(false, true)).toBe(true));
  it("stays open when idle and user did not collapse", () => expect(sidebarCollapsed(false, false)).toBe(false));
  it("stays collapsed after task if user collapsed it", () => expect(sidebarCollapsed(true, false)).toBe(true));
});

describe("skills catalog", () => {
  it("has 17 skills", () => expect(MAAROOF_SKILLS.length).toBe(17));
  it("every skill maps to real tools and has a full framework", () => {
    const keys = new Set(Object.keys(TOOL_CATALOG as any));
    for (const s of MAAROOF_SKILLS) {
      expect(s.tools.length).toBeGreaterThan(0);
      for (const t of s.tools) expect(keys.has(t), `${s.key}:${t}`).toBe(true);
      const f = skillFramework(s, "ar");
      for (const v of Object.values(f)) expect(v.length).toBeGreaterThan(0);
    }
  });
});
