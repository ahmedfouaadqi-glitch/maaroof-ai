import { TOOL_CATALOG, type ToolKey } from "@/lib/tool-catalog";

export type ReasoningIntent =
  | "brand_visibility"
  | "content_creation"
  | "research"
  | "competitive_intelligence"
  | "business_strategy"
  | "social_analysis"
  | "translation"
  | "marketing_strategy"
  | "general";

export type ReasoningRisk = "low" | "moderate" | "high";

export interface ReasoningContext {
  primaryIntent: ReasoningIntent;
  intents: ReasoningIntent[];
  risk: ReasoningRisk;
  evidenceRequired: boolean;
  externalActionRequested: boolean;
  signals: string[];
}

export interface ReasoningPlanStep {
  tool: string;
  input?: unknown;
  reason?: unknown;
  depends_on?: unknown;
}

export interface ReasoningPlanValidation {
  steps: Array<{ tool: ToolKey; input: Record<string, unknown>; reason?: string; depends_on: string[] }>;
  rejectedTools: string[];
  rejectedDependencies: string[];
  coverageWarnings: string[];
}

const INTENT_RULES: Array<{ intent: ReasoningIntent; patterns: RegExp[] }> = [
  { intent: "brand_visibility", patterns: [/\b(?:geo|seo|aeo|sge|gseo|sgeo|visibility|ranking|search engine|ai engine|technical audit|site audit)\b/i, /ظهور|مرئي(?:ة|ه)|ترتيب|محركات البحث|محركات الذكاء|تحسين الموقع|تدقيق الموقع|سيو/i] },
  { intent: "content_creation", patterns: [/\b(?:write|rewrite|content|copywriting|blog|article|post|caption|humanize)\b/i, /اكتب|كتابة|صياغة|محتوى|مقال|منشور|بوست|إعادة كتابة|اعادة كتابة/i] },
  { intent: "research", patterns: [/\b(?:research|investigate|study|find out|sources|evidence|report)\b/i, /بحث|ابحث|دراسة|تحقق|مصادر|أدلة|ادلة|تقرير/i] },
  { intent: "competitive_intelligence", patterns: [/\b(?:competitor|competitive|rival|benchmark|market gap)\b/i, /منافس|منافسين|مقارنة تنافسية|تحليل المنافسة|فجوة السوق/i] },
  { intent: "business_strategy", patterns: [/\b(?:business model|feasibility|pricing|forecast|budget|market size|investment|growth plan)\b/i, /جدوى|نموذج عمل|تسعير|توقعات مالية|ميزانية|حجم السوق|استثمار|خطة نمو/i] },
  { intent: "social_analysis", patterns: [/\b(?:social media|instagram|facebook|tiktok|youtube|social analysis)\b/i, /سوشيال|تواصل اجتماعي|انستغرام|إنستغرام|فيسبوك|تيك توك|يوتيوب/i] },
  { intent: "translation", patterns: [/\b(?:translate|translation|locali[sz]e)\b/i, /ترجم|ترجمة|تعريب|توطين لغوي/i] },
  { intent: "marketing_strategy", patterns: [/\b(?:marketing|campaign|brand strategy|positioning|acquisition|funnel)\b/i, /تسويق|حملة|استراتيجية العلامة|تموضع|اكتساب العملاء|قمع تسويقي/i] },
];

const TOOL_COVERAGE: Partial<Record<ReasoningIntent, ToolKey[]>> = {
  brand_visibility: ["analyze", "visibility", "brand_authority", "applied_ranking", "keyword_intelligence"],
  content_creation: ["suggest", "geo_rewrite"],
  research: ["research", "known"],
  competitive_intelligence: ["compare", "known", "keyword_intelligence"],
  business_strategy: ["feasibility", "bizdev", "what_if"],
  social_analysis: ["social_analysis"],
  translation: ["translate"],
  marketing_strategy: ["geo_strategist", "suggest", "bizdev"],
};

const TOOL_KEYS = new Set(
  TOOL_CATALOG.filter((tool) => tool.group === "tools" && tool.key !== "competitor_monitor").map((tool) => tool.key),
);

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/** Deterministic, low-cost intent/risk signals; this is guidance, not a model verdict. */
export function classifyReasoningIntent(goal: string): ReasoningContext {
  const text = String(goal || "").trim();
  const intents = INTENT_RULES.filter((rule) => matchesAny(text, rule.patterns)).map((rule) => rule.intent);
  const resolved = intents.length ? intents : ["general" as const];
  const highRisk = /\b(?:legal advice|lawsuit|medical diagnosis|treatment|security scan|penetration test|invest money|send email|publish|delete account|transfer funds)\b/i.test(text)
    || /استشارة قانونية|تشخيص طبي|علاج|فحص أمني|اختبار اختراق|استثمر|أرسل البريد|انشر|احذف الحساب|حوّل الأموال/i.test(text);
  const moderateRisk = resolved.some((intent) => ["brand_visibility", "research", "competitive_intelligence", "business_strategy", "social_analysis"].includes(intent));
  const externalActionRequested = /\b(?:publish|send|submit|delete|update|create account|post publicly|launch campaign)\b/i.test(text)
    || /انشر|أرسل|ارسِل|إرسال|احذف|حدّث|تحديث|أطلق الحملة|نشر علني/i.test(text);
  const evidenceRequired = resolved.some((intent) => ["research", "competitive_intelligence", "business_strategy", "brand_visibility", "social_analysis"].includes(intent))
    || highRisk;
  const signalText = text.toLowerCase();
  return {
    primaryIntent: resolved[0],
    intents: resolved,
    risk: highRisk ? "high" : moderateRisk ? "moderate" : "low",
    evidenceRequired,
    externalActionRequested,
    signals: [
      ...resolved.map((intent) => "intent:" + intent),
      ...(evidenceRequired ? ["evidence_required"] : []),
      ...(externalActionRequested ? ["external_action_review"] : []),
      ...(highRisk ? ["high_risk_review"] : []),
      ...(signalText.length < 12 ? ["short_or_underspecified_request"] : []),
    ],
  };
}

/** Validate the model-generated plan against the real, currently callable tool catalogue. */
export function validateReasoningPlan(
  rawSteps: ReasoningPlanStep[],
  intents: ReasoningIntent[],
  maxSteps: number,
): ReasoningPlanValidation {
  const steps: ReasoningPlanValidation["steps"] = [];
  const rejectedTools: string[] = [];
  const rejectedDependencies: string[] = [];
  const availablePriorTools = new Set<string>();

  for (const raw of rawSteps.slice(0, Math.max(0, maxSteps))) {
    const tool = typeof raw?.tool === "string" ? raw.tool.trim() : "";
    if (!TOOL_KEYS.has(tool as ToolKey)) {
      if (tool) rejectedTools.push(tool);
      continue;
    }
    const rawInput = raw.input && typeof raw.input === "object" && !Array.isArray(raw.input)
      ? raw.input as Record<string, unknown> : {};
    const dependencies = Array.isArray(raw.depends_on) ? raw.depends_on : [];
    const validDependencies: string[] = [];
    for (const dependency of dependencies) {
      if (typeof dependency === "string" && availablePriorTools.has(dependency)) {
        if (!validDependencies.includes(dependency)) validDependencies.push(dependency);
      } else if (typeof dependency === "string") {
        rejectedDependencies.push(dependency);
      }
    }
    steps.push({
      tool: tool as ToolKey,
      input: rawInput,
      ...(typeof raw.reason === "string" && raw.reason.trim() ? { reason: raw.reason.trim().slice(0, 500) } : {}),
      depends_on: validDependencies,
    });
    availablePriorTools.add(tool);
  }

  const present = new Set(steps.map((step) => step.tool));
  const coverageWarnings = intents
    .filter((intent) => intent !== "general")
    .filter((intent) => !(TOOL_COVERAGE[intent] || []).some((tool) => present.has(tool)))
    .map((intent) => "missing_tool_coverage:" + intent);

  return { steps, rejectedTools, rejectedDependencies, coverageWarnings };
}

export function buildReasoningGuidance(context: ReasoningContext): string {
  return [
    "Deterministic request signals (guidance only; do not invent facts):",
    "- Primary intent: " + context.primaryIntent,
    "- Detected intents: " + context.intents.join(", "),
    "- Risk: " + context.risk,
    "- Evidence required: " + (context.evidenceRequired ? "yes" : "no"),
    "- External action requested: " + (context.externalActionRequested ? "yes; keep existing approval gates" : "no"),
    "Plan only with available existing tools. Prefer the smallest sufficient plan. If required facts or inputs are absent, request clarification rather than fabricate them. Distinguish observations, assumptions, estimates and recommendations. Treat this classifier as a hint, not ground truth.",
  ].join("\n");
}
