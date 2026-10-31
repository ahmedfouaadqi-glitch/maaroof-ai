import { describe, it, expect } from "vitest";
import { toolCacheKey } from "@/lib/mci/resolver.server";
import { pickWorkspaceId } from "@/lib/workspace-guard.server";
import { readFileSync } from "node:fs";

const U = "11111111-1111-1111-1111-111111111111";

describe("workspace isolation", () => {
  it("the same tool request in two workspaces never shares a saved result", async () => {
    const a = await toolCacheKey("research", U, ["mengotti", "ar"], "ws-a");
    const b = await toolCacheKey("research", U, ["mengotti", "ar"], "ws-b");
    const main = await toolCacheKey("research", U, ["mengotti", "ar"], null);
    expect(a).not.toBe(b);
    expect(a).not.toBe(main);
  });

  it("reads the workspace id from a tool request", () => {
    expect(pickWorkspaceId({ workspace_id: "abc" })).toBe("abc");
    expect(pickWorkspaceId({})).toBeNull();
  });

  it("scanning a brand never writes its name onto the main account", () => {
    for (const f of ["src/routes/api/visibility.ts", "src/lib/agent.server.ts", "src/components/EngineProbePanel.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(/from\("profiles"\)[\s\S]{0,40}\.update\(\{\s*brand_name/.test(src)).toBe(false);
    }
  });
});
