// MCI Foundation types — pure, additive. Never imported by tool logic directly.

export type CognitiveStage =
  | "perception" | "understanding" | "envision" | "planning" | "council" | "conflict"
  | "tool_execution" | "reality" | "verification" | "final" | "learning";

export type TaskComplexity = "low" | "medium" | "high";
export type RiskLevel = "low" | "medium" | "high";
export type FailureStrategy = "fail_open_with_fallback" | "fail_safe_block";

export type ContextSourceType =
  | "user_profile" | "workspace" | "tool_result" | "knowledge" | "evidence"
  | "reality" | "web" | "engine_answer" | "manual";

export type KnowledgeClaimType =
  | "verified_fact" | "fact" | "inference" | "hypothesis" | "recommendation"
  | "opinion" | "temporary_observation" | "contested";

export type FreshnessClass = "live" | "competitive" | "structural";

export type ContextItem = {
  id: string;
  source: ContextSourceType;
  claimType: KnowledgeClaimType;
  entityKey?: string | null;
  content: string;
  /** 0..1 reliability as reported by verification/evidence layers (MCI never sets truth). */
  reliability?: number;
  createdAt: string;
  freshness?: FreshnessClass;
  tokens?: number;
};

export type ContextProvenance = {
  itemId: string;
  source: ContextSourceType;
  origin: string;
  stage: CognitiveStage;
  included: boolean;
  reason: string;
};
