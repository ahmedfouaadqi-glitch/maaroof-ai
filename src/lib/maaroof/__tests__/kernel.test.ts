import { describe, expect, it } from "vitest";
import { createKernelManifest, kernelPromptBlock } from "@/lib/maaroof/kernel.server";
import type { MaaroofSettings } from "@/lib/maaroof/settings.server";

const settings = {
  planner_model: "google/gemini-2.5-pro",
  fallback_model: "google/gemini-2.5-flash",
  enabled_tools: ["research", "analyze", "research"],
  execution_engine: { enabled: false },
  reality_engine: { enabled: false },
  model_governance: { enabled: false },
  council: { enabled: true },
  agent_factory: { enabled: true },
  capability_os: { enabled: true },
  cognitive: { enabled: true },
  platform_evolution: { execution_modes_enabled: true },
  knowledge: { enabled: true, recall_enabled: true },
} as unknown as MaaroofSettings;

describe("Maaroof kernel contract", () => {
  it("keeps workspace scope and allowed tools explicit", () => {
    const manifest = createKernelManifest({
      userId: "user-1",
      workspaceId: "workspace-1",
      executionMode: "execution",
      settings,
    });

    expect(manifest.workspaceId).toBe("workspace-1");
    expect(manifest.memoryScope).toBe("workspace:workspace-1");
    expect(manifest.allowedTools).toEqual(["analyze", "research"]);
    expect(manifest.approvalState).toBe("legacy_execution_path");
    expect(manifest.featureFlags.knowledge_recall).toBe(true);
  });

  it("marks non-executing modes and states the contract in the prompt", () => {
    const manifest = createKernelManifest({
      userId: "user-1",
      executionMode: "simulation",
      settings,
    });

    expect(manifest.memoryScope).toBe("user:user-1");
    expect(manifest.approvalState).toBe("no_tool_execution");
    expect(kernelPromptBlock(manifest)).toContain(
      "Simulation and recommendation are non-executing modes",
    );
  });
});
