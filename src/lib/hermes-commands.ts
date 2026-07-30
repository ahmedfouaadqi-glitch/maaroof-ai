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
  review: "مراجعة", analyze: "تحليل", monitor: "مراقبة", audit: "تدقيق",
  optimize: "تحسين", compare: "مقارنة", predict: "تنبؤ", investigate: "تحقيق",
  research: "بحث", create_proposal: "إنشاء اقتراح", update_roadmap: "تحديث خارطة الطريق",
  evaluate_experts: "تقييم الخبراء", evaluate_models: "تقييم النماذج", evaluate_mcp: "تقييم MCP",
  evaluate_architecture: "تقييم المعمارية", evaluate_costs: "تقييم الكلفة", evaluate_revenue: "تقييم الإيراد",
  evaluate_geo: "تقييم GEO", evaluate_seo: "تقييم SEO", evaluate_aso: "تقييم ASO",
  evaluate_branding: "تقييم العلامة", evaluate_social: "تقييم الحضور الاجتماعي",
  evaluate_security: "تقييم الأمان", evaluate_memory: "تقييم الذاكرة", evaluate_trust: "تقييم الثقة",
  evaluate_knowledge: "تقييم المعرفة", evaluate_state: "تقييم الحالة",
  evaluate_workspaces: "تقييم مساحات العمل", evaluate_users: "تقييم المستخدمين",
  evaluate_business: "تقييم الفرص التجارية",
};

export const TASK_STATUSES = [
  "waiting", "scheduled", "preparing", "learning", "running", "paused", "blocked",
  "needs_approval", "completed", "cancelled", "archived", "failed", "recovered",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS_AR: Record<string, string> = {
  waiting: "بالانتظار", scheduled: "مجدولة", preparing: "قيد التحضير", learning: "تعلّم",
  running: "قيد التنفيذ", paused: "موقوفة مؤقتاً", blocked: "محجوبة", needs_approval: "بانتظار الموافقة",
  completed: "مكتملة", cancelled: "ملغاة", archived: "مؤرشفة", failed: "فاشلة", recovered: "مستعادة",
};

export const EXECUTION_MODES = ["manual", "semi_auto", "auto"] as const;
export const EXECUTION_MODE_LABELS_AR: Record<string, string> = {
  manual: "يدوي", semi_auto: "نصف آلي", auto: "آلي",
};

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export const TASK_CATEGORIES = [
  "general", "architecture", "business", "growth", "revenue", "security",
  "optimization", "knowledge", "memory", "trust", "localization", "documentation",
  "models", "mcp", "experts",
] as const;
