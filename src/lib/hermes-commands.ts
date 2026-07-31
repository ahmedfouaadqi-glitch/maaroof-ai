// Part 18 — single source of truth for the Executive Command Center vocabulary.
// Client-safe on purpose: both the UI and hermes.server.ts import from here so
// the command list and task statuses are never duplicated.

export const EXECUTIVE_COMMANDS = [
  "review", "analyze", "monitor", "audit", "optimize", "compare", "predict",
  "investigate", "research", "create_proposal", "update_roadmap",
  "evaluate_experts", "evaluate_models", "evaluate_mcp", "evaluate_architecture",
  "evaluate_costs", "evaluate_revenue", "evaluate_geo", "evaluate_seo", "evaluate_aso",
  "evaluate_branding", "evaluate_social", "evaluate_security", "evaluate_memory",
  "evaluate_trust", "evaluate_knowledge", "evaluate_state", "evaluate_workspaces",
  "evaluate_users", "evaluate_business",
] as const;
export type ExecutiveCommand = (typeof EXECUTIVE_COMMANDS)[number];

export const COMMAND_LABELS_AR: Record<string, string> = {
  review: "auto.review", analyze: "auto.analysis", monitor: "auto.monitoring", audit: "auto.audit",
  optimize: "auto.optimization", compare: "auto.compare", predict: "auto.prediction", investigate: "auto.achievement",
  research: "auto.search", create_proposal: "auto.create_suggestion", update_roadmap: "auto.roadmap_update",
  evaluate_experts: "auto.expert_evaluation", evaluate_models: "auto.models_evaluation", evaluate_mcp: "auto.mcp_evaluation",
  evaluate_architecture: "auto.architecture_evaluation", evaluate_costs: "auto.cost_evaluation", evaluate_revenue: "auto.revenue_evaluation",
  evaluate_geo: "auto.geo_evaluation", evaluate_seo: "auto.seo_evaluation", evaluate_aso: "auto.aso_evaluation",
  evaluate_branding: "auto.brand_evaluation", evaluate_social: "auto.social_presence_evaluation",
  evaluate_security: "auto.security_assessment", evaluate_memory: "auto.memory_evaluation", evaluate_trust: "auto.trust_evaluation",
  evaluate_knowledge: "auto.knowledge_evaluation", evaluate_state: "auto.status_evaluation",
  evaluate_workspaces: "auto.workspaces_evaluation", evaluate_users: "auto.user_evaluation",
  evaluate_business: "auto.business_opportunity_evaluation",
};

export const TASK_STATUSES = [
  "waiting", "scheduled", "preparing", "learning", "running", "paused", "blocked",
  "needs_approval", "completed", "cancelled", "archived", "failed", "recovered",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS_AR: Record<string, string> = {
  waiting: "auto.pending", scheduled: "auto.scheduled", preparing: "auto.in_preparation", learning: "auto.learn",
  running: "auto.in_progress", paused: "auto.paused", blocked: "auto.blocked", needs_approval: "auto.awaiting_approval",
  completed: "auto.completed_2", cancelled: "auto.canceled", archived: "auto.archived", failed: "auto.failed", recovered: "auto.restored",
};

export const EXECUTION_MODES = ["manual", "semi_auto", "auto"] as const;
export const EXECUTION_MODE_LABELS_AR: Record<string, string> = {
  manual: "auto.manual", semi_auto: "auto.semi_automatic", auto: "auto.automatic",
};

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export const TASK_CATEGORIES = [
  "general", "architecture", "business", "growth", "revenue", "security",
  "optimization", "knowledge", "memory", "trust", "localization", "documentation",
  "models", "mcp", "experts",
] as const;
