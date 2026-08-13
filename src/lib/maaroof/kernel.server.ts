import type { MaaroofSettings } from "./settings.server";
import type { ExecutionMode } from "./orchestrator.server";

export const MAAROOF_KERNEL_VERSION = "0.1.0";
export const MAAROOF_POLICY_VERSION = "0.1.0";

export type KernelApprovalState =
  "no_tool_execution" | "legacy_execution_path" | "execution_engine_policy";

export type MaaroofKernelManifest = {
  kernelVersion: string;
  policyVersion: string;
  skillVersions: Record<string, string>;
  workspaceId: string | null;
  memoryScope: string;
  allowedTools: string[];
  approvalState: KernelApprovalState;
  evidencePolicy: "evidence_only_when_returned" | "reality_engine";
  modelAdapter: {
    planner: string;
    fallback: string;
    governanceEnabled: boolean;
  };
  featureFlags: Record<string, boolean>;
  executionMode: ExecutionMode;
};

type KernelManifestInput = {
  userId: string;
  workspaceId?: string | null;
  executionMode: ExecutionMode;
  settings: MaaroofSettings;
};

/**
 * Build the server-side identity/policy contract for one run.
 * This is metadata and prompt context; enforcement remains in RLS, settings,
 * the existing memory layer, and the existing tool catalog.
 */
export function createKernelManifest(input: KernelManifestInput): MaaroofKernelManifest {
  const { settings, workspaceId, executionMode } = input;
  const workspace = workspaceId || null;
  const executionEngine = settings.execution_engine || ({} as MaaroofSettings["execution_engine"]);
  const reality = settings.reality_engine || ({} as MaaroofSettings["reality_engine"]);

  return {
    kernelVersion: MAAROOF_KERNEL_VERSION,
    policyVersion: MAAROOF_POLICY_VERSION,
    skillVersions: {
      orchestrator: "repo-current",
      memory: "repo-current",
      knowledge: "repo-current",
      tool_catalog: "repo-current",
    },
    workspaceId: workspace,
    memoryScope: workspace ? `workspace:${workspace}` : `user:${input.userId}`,
    allowedTools: [...new Set(settings.enabled_tools || [])].sort(),
    approvalState:
      executionMode !== "execution"
        ? "no_tool_execution"
        : executionEngine.enabled
          ? "execution_engine_policy"
          : "legacy_execution_path",
    evidencePolicy: reality.enabled ? "reality_engine" : "evidence_only_when_returned",
    modelAdapter: {
      planner: settings.planner_model,
      fallback: settings.fallback_model,
      governanceEnabled: !!settings.model_governance?.enabled,
    },
    featureFlags: {
      council: !!settings.council?.enabled,
      agent_factory: !!settings.agent_factory?.enabled,
      capability_os: !!settings.capability_os?.enabled,
      cognitive: !!settings.cognitive?.enabled,
      execution_modes: !!settings.platform_evolution?.execution_modes_enabled,
      knowledge_recall: !!(settings.knowledge?.enabled && settings.knowledge?.recall_enabled),
      reality_engine: !!settings.reality_engine?.enabled,
      model_governance: !!settings.model_governance?.enabled,
    },
    executionMode,
  };
}

export function kernelPromptBlock(manifest: MaaroofKernelManifest): string {
  return `\n\n[MAAROOF KERNEL CONTRACT]\n${JSON.stringify(manifest)}\nUse this contract as runtime context. Respect workspace scope and allowed tools. Never claim that a tool, source, verification state, browser capability, provider, or execution happened unless the run evidence proves it. Simulation and recommendation are non-executing modes.\n`;
}
