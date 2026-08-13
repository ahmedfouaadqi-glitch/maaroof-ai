import type { MaaroofSettings } from "./settings.server";
import { resolveBrowserCapability, type BrowserCapability, type BrowserPath } from "./browser.server";
import type { ExecutionMode } from "./orchestrator.server";

export const MAAROOF_KERNEL_VERSION = "0.2.0";
export const MAAROOF_POLICY_VERSION = "0.2.0";

export type KernelApprovalState =
  | "no_tool_execution"
  | "legacy_execution_path"
  | "execution_engine_policy";

export type KernelManifest = {
  kernelVersion: string;
  policyVersion: string;
  skillVersions: Record<string, string>;
  workspaceId: string | null;
  memoryScope: string;
  allowedTools: string[];
  approvalState: KernelApprovalState;
  evidencePolicy: "evidence_only_when_returned" | "reality_engine";
  executionPolicy: {
    selectedMode: ExecutionMode;
    modeSelectionEnabled: boolean;
    toolExecutionAllowed: boolean;
    requiresApproval: boolean;
    legacyFallback: boolean;
    nonExecutingModesProtected: boolean;
  };
  memoryPolicy: {
    scope: "workspace" | "user";
    workspaceIsolated: boolean;
    consentEnforcedByMemoryLayer: boolean;
  };
  knowledgePolicy: {
    enabled: boolean;
    recallEnabled: boolean;
    sourceOfTruth: "knowledge_nodes_and_teaching_spaces";
  };
  browser: BrowserCapability;
  modelAdapter: {
    planner: string;
    fallback: string;
    governanceEnabled: boolean;
  };
  featureFlags: Record<string, boolean>;
  executionMode: ExecutionMode;
};

export type MaaroofKernelManifest = KernelManifest;

type KernelManifestInput = {
  userId: string;
  workspaceId?: string | null;
  executionMode: ExecutionMode;
  browserPath?: BrowserPath;
  settings: MaaroofSettings;
};

/**
 * Build the server-side identity/policy contract for one run.
 * This is metadata and prompt context; enforcement remains in RLS, settings,
 * the existing memory layer, and the existing tool catalog.
 */
export function createKernelManifest(input: KernelManifestInput): KernelManifest {
  const { settings, workspaceId, executionMode } = input;
  const workspace = workspaceId || null;
  const executionEngine = settings.execution_engine || ({} as MaaroofSettings["execution_engine"]);
  const reality = settings.reality_engine || ({} as MaaroofSettings["reality_engine"]);
  const modeSelectionEnabled = !!settings.platform_evolution?.execution_modes_enabled;
  const knowledgeEnabled = !!settings.knowledge?.enabled;
  const recallEnabled = knowledgeEnabled && !!settings.knowledge?.recall_enabled;
  const memoryScope = workspace ? `workspace:${workspace}` : `user:${input.userId}`;

  return {
    kernelVersion: MAAROOF_KERNEL_VERSION,
    policyVersion: MAAROOF_POLICY_VERSION,
    skillVersions: {
      orchestrator: "repo-current",
      memory: "repo-current",
      knowledge: "repo-current",
      tool_catalog: "repo-current",
      verification: "repo-current",
    },
    workspaceId: workspace,
    memoryScope,
    allowedTools: [...new Set(settings.enabled_tools || [])].sort(),
    approvalState:
      executionMode !== "execution"
        ? "no_tool_execution"
        : executionEngine.enabled
          ? "execution_engine_policy"
          : "legacy_execution_path",
    evidencePolicy: reality.enabled ? "reality_engine" : "evidence_only_when_returned",
    executionPolicy: {
      selectedMode: executionMode,
      modeSelectionEnabled,
      toolExecutionAllowed: executionMode === "execution",
      requiresApproval: executionMode === "execution" && !!executionEngine.enabled && executionEngine.require_approval !== false,
      legacyFallback: !modeSelectionEnabled,
      nonExecutingModesProtected: true,
    },
    memoryPolicy: {
      scope: workspace ? "workspace" : "user",
      workspaceIsolated: true,
      consentEnforcedByMemoryLayer: true,
    },
    knowledgePolicy: {
      enabled: knowledgeEnabled,
      recallEnabled,
      sourceOfTruth: "knowledge_nodes_and_teaching_spaces",
    },
    browser: resolveBrowserCapability(input.browserPath, settings),
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
      execution_modes: modeSelectionEnabled,
      knowledge_recall: recallEnabled,
      reality_engine: !!settings.reality_engine?.enabled,
      model_governance: !!settings.model_governance?.enabled,
      execution_engine: !!settings.execution_engine?.enabled,
    },
    executionMode,
  };
}

export function kernelPromptBlock(manifest: KernelManifest): string {
  return `\n\n[MAAROOF KERNEL CONTRACT]\n${JSON.stringify(manifest)}\nUse this contract as runtime context. Respect workspace scope, consent, evidence policy, and allowed tools. Never claim that a tool, source, verification state, browser capability, provider, storage connector, or execution happened unless the run evidence proves it. Simulation and recommendation are non-executing modes. This contract does not create external integrations by itself.\n`;
}
