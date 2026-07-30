// Part 8 — Laws of Cognitive Intelligence (Compliance Layer).
//
// EVOLUTION, NOT CREATION: the 30 laws are almost entirely *already implemented*
// across the existing Maaroof engines (envision, memory recall, expert council,
// trust, timing, quality score, capability OS, agent factory, execution modes,
// decision_log, consent + workspace scoping). This module does NOT re-implement
// any of them. It is a measurement + enforcement layer that reads the signals
// those engines already produce, scores compliance, injects the laws into the
// existing system prompt, and (optionally) blocks a final answer that breaks a
// hard law. Zero extra LLM requests — every check is local and heuristic.

export type LawSeverity = "hard" | "soft";

export type Law = {
  id: number;
  key: string;
  ar: string;
  en: string;
  /** Which existing engine/phase already enforces this law. */
  implementedBy: string;
  severity: LawSeverity;
  /** Whether the compliance layer can verify it automatically from run signals. */
  measurable: boolean;
};

export const LAWS: Law[] = [
  { id: 1, key: "identity_first", ar: "الهوية قبل كل شيء", en: "Identity first", implementedBy: "genome.server / workspaces", severity: "soft", measurable: true },
  { id: 2, key: "context_before_action", ar: "السياق قبل التنفيذ", en: "Context before action", implementedBy: "orchestrator: workspace profile + geo", severity: "soft", measurable: true },
  { id: 3, key: "future_before_plan", ar: "المستقبل قبل الخطة", en: "Future before plan", implementedBy: "orchestrator: envision phase", severity: "soft", measurable: true },
  { id: 4, key: "plan_before_execution", ar: "الخطة قبل التنفيذ", en: "Plan before execution", implementedBy: "orchestrator: plan phase", severity: "hard", measurable: true },
  { id: 5, key: "capability_before_tool", ar: "القدرة قبل الأداة", en: "Capability before tool", implementedBy: "capability.server (Capability OS)", severity: "soft", measurable: true },
  { id: 6, key: "agent_before_task", ar: "الوكيل قبل المهمة", en: "Agent before task", implementedBy: "agents.server (Agent Factory)", severity: "soft", measurable: true },
  { id: 7, key: "evidence_before_opinion", ar: "الدليل قبل الرأي", en: "Evidence before opinion", implementedBy: "trust engine + evidence graph", severity: "hard", measurable: true },
  { id: 8, key: "quality_before_speed", ar: "الجودة قبل السرعة", en: "Quality before speed", implementedBy: "Executive Quality Score", severity: "soft", measurable: true },
  { id: 9, key: "learning_before_repeating", ar: "التعلّم قبل التكرار", en: "Learning before repeating", implementedBy: "memory.remember + Learning DNA", severity: "soft", measurable: true },
  { id: 10, key: "fusion_before_creation", ar: "الدمج قبل الإنشاء", en: "Fusion before creation", implementedBy: "capability registry reuse", severity: "soft", measurable: false },
  { id: 11, key: "memory_before_search", ar: "الذاكرة قبل البحث", en: "Memory before search", implementedBy: "memory.recall before planning", severity: "hard", measurable: true },
  { id: 12, key: "council_before_decision", ar: "المجلس قبل القرار", en: "Council before decision", implementedBy: "Expert Council phase", severity: "soft", measurable: true },
  { id: 13, key: "trust_before_answer", ar: "الثقة قبل الإجابة", en: "Trust before answer", implementedBy: "trust engine + needs_human", severity: "hard", measurable: true },
  { id: 14, key: "cost_before_execution", ar: "التكلفة قبل التنفيذ", en: "Cost before execution", implementedBy: "timing.server + token ledger", severity: "soft", measurable: true },
  { id: 15, key: "value_before_tokens", ar: "قيمة المستخدم قبل توفير التوكن", en: "User value before token usage", implementedBy: "orchestrator: no truncation of value", severity: "soft", measurable: false },
  { id: 16, key: "privacy_before_learning", ar: "الخصوصية قبل التعلّم", en: "Privacy before learning", implementedBy: "profiles.cognitive_consent + memory scope", severity: "hard", measurable: true },
  { id: 17, key: "workspace_isolation", ar: "عزل مساحات العمل", en: "Workspace isolation", implementedBy: "memory workspace_id scoping + RLS", severity: "hard", measurable: true },
  { id: 18, key: "identity_preservation", ar: "حفظ الهوية", en: "Identity preservation", implementedBy: "genome protected keys + personality version", severity: "soft", measurable: true },
  { id: 19, key: "self_review", ar: "المراجعة الذاتية", en: "Self review", implementedBy: "reflection phase", severity: "soft", measurable: true },
  { id: 20, key: "continuous_evolution", ar: "التطور المستمر", en: "Continuous evolution", implementedBy: "personality evolution + platform DNA", severity: "soft", measurable: false },
  { id: 21, key: "human_authority", ar: "سلطة الإنسان", en: "Human authority", implementedBy: "needs_human + execution modes + approvals", severity: "hard", measurable: true },
  { id: 22, key: "explainability", ar: "قابلية الشرح", en: "Explainability", implementedBy: "decision_log + trust panel", severity: "hard", measurable: true },
  { id: 23, key: "auditability", ar: "قابلية التدقيق", en: "Auditability", implementedBy: "maaroof_messages + maaroof_runs", severity: "soft", measurable: true },
  { id: 24, key: "reversibility", ar: "قابلية التراجع", en: "Reversibility", implementedBy: "simulation/recommendation modes", severity: "soft", measurable: true },
  { id: 25, key: "executive_responsibility", ar: "المسؤولية التنفيذية", en: "Executive responsibility", implementedBy: "trust: risks + alternatives + outcome", severity: "soft", measurable: true },
  { id: 26, key: "no_hallucination", ar: "منع التلفيق", en: "No hallucination policy", implementedBy: "evidence gate on final answer", severity: "hard", measurable: true },
  { id: 27, key: "intelligence_over_automation", ar: "الذكاء قبل الأتمتة", en: "Intelligence over automation", implementedBy: "council + conflict engine", severity: "soft", measurable: false },
  { id: 28, key: "platform_first", ar: "المنصة أولاً", en: "Platform first", implementedBy: "kill switch + settings governance", severity: "soft", measurable: false },
  { id: 29, key: "executive_thinking", ar: "التفكير التنفيذي", en: "Executive thinking", implementedBy: "personality + executive prompt", severity: "soft", measurable: false },
  { id: 30, key: "future_leads_present", ar: "المستقبل يقود الحاضر", en: "The future leads the present", implementedBy: "envision backward chain (governing law)", severity: "hard", measurable: true },
];

export const LAWS_BY_ID: Record<number, Law> = Object.fromEntries(LAWS.map((l) => [l.id, l]));

export type LawSignals = {
  hasEnvision: boolean;
  planSteps: number;
  memoriesRecalled: number;
  councilOpinions: number;
  councilAvgConfidence: number | null;
  capabilityChoices: number;
  hasAgent: boolean;
  reflections: number;
  toolResults: Array<{ ok: boolean }>;
  trust: Record<string, any> | null;
  timingVerdict: string | null;
  qualityScore: Record<string, number> | null;
  decisionLogEntries: number;
  executionMode: string;
  workspaceId: string | null;
  memoryScoped: boolean;
  consent: string | null;
  totalUsd: number;
  hasWorkspaceContext: boolean;
  hasGenome: boolean;
  needsHuman: boolean;
  finalTextLength: number;
};

export type LawViolation = {
  id: number;
  key: string;
  ar: string;
  severity: LawSeverity;
  detail: string;
};

export type LawEvaluation = {
  score: number; // 0..100 over measurable laws
  verdict: "compliant" | "warning" | "violation";
  checked: number;
  satisfied: number[];
  violations: LawViolation[];
  at: string;
};

/** Local, zero-cost compliance evaluation over signals the run already produced. */
export function evaluateLaws(s: LawSignals, opts?: { minTrust?: number }): LawEvaluation {
  const minTrust = opts?.minTrust ?? 55;
  const violations: LawViolation[] = [];
  const satisfied: number[] = [];
  const hasEvidence = s.memoriesRecalled > 0 || s.toolResults.some((r) => r.ok) || !!s.trust?.evidence?.length;

  const check = (id: number, ok: boolean, detail: string) => {
    const law = LAWS_BY_ID[id];
    if (!law?.measurable) return;
    if (ok) satisfied.push(id);
    else violations.push({ id, key: law.key, ar: law.ar, severity: law.severity, detail });
  };

  check(1, s.hasGenome || !s.workspaceId, "لا توجد هوية محفوظة للمساحة (الجينوم غير مقروء).");
  check(2, s.hasWorkspaceContext || !s.workspaceId, "لم يُحمَّل سياق مساحة العمل قبل التنفيذ.");
  check(3, s.hasEnvision, "لم تُشتق رؤية مستقبلية قبل الخطة.");
  check(4, s.planSteps > 0 || s.executionMode !== "execution", "تم التنفيذ بلا خطة صريحة.");
  check(5, s.capabilityChoices > 0 || s.planSteps === 0, "لم تُستخدم طبقة القدرات لاختيار التنفيذ.");
  check(6, s.hasAgent, "لم يُخصَّص وكيل تنفيذي لهذه المهمة.");
  check(7, hasEvidence, "لا توجد أدلة تسند الرأي المقدَّم.");
  check(8, !s.qualityScore || Object.values(s.qualityScore).every((v) => v >= 0.4), "أحد أبعاد الجودة تحت الحد المقبول.");
  check(9, s.memoriesRecalled > 0 || s.reflections > 0, "لم تُستثمر الذاكرة ولا المراجعة لتفادي تكرار الأخطاء.");
  check(11, s.memoriesRecalled > 0, "لم تُراجَع الذاكرة الحية قبل البحث/التنفيذ.");
  check(12, s.councilOpinions > 0 || s.planSteps <= 1, "قرار متعدد الخطوات دون مداولة مجلس الخبراء.");
  check(
    13,
    s.councilAvgConfidence == null || s.councilAvgConfidence >= minTrust || s.needsHuman,
    `الثقة (${s.councilAvgConfidence}%) دون العتبة (${minTrust}%) ولم يُطلب تدخل بشري.`,
  );
  check(14, s.timingVerdict != null || s.totalUsd < 0.5, "لم تُقيَّم التكلفة/التوقيت قبل تنفيذ مكلف.");
  check(16, s.consent !== "none" || !s.memoryScoped, "حُفظت بيانات رغم رفض المستخدم للتعلّم.");
  check(17, !s.workspaceId || s.memoryScoped, "استرجاع الذاكرة لم يُقيَّد بمساحة العمل.");
  check(18, s.hasGenome || !s.workspaceId, "الهوية الدائمة غير مُحمَّلة — خطر انحراف الهوية.");
  check(19, s.reflections > 0 || s.planSteps < 3, "تنفيذ طويل دون مراجعة ذاتية.");
  check(21, s.executionMode !== "execution" || !s.needsHuman || s.planSteps === 0, "تنفيذ تلقائي رغم الحاجة لقرار بشري.");
  check(22, s.decisionLogEntries > 0, "لا يوجد سجل قرارات قابل للشرح.");
  check(23, s.decisionLogEntries > 0 || s.toolResults.length > 0, "لا توجد آثار قابلة للتدقيق.");
  check(24, s.executionMode !== "execution" || s.planSteps <= 6, "تنفيذ واسع دون مسار تراجع أو محاكاة مسبقة.");
  check(25, !s.trust || Array.isArray(s.trust.risks) || Array.isArray(s.trust.alternatives), "لم تُوضَّح المخاطر ولا البدائل.");
  check(26, hasEvidence || s.finalTextLength === 0, "إجابة نهائية بلا أي مصدر أو نتيجة أداة.");
  check(30, s.hasEnvision || s.planSteps === 0, "الحاضر قاد الخطة بدل المستقبل.");

  const checked = satisfied.length + violations.length;
  const score = checked ? Math.round((satisfied.length / checked) * 100) : 100;
  const hardBroken = violations.some((v) => v.severity === "hard");
  return {
    score,
    verdict: hardBroken ? "violation" : violations.length ? "warning" : "compliant",
    checked,
    satisfied,
    violations,
    at: new Date().toISOString(),
  };
}

/** Compact laws block appended to the existing system prompt (flag-gated). */
export function lawsPromptBlock(language: string = "ar"): string {
  const ar = language === "ar";
  const lines = LAWS.map((l) => `${l.id}. ${ar ? l.ar : l.en}`).join(" | ");
  return ar
    ? `\n\n[دستور الذكاء الإدراكي — 30 قانوناً مُلزِمة]\n${lines}\nالتزم بها في كل خطوة: لا رأي بلا دليل، لا إجابة نهائية بثقة منخفضة، لا اختلاق معلومة، والقرار النهائي للمستخدم.`
    : `\n\n[Cognitive Intelligence Constitution — 30 binding laws]\n${lines}\nHonour them at every step: no opinion without evidence, no final answer at low trust, no fabrication, and the human holds final authority.`;
}

/** Human-readable notice prepended to the answer when hard laws are broken. */
export function hardLawNotice(ev: LawEvaluation, language: string = "ar"): string {
  const hard = ev.violations.filter((v) => v.severity === "hard");
  if (!hard.length) return "";
  if (language === "ar") {
    return [
      "> ⚠️ **تنبيه دستوري — هذه ليست توصية نهائية.**",
      "> تم رصد خرق لقوانين إلزامية قبل تقديم الإجابة:",
      ...hard.map((v) => `> - ${v.ar}: ${v.detail}`),
      "> يُرجى تزويدي بمعطيات إضافية أو اعتماد القرار يدوياً.",
      "",
    ].join("\n");
  }
  return [
    "> ⚠️ **Constitutional notice — this is not a final recommendation.**",
    ...hard.map((v) => `> - ${v.key}: ${v.detail}`),
    "",
  ].join("\n");
}
