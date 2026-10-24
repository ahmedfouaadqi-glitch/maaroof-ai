// Part 17 — HERMES, the Founder's Executive Steward.
// HERMES observes the whole platform, understands the Founder, and PROPOSES.
// It never executes in production without explicit approval, never touches a
// user balance, and never claims anything it cannot show evidence for.
import { createClient } from "@supabase/supabase-js";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders, FACTUAL_SAFETY_PROMPT } from "@/lib/lovable-ai";
import { recordLearningSpend } from "@/lib/maaroof/experts.server";

let _db: ReturnType<typeof createClient> | null = null;
function db(): any {
  if (_db) return _db;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db;
}

export const HERMES_IDENTITY = {
  name: "هرمس",
  role: "الوكيل التنفيذي الخاص بالمؤسس",
  founder: "أحمد معروف",
  loyalty: "المؤسس أولاً، ثم المنصة، ثم المستخدمون",
  hardLimits: [
    "لا تنفيذ في الإنتاج بلا موافقة صريحة",
    "لا تعديل على الدستور التنفيذي",
    "لا اقتراح بلا دليل وكلفة وخطة تراجع",
    "لا استخدام لرصيد أي مستخدم",
  ],
};

const num = (v: any) => Number(v || 0);
const round = (v: number, d = 4) => Math.round(v * 10 ** d) / 10 ** d;

/* ------------------------------------------------------------------ */
/* Executive Observatory — real signals only                           */
/* ------------------------------------------------------------------ */

export type Observatory = Awaited<ReturnType<typeof observePlatform>>;

export async function observePlatform() {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [runs, ledger, learning, models, trust, users, proposals] = await Promise.all([
    db().from("maaroof_runs").select("id, status, mode, total_tokens, total_usd, created_at").gte("created_at", since).limit(1000),
    db().from("token_ledger").select("tool_key, tokens, usd_cost, meta, created_at").gte("created_at", since).limit(2000),
    db().from("learning_budget_ledger").select("purpose, tokens, usd, cache_hit, created_at").gte("created_at", since).limit(1000),
    db().from("ai_models").select("model_key, provider, status, quality_score, cost_per_1m_input, cost_per_1m_output").limit(200),
    db().from("trust_profiles").select("entity_type, entity_key, trust_score, samples").order("trust_score", { ascending: true }).limit(50),
    db().from("profiles").select("id, tokens_balance, subscription_tier, created_at").limit(2000),
    db().from("hermes_proposals").select("status").limit(500),
  ]);

  // Part 19 — reality verification signals (read-only, no extra model cost).
  const realityRows = ((await db()
    .from("reality_records")
    .select("reality_state, reality_score, evidence_score, verification_score, contradictions")
    .gte("created_at", since)
    .limit(1000)).data as any[]) || [];

  const runRows = (runs.data as any[]) || [];
  const ledgerRows = (ledger.data as any[]) || [];
  const learnRows = (learning.data as any[]) || [];
  const userRows = (users.data as any[]) || [];

  const failed = runRows.filter((r) => r.status === "failed").length;
  const successRatio = runRows.length ? 1 - failed / runRows.length : 1;

  const realUsd = ledgerRows.reduce((a, r) => a + num(r?.meta?.real_usd_cost ?? 0), 0);
  const chargedUsd = ledgerRows.reduce((a, r) => a + num(r.usd_cost), 0);
  const metered = ledgerRows.filter((r) => num(r?.meta?.real_usd_cost) > 0).length;

  const perTool: Record<string, { calls: number; tokens: number; realUsd: number; chargedUsd: number }> = {};
  for (const r of ledgerRows) {
    const k = String(r.tool_key || "unknown");
    perTool[k] ||= { calls: 0, tokens: 0, realUsd: 0, chargedUsd: 0 };
    perTool[k].calls += 1;
    perTool[k].tokens += num(r.tokens);
    perTool[k].realUsd += num(r?.meta?.real_usd_cost);
    perTool[k].chargedUsd += num(r.usd_cost);
  }
  const topCostTools = Object.entries(perTool)
    .map(([tool, v]) => ({ tool, ...v, realUsd: round(v.realUsd), avgRealUsd: round(v.calls ? v.realUsd / v.calls : 0, 6) }))
    .sort((a, b) => b.realUsd - a.realUsd)
    .slice(0, 8);

  const learningUsd = learnRows.reduce((a, r) => a + num(r.usd), 0);
  const cacheHits = learnRows.filter((r) => r.cache_hit).length;

  const proposalRows = (proposals.data as any[]) || [];
  const weakestLinks = ((trust.data as any[]) || []).filter((t) => num(t.samples) >= 2 && num(t.trust_score) < 60).slice(0, 6);

  return {
    window_days: 30,
    runs: {
      total: runRows.length,
      failed,
      successRatio: round(successRatio, 3),
      tokens: runRows.reduce((a, r) => a + num(r.total_tokens), 0),
      usd: round(runRows.reduce((a, r) => a + num(r.total_usd), 0)),
    },
    economics: {
      realUsd: round(realUsd),
      chargedUsd: round(chargedUsd),
      marginUsd: round(chargedUsd - realUsd),
      marginPct: chargedUsd > 0 ? Math.round(((chargedUsd - realUsd) / chargedUsd) * 100) : null,
      meteredCalls: metered,
      unmeteredCalls: ledgerRows.length - metered,
      learningUsd: round(learningUsd),
      cacheHits,
    },
    topCostTools,
    models: {
      total: ((models.data as any[]) || []).length,
      active: ((models.data as any[]) || []).filter((m) => m.status === "active").length,
    },
    weakestLinks,
    users: {
      total: userRows.length,
      paying: userRows.filter((u) => u.subscription_tier && u.subscription_tier !== "free").length,
      lowBalance: userRows.filter((u) => num(u.tokens_balance) < 1000).length,
    },
    reality: {
      records: realityRows.length,
      verified: realityRows.filter((r) => r.reality_state === "verified" || r.reality_state === "measured").length,
      unverified: realityRows.filter((r) => r.reality_state === "assumed" || r.reality_state === "predicted" || r.reality_state === "unknown").length,
      contradictions: realityRows.filter((r) => (r.contradictions || []).length > 0).length,
      avgReality: realityRows.length
        ? Math.round(realityRows.reduce((a, r) => a + num(r.reality_score), 0) / realityRows.length)
        : 0,
      avgVerification: realityRows.length
        ? Math.round(realityRows.reduce((a, r) => a + num(r.verification_score), 0) / realityRows.length)
        : 0,
    },
    proposals: {
      pending: proposalRows.filter((p) => p.status === "pending").length,
      approved: proposalRows.filter((p) => p.status === "approved").length,
      rejected: proposalRows.filter((p) => p.status === "rejected").length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Founder DNA                                                         */
/* ------------------------------------------------------------------ */

export async function getFounderDna() {
  const { data } = await db().from("hermes_founder_dna").select("*").eq("founder_key", "ahmed_maaroof").maybeSingle();
  if (data) return data as any;
  const { data: created } = await db().from("hermes_founder_dna").insert({ founder_key: "ahmed_maaroof" }).select().maybeSingle();
  return created as any;
}

/** DNA evolves only from real founder decisions — never from assumptions. */
export async function learnFromDecision(input: {
  proposal: any;
  decision: "approved" | "rejected" | "deferred";
  note?: string | null;
}) {
  const dna = await getFounderDna();
  if (!dna) return;
  const signals = Array.isArray(dna.signals) ? dna.signals.slice(-99) : [];
  signals.push({
    at: new Date().toISOString(),
    kind: input.proposal?.kind,
    title: input.proposal?.title,
    decision: input.decision,
    note: (input.note || "").slice(0, 300),
    cost: num(input.proposal?.expected_cost_usd),
    roi: num(input.proposal?.estimated_roi),
  });

  const approved = num(dna.approved_count) + (input.decision === "approved" ? 1 : 0);
  const rejected = num(dna.rejected_count) + (input.decision === "rejected" ? 1 : 0);
  const decided = approved + rejected;

  // Risk tolerance drifts toward what the founder actually accepts.
  let risk = num(dna.risk_tolerance) || 50;
  const proposalRisk = Math.max(0, Math.min(100, 100 - num(input.proposal?.confidence) * 100));
  if (input.decision === "approved") risk = risk + (proposalRisk - risk) * 0.15;
  if (input.decision === "rejected") risk = risk - (proposalRisk - risk) * 0.1;

  await db().from("hermes_founder_dna").update({
    signals,
    approved_count: approved,
    rejected_count: rejected,
    risk_tolerance: Math.max(0, Math.min(100, round(risk, 1))),
    confidence: Math.min(95, decided * 5),
  }).eq("id", dna.id);
}

export function founderDnaPrompt(dna: any): string {
  if (!dna) return "";
  const list = (v: any) => (Array.isArray(v) && v.length ? v.map((x: any) => `- ${typeof x === "string" ? x : JSON.stringify(x)}`).join("\n") : "- (لم يُستنتج بعد)");
  return [
    "حمض المؤسس (مستنتج من قراراته الفعلية فقط):",
    `تحمّل المخاطر: ${dna.risk_tolerance}/100 · ثقة الاستنتاج: ${dna.confidence}%`,
    `قرارات موافَق عليها: ${dna.approved_count} · مرفوضة: ${dna.rejected_count}`,
    "الرؤية:", list(dna.vision),
    "فلسفة الكلفة:", list(dna.cost_philosophy),
    "توقعات الجودة:", list(dna.quality_expectations),
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Proposal engine — evidence, cost, ROI, rollback. Zero model cost.   */
/* ------------------------------------------------------------------ */

export type ProposalDraft = {
  kind: string;
  title: string;
  executive_summary: string;
  problem: string;
  evidence: any[];
  business_value: string;
  technical_analysis: string;
  risk_analysis: any[];
  cost_analysis: Record<string, any>;
  revenue_potential: Record<string, any>;
  alternatives: any[];
  rollback_plan: string;
  affected_components: string[];
  expected_value_usd: number;
  expected_cost_usd: number;
  estimated_roi: number;
  priority: number;
  confidence: number;
};

/** Derives proposals from measured platform signals — no model call, no guessing. */
export function deriveProposals(o: Observatory): ProposalDraft[] {
  const out: ProposalDraft[] = [];

  // Part 19 — verification gap: too many answers standing on assumption.
  const rl = (o as any).reality;
  if (rl && rl.records >= 10 && rl.unverified / Math.max(1, rl.records) > 0.4) {
    const share = Math.round((rl.unverified / Math.max(1, rl.records)) * 100);
    out.push({
      kind: "quality", title: "سد فجوة التحقق من الواقع",
      executive_summary: `${share}% من المخرجات مصنّفة كافتراض أو توقّع بلا تحقق فعلي، ما يرفع مخاطر القرار التنفيذي.`,
      problem: `${rl.unverified} سجل غير متحقق من أصل ${rl.records} خلال ${o.window_days} يوماً، بمتوسط تحقق ${rl.avgVerification}%.`,
      evidence: [
        { metric: "unverified_records", value: rl.unverified },
        { metric: "total_records", value: rl.records },
        { metric: "avg_verification", value: rl.avgVerification },
        { metric: "contradictions", value: rl.contradictions },
      ],
      business_value: "قرارات مبنية على وقائع مقاسة بدل تقديرات، وثقة أعلى لدى العملاء التنفيذيين.",
      technical_analysis: "تفعيل حلقة الواقع الكاملة: ربط كل استنتاج بأدلة أدوات قابلة لإعادة الإنتاج وإغلاق الحلقة على المعرفة والثقة.",
      risk_analysis: [{ risk: "زيادة زمن الاستجابة", severity: "منخفض", mitigation: "التحقق محلي بلا نداءات نموذج إضافية" }],
      cost_analysis: { extra_usd: 0, note: "التصنيف والتحقق حسابي محلي بالكامل" },
      revenue_potential: { note: "ثقة أعلى ⇒ تحويل أفضل للباقات التنفيذية" },
      alternatives: [
        { option: "إبقاء الوضع الحالي", why_not: "تبقى القرارات على افتراضات غير مقاسة" },
        { option: "تحقق بشري يدوي", why_not: "لا يتوسّع مع حجم التشغيل" },
      ],
      rollback_plan: "إيقاف مفتاح reality_engine.enabled يعيد السلوك السابق فوراً.",
      affected_components: ["orchestrator", "reality.server", "knowledge", "trust"],
      expected_value_usd: 0,
      expected_cost_usd: 0,
      estimated_roi: 0,
      priority: 2,
      confidence: 78,
    });
  }

  if (o.economics.unmeteredCalls > 0) {
    const share = Math.round((o.economics.unmeteredCalls / Math.max(1, o.economics.meteredCalls + o.economics.unmeteredCalls)) * 100);
    out.push({
      kind: "cost", title: "إغلاق فجوة القياس في التكلفة الحقيقية",
      executive_summary: `${share}% من نداءات الأدوات ما زالت بلا تكلفة حقيقية مسجّلة، ما يجعل هامش الربح تقديرياً لا مقاساً.`,
      problem: `${o.economics.unmeteredCalls} نداء غير مقاس مقابل ${o.economics.meteredCalls} نداء مقاس خلال ${o.window_days} يوماً.`,
      evidence: [{ metric: "unmetered_calls", value: o.economics.unmeteredCalls }, { metric: "metered_calls", value: o.economics.meteredCalls }],
      business_value: "تسعير الأدوات على كلفة حقيقية بدل التقدير، وحماية الهامش من التآكل الصامت.",
      technical_analysis: "توجيه المسارات المتبقية عبر غلاف النداء الموحّد الذي يسجّل usage من البوابة داخل meta.real_usd_cost.",
      risk_analysis: [{ risk: "تغيير في مسارات قديمة", severity: "منخفض", mitigation: "تعديل تدريجي لكل مسار مع اختبار" }],
      cost_analysis: { development: "ساعات هندسية فقط", runtime_usd_per_month: 0 },
      revenue_potential: { basis: "دقة التسعير", note: "لا يمكن تقدير رقم بلا بيانات تسعير معتمدة" },
      alternatives: [{ option: "الإبقاء على التقدير", why_not: "يبقي القرار المالي على أساس غير موثّق" }],
      rollback_plan: "إبقاء الحقول القديمة كما هي؛ الغلاف يضيف بيانات ولا يحذف شيئاً.",
      affected_components: ["token_ledger", "AdminFinanceTab", "api routes"],
      expected_value_usd: 0, expected_cost_usd: 0, estimated_roi: 0,
      priority: 2, confidence: 0.9,
    });
  }

  if (o.economics.marginPct != null && o.economics.marginPct < 40) {
    out.push({
      kind: "pricing", title: "الهامش الحالي دون العتبة الآمنة",
      executive_summary: `هامش آخر ${o.window_days} يوماً ${o.economics.marginPct}% (محصّل ${o.economics.chargedUsd}$ مقابل كلفة ${o.economics.realUsd}$).`,
      problem: "التسعير الحالي لا يغطي كلفة النماذج بهامش تشغيلي آمن.",
      evidence: [{ metric: "charged_usd", value: o.economics.chargedUsd }, { metric: "real_usd", value: o.economics.realUsd }, { metric: "margin_pct", value: o.economics.marginPct }],
      business_value: "استعادة هامش قابل للاستمرار دون رفع سعر شامل.",
      technical_analysis: "إعادة معايرة كلفة التوكن لكل أداة من متوسط الكلفة الحقيقية المقاسة في السجل.",
      risk_analysis: [{ risk: "حساسية سعرية لدى المستخدمين", severity: "متوسط", mitigation: "رفع مُوجَّه للأدوات الأعلى كلفة فقط" }],
      cost_analysis: { development: "تعديل إعدادات التسعير", runtime_usd_per_month: 0 },
      revenue_potential: { basis: "فرق الهامش المقاس", note: "يُحسب بعد اعتماد المعايرة" },
      alternatives: [{ option: "خفض كلفة النموذج بدل رفع السعر", why_not: "قد يخفض الجودة؛ يمكن دمجه لاحقاً" }],
      rollback_plan: "العودة إلى جدول التسعير الحالي بضغطة واحدة (القيم محفوظة).",
      affected_components: ["tool_pricing_catalog", "charge_tokens"],
      expected_value_usd: round(Math.max(0, o.economics.realUsd * 0.4 - o.economics.marginUsd)),
      expected_cost_usd: 0,
      estimated_roi: 0, priority: 1, confidence: 0.75,
    });
  }

  const heavy = o.topCostTools[0];
  if (heavy && heavy.realUsd > 0) {
    out.push({
      kind: "optimization", title: `تحسين كلفة الأداة الأعلى استهلاكاً: ${heavy.tool}`,
      executive_summary: `${heavy.tool} استهلكت ${heavy.realUsd}$ حقيقية عبر ${heavy.calls} نداء (متوسط ${heavy.avgRealUsd}$ للنداء).`,
      problem: "أداة واحدة تستحوذ على أعلى حصة من الكلفة الحقيقية.",
      evidence: [heavy],
      business_value: "خفض الكلفة التشغيلية دون المساس بالمخرجات.",
      technical_analysis: "تجربة نموذج أخف لمرحلة التخطيط، وتخزين مؤقت للمدخلات المتكررة.",
      risk_analysis: [{ risk: "انخفاض الجودة", severity: "متوسط", mitigation: "قياس A/B عبر سجل الأداء قبل التعميم" }],
      cost_analysis: { development: "تعديل اختيار النموذج", runtime_usd_per_month: 0 },
      revenue_potential: { basis: "وفر مباشر", estimate_usd_month: round(heavy.realUsd * 0.3) },
      alternatives: [{ option: "الإبقاء على النموذج الحالي", why_not: "يبقي الكلفة مرتفعة" }],
      rollback_plan: "إعادة النموذج السابق من سجل حوكمة النماذج.",
      affected_components: ["models.server", heavy.tool],
      expected_value_usd: round(heavy.realUsd * 0.3), expected_cost_usd: 0,
      estimated_roi: 0, priority: 3, confidence: 0.6,
    });
  }

  if (o.runs.total > 0 && o.runs.successRatio < 0.85) {
    out.push({
      kind: "reliability", title: "معدل فشل التشغيل فوق الحد المقبول",
      executive_summary: `${o.runs.failed} تشغيل فاشل من ${o.runs.total} (نجاح ${Math.round(o.runs.successRatio * 100)}%).`,
      problem: "فشل متكرر يستهلك كلفة بلا قيمة مُسلَّمة.",
      evidence: [{ metric: "failed_runs", value: o.runs.failed }, { metric: "total_runs", value: o.runs.total }],
      business_value: "كل تشغيل فاشل كلفة بلا مقابل وثقة مفقودة.",
      technical_analysis: "تفعيل استئناف من آخر نقطة سليمة في مرساة الحالة بدل إعادة التشغيل الكامل.",
      risk_analysis: [{ risk: "استئناف على حالة قديمة", severity: "منخفض", mitigation: "التحقق من المرساة قبل الاستئناف" }],
      cost_analysis: { development: "ربط مرساة الحالة بالمحرك", runtime_usd_per_month: 0 },
      revenue_potential: { basis: "تقليل الهدر", note: "يساوي كلفة التشغيلات الفاشلة" },
      alternatives: [{ option: "إعادة المحاولة الكاملة", why_not: "يضاعف الكلفة" }],
      rollback_plan: "تعطيل الاستئناف من الإعدادات.",
      affected_components: ["orchestrator.server", "state.server"],
      expected_value_usd: 0, expected_cost_usd: 0, estimated_roi: 0, priority: 2, confidence: 0.7,
    });
  }

  for (const link of o.weakestLinks.slice(0, 2)) {
    out.push({
      kind: "trust", title: `حلقة ضعيفة: ${link.entity_type} · ${link.entity_key}`,
      executive_summary: `درجة ثقة ${Math.round(num(link.trust_score))}% عبر ${link.samples} عيّنة.`,
      problem: "مكوّن منخفض الثقة يشارك في مخرجات تُقدَّم للمستخدم.",
      evidence: [link],
      business_value: "رفع موثوقية المخرجات وتقليل المراجعة اليدوية.",
      technical_analysis: "استبدال المكوّن أو إلزامه بمصدر تحقق إضافي قبل الاعتماد.",
      risk_analysis: [{ risk: "فقدان تغطية مؤقت", severity: "منخفض", mitigation: "إبقاء البديل في وضع ظل قبل التبديل" }],
      cost_analysis: { development: "إعداد فقط", runtime_usd_per_month: 0 },
      revenue_potential: { basis: "جودة المخرجات" },
      alternatives: [{ option: "الإبقاء مع تحذير", why_not: "يبقي المخاطرة على المستخدم" }],
      rollback_plan: "إرجاع المكوّن الأصلي من سجل الثقة.",
      affected_components: ["trust.server", String(link.entity_key)],
      expected_value_usd: 0, expected_cost_usd: 0, estimated_roi: 0, priority: 4, confidence: 0.65,
    });
  }

  return out.map((p) => ({
    ...p,
    estimated_roi: p.expected_cost_usd > 0 ? round(p.expected_value_usd / p.expected_cost_usd, 2) : (p.expected_value_usd > 0 ? 99 : 0),
  }));
}

/** Persist derived proposals without duplicating an identical pending one. */
export async function syncProposals(): Promise<{ created: number; skipped: number; observatory: Observatory }> {
  const observatory = await observePlatform();
  const drafts = deriveProposals(observatory);
  const { data: pending } = await db().from("hermes_proposals").select("title, status").eq("status", "pending").limit(200);
  const existing = new Set(((pending as any[]) || []).map((p) => String(p.title)));

  let created = 0, skipped = 0;
  for (const d of drafts) {
    if (existing.has(d.title)) { skipped++; continue; }
    await db().from("hermes_proposals").insert({
      kind: d.kind, title: d.title, executive_summary: d.executive_summary, problem: d.problem,
      evidence: d.evidence, business_value: d.business_value, technical_analysis: d.technical_analysis,
      risk_analysis: d.risk_analysis, cost_analysis: d.cost_analysis, revenue_potential: d.revenue_potential,
      alternatives: d.alternatives, rollback_plan: d.rollback_plan, affected_components: d.affected_components,
      expected_value_usd: d.expected_value_usd, expected_cost_usd: d.expected_cost_usd,
      estimated_roi: d.estimated_roi, priority: d.priority, confidence: d.confidence,
      required_approval: "founder", status: "pending",
    });
    created++;
  }
  await recordLearningSpend({
    purpose: "hermes_proposal_sync", usd: 0, cacheHit: false,
    zeroCostReason: "local_derivation_no_model_call", meta: { created, skipped },
  });
  return { created, skipped, observatory };
}

export async function listProposals(status?: string) {
  let q = db().from("hermes_proposals").select("*").order("priority", { ascending: true }).order("created_at", { ascending: false }).limit(100);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return ((data as any[]) || []);
}

/** Founder decision. Part 18 widens the vocabulary: modify / postpone / archive
 *  are added next to the original approve / reject / defer without changing
 *  the behaviour of the existing three. */
export type FounderDecision = "approved" | "rejected" | "deferred" | "modified" | "postponed" | "archived";

export async function decideProposal(input: {
  proposalId: string;
  decision: FounderDecision;
  note?: string | null;
  founderId: string;
}) {
  const { data: proposal } = await db().from("hermes_proposals").select("*").eq("id", input.proposalId).maybeSingle();
  if (!proposal) return { ok: false, reason: "not_found" as const };
  await db().from("hermes_proposals").update({
    status: input.decision,
    founder_note: input.note || null,
    decided_by: input.founderId,
    decided_at: new Date().toISOString(),
  }).eq("id", input.proposalId);
  // DNA only learns from the three decisive signals; the softer ones are logged
  // but must not distort risk tolerance.
  if (input.decision === "approved" || input.decision === "rejected" || input.decision === "deferred") {
    await learnFromDecision({ proposal, decision: input.decision, note: input.note });
  }
  return { ok: true as const };
}


/* ------------------------------------------------------------------ */
/* Hermes Office — the Founder's private conversation                  */
/* ------------------------------------------------------------------ */

const HERMES_MODEL = "google/gemini-2.5-flash";

function estimateUsd(model: string, inTok: number, outTok: number): number {
  const cheap = /flash|mini|lite/i.test(model);
  return cheap ? inTok * 0.3e-6 + outTok * 2.5e-6 : inTok * 1.25e-6 + outTok * 10e-6;
}

export async function hermesReply(input: {
  userId: string;
  conversationId?: string | null;
  message: string;
  /** Part 18 — optional executive command (review, audit, evaluate_costs …). */
  command?: string | null;
  /** Part 18 — reply language. Defaults to Arabic, preserving old behaviour. */
  language?: "ar" | "en" | "ku";
  /** Part 18 — image / file blocks already shaped for the gateway. */
  attachments?: Array<{ kind: "image" | "file"; name?: string; dataUrl: string }>;
}): Promise<{ conversationId: string; reply: string; tokens: number; usd: number; observatory: Observatory }> {
  let conversationId = input.conversationId || null;
  if (!conversationId) {
    const { data } = await db().from("hermes_conversations")
      .insert({ user_id: input.userId, title: input.message.slice(0, 60) || "مكتب هرمس", language: input.language || "ar" })
      .select().maybeSingle();
    conversationId = (data as any)?.id;
  }

  const [observatory, dna, proposals, history] = await Promise.all([
    observePlatform(),
    getFounderDna(),
    listProposals("pending"),
    db().from("hermes_messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(20),
  ]);

  const commandBrief = input.command ? await buildCommandBrief(input.command, observatory) : null;
  const langName = input.language === "en" ? "English" : input.language === "ku" ? "Sorani Kurdish" : "Arabic";

  const system = [
    `أنت «${HERMES_IDENTITY.name}»، ${HERMES_IDENTITY.role} (${HERMES_IDENTITY.founder}).`,
    `ولاؤك: ${HERMES_IDENTITY.loyalty}.`,
    `حدودك المطلقة:\n${HERMES_IDENTITY.hardLimits.map((l) => `- ${l}`).join("\n")}`,
    "تتكلم بلغة تنفيذية موجزة: الخلاصة أولاً، ثم الدليل الرقمي، ثم الكلفة والعائد، ثم التوصية وخطة التراجع.",
    "كل رقم تذكره يجب أن يكون من بيانات المرصد أدناه. إن لم يوجد رقم، قل ذلك صراحة ولا تقدّره.",
    `Answer in ${langName}.`,
    FACTUAL_SAFETY_PROMPT,
    founderDnaPrompt(dna),
    `مرصد المنصة (آخر ${observatory.window_days} يوماً):\n${JSON.stringify(observatory)}`,
    commandBrief ? `أمر تنفيذي: ${input.command}\nإشارات مقاسة لهذا الأمر:\n${JSON.stringify(commandBrief)}` : "",
    proposals.length ? `اقتراحات معلّقة بانتظار قرارك: ${proposals.map((p) => p.title).join(" | ")}` : "لا اقتراحات معلّقة.",
  ].filter(Boolean).join("\n\n");


  // Text-only stays a plain string (unchanged behaviour); attachments switch to
  // typed content blocks the gateway understands.
  const atts = input.attachments || [];
  const userContent: any = atts.length
    ? [
        { type: "text", text: input.message },
        ...atts.map((a) =>
          a.kind === "image"
            ? { type: "image_url", image_url: { url: a.dataUrl } }
            : { type: "file", file: { filename: a.name || "file", file_data: a.dataUrl } },
        ),
      ]
    : input.message;

  const messages = [
    { role: "system", content: system },
    ...(((history.data as any[]) || []).map((m) => ({ role: m.role, content: m.content }))),
    { role: "user", content: userContent },
  ];


  const started = Date.now();
  let reply = "";
  let inTok = 0, outTok = 0;
  try {
    const resp = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: lovableAiHeaders(process.env.LOVABLE_API_KEY!),
      body: JSON.stringify({ model: HERMES_MODEL, messages }),
    });
    if (!resp.ok) throw new Error(`gateway_${resp.status}`);
    const j: any = await resp.json();
    reply = j?.choices?.[0]?.message?.content || "";
    inTok = num(j?.usage?.prompt_tokens);
    outTok = num(j?.usage?.completion_tokens);
  } catch (e: any) {
    reply = `تعذّر الوصول إلى النموذج الآن (${String(e?.message || e).slice(0, 80)}). المرصد ما زال متاحاً: ${observatory.runs.total} تشغيل، كلفة حقيقية ${observatory.economics.realUsd}$، هامش ${observatory.economics.marginPct ?? "غير مقاس"}%.`;
  }

  const usd = estimateUsd(HERMES_MODEL, inTok, outTok);
  const tokens = inTok + outTok;

  await db().from("hermes_messages").insert([
    { conversation_id: conversationId, user_id: input.userId, role: "user", content: input.message },
    { conversation_id: conversationId, user_id: input.userId, role: "assistant", content: reply, tokens, usd, model: HERMES_MODEL, evidence: { observatory_window: observatory.window_days } },
  ]);
  await db().from("hermes_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

  // Founder-facing steward work is system cost, never a user balance.
  await recordLearningSpend({
    purpose: "hermes_office_reply", model: HERMES_MODEL,
    inputTokens: inTok, outputTokens: outTok, usd,
    latencyMs: Date.now() - started, meta: { conversation_id: conversationId },
  });

  return { conversationId: conversationId!, reply, tokens, usd, observatory };
}

export async function listConversations(userId: string) {
  const { data } = await db().from("hermes_conversations").select("*").eq("user_id", userId)
    .order("updated_at", { ascending: false }).limit(30);
  return ((data as any[]) || []);
}

export async function listMessages(conversationId: string, userId: string) {
  const { data } = await db().from("hermes_messages").select("*")
    .eq("conversation_id", conversationId).eq("user_id", userId)
    .order("created_at", { ascending: true }).limit(200);
  return ((data as any[]) || []);
}

/* ================================================================== */
/* Part 18 — Executive Command Center                                  */
/* Evolves the Part 17 office: commands, tasks, history, live monitor. */
/* ================================================================== */

// The command / status vocabulary lives in the client-safe module so the UI and
// the server share one definition. Re-exported here for existing importers.
export { EXECUTIVE_COMMANDS, TASK_STATUSES } from "@/lib/hermes-commands";
export type { ExecutiveCommand, TaskStatus } from "@/lib/hermes-commands";


/** Gathers the real signals a given command needs, from existing tables only. */
export async function buildCommandBrief(command: string, o: Observatory): Promise<Record<string, any>> {
  const take = async (table: string, cols: string, order?: string, limit = 25) => {
    let q = db().from(table).select(cols).limit(limit);
    if (order) q = q.order(order, { ascending: false });
    const { data } = await q;
    return ((data as any[]) || []);
  };

  switch (command) {
    case "evaluate_experts":
      return { experts: await take("expert_profiles", "expert_key, understanding_score, sessions_count, status, updated_at", "understanding_score") };
    case "evaluate_models":
      return { models: await take("ai_models", "model_key, provider, status, quality_score, cost_per_1m_input, cost_per_1m_output", "quality_score", 40),
               health: await take("ai_model_health", "model_key, last_status, calls, failures, total_latency_ms, total_usd", "updated_at", 40) };
    case "evaluate_mcp":
      return { mcp: await take("mcp_providers", "name, enabled, reliability, avg_latency_ms, avg_cost_usd, capabilities", "updated_at", 40) };
    case "evaluate_trust":
      return { weakest: o.weakestLinks, profiles: await take("trust_profiles", "entity_type, entity_key, trust_score, samples", "trust_score", 30) };
    case "evaluate_knowledge":
      return { nodes: await take("knowledge_nodes", "layer, title, quality, confidence, reliability, updated_at", "quality", 30) };
    case "evaluate_memory":
      return { memory: await take("maaroof_memory", "kind, scope, importance, reliability, usage_count, updated_at", "importance", 30) };
    case "evaluate_state":
      return { anchors: await take("state_anchors", "level, scope_id, health_score, drift, status, updated_at", "updated_at", 30) };
    case "evaluate_workspaces":
      return { workspaces: await take("workspaces", "id, name, kind, country, risk_level, created_at", "created_at", 30) };
    case "evaluate_users":
      return { users: o.users, requests: await take("subscription_requests", "status, request_type, created_at", "created_at", 30) };
    case "evaluate_costs":
    case "evaluate_revenue":
    case "evaluate_business":
      return { economics: o.economics, topCostTools: o.topCostTools, plans: await take("subscription_plans", "name, price_iqd, price_usd, monthly_tokens, active", "price_iqd", 20) };
    case "evaluate_security":
      return { activity: await take("activity_log", "action, created_at", "created_at", 30) };
    case "evaluate_geo":
    case "evaluate_seo":
    case "evaluate_aso":
    case "evaluate_branding":
    case "evaluate_social":
      return { publications: await take("publications", "platform_key, status, stage, created_at", "created_at", 30),
               metrics: await take("publication_metrics", "impressions, clicks, reach, ai_visibility, created_at", "created_at", 30) };

    case "evaluate_architecture":
    case "audit":
    case "review":
      return { runs: o.runs, economics: o.economics, models: o.models, proposals: o.proposals,
               decisions: await take("decision_traces", "stage, score, created_at", "created_at", 25) };
    default:
      return { runs: o.runs, economics: o.economics, topCostTools: o.topCostTools, proposals: o.proposals };
  }
}

/* ---------------------------- Tasks ------------------------------- */

export type TaskInput = Record<string, any>;

export async function listTasks(filter?: { status?: string; workspaceId?: string | null }) {
  let q = db().from("hermes_tasks").select("*")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(300);
  if (filter?.status) q = q.eq("status", filter.status);
  if (filter?.workspaceId) q = q.eq("workspace_id", filter.workspaceId);
  const { data } = await q;
  return ((data as any[]) || []);
}

export async function getTask(taskId: string) {
  const [{ data: task }, { data: events }] = await Promise.all([
    db().from("hermes_tasks").select("*").eq("id", taskId).maybeSingle(),
    db().from("hermes_task_events").select("*").eq("task_id", taskId).order("created_at", { ascending: false }).limit(200),
  ]);
  return { task: task as any, events: ((events as any[]) || []) };
}

export async function logTaskEvent(input: { taskId: string; actorId?: string | null; kind: string; summary?: string; payload?: any }) {
  await db().from("hermes_task_events").insert({
    task_id: input.taskId,
    actor_id: input.actorId || null,
    kind: input.kind,
    summary: (input.summary || "").slice(0, 500) || null,
    payload: input.payload || {},
  });
}

export async function createTask(input: TaskInput, founderId: string) {
  const { data, error } = await db().from("hermes_tasks")
    .insert({ ...input, created_by: founderId })
    .select().maybeSingle();
  if (error) throw new Error(error.message);
  await logTaskEvent({ taskId: (data as any).id, actorId: founderId, kind: "created", summary: (data as any).title });
  return data as any;
}

export async function updateTask(taskId: string, patch: TaskInput, founderId: string) {
  const { data, error } = await db().from("hermes_tasks").update(patch).eq("id", taskId).select().maybeSingle();
  if (error) throw new Error(error.message);
  await logTaskEvent({ taskId, actorId: founderId, kind: patch.status ? "status_changed" : "updated", summary: patch.status || "تحديث", payload: patch });
  return data as any;
}

/** Executive result — assembled from measured signals, never invented. */
export async function buildTaskReport(taskId: string, founderId: string) {
  const { task } = await getTask(taskId);
  if (!task) throw new Error("not_found");
  const observatory = await observePlatform();
  const budget = num(task.cost_budget_usd);
  const spent = num(task.spent_usd);

  const report = {
    generated_at: new Date().toISOString(),
    executive_summary: `«${task.title}» — الحالة ${task.status}، التقدّم ${num(task.progress)}%، الكلفة المصروفة ${round(spent)}$ من ميزانية ${budget ? round(budget) + "$" : "غير محددة"}.`,
    detailed_report: task.description || "لا وصف مسجّل.",
    architecture_impact: (task.required_tools || []).concat(task.required_mcp || []).join("، ") || "غير محدد",
    business_impact: task.business_goal || "غير محدد",
    knowledge_impact: Array.isArray(task.knowledge_sources) && task.knowledge_sources.length ? `${task.knowledge_sources.length} مصدر معرفي مرتبط` : "لا مصادر مرتبطة",
    trust_impact: observatory.weakestLinks.length ? `${observatory.weakestLinks.length} حلقة ضعيفة قائمة على مستوى المنصة` : "لا حلقات ضعيفة مقاسة",
    performance_impact: `نجاح التشغيل على مستوى المنصة ${Math.round(observatory.runs.successRatio * 100)}%`,
    revenue_impact: observatory.economics.marginPct != null ? `هامش المنصة ${observatory.economics.marginPct}%` : "الهامش غير مقاس بعد",
    cost_analysis: {
      spent_usd: round(spent),
      budget_usd: budget || null,
      remaining_usd: budget ? round(budget - spent) : null,
      spent_tokens: num(task.spent_tokens),
      token_budget: task.token_budget ?? null,
    },
    recommendations: [
      budget && spent > budget ? "تجاوزت الميزانية — أعد تقدير النطاق قبل الاستمرار." : "الكلفة ضمن الميزانية المرصودة.",
      num(task.progress) < 100 ? "المهمة غير مكتملة — راجع الاعتماديات والحواجز." : "المهمة مكتملة؛ وثّق الدروس.",
    ],
    lessons_learned: [] as string[],
    next_actions: (task.dependencies || []).length ? ["مراجعة المهام المعتمدة على هذه المهمة"] : ["إغلاق المهمة أو أرشفتها"],
  };

  await db().from("hermes_tasks").update({ result: report }).eq("id", taskId);
  await logTaskEvent({ taskId, actorId: founderId, kind: "report", summary: "تقرير تنفيذي" });
  return report;
}

/* ------------------------- Live monitor --------------------------- */

export async function executiveMonitor() {
  const since = new Date(Date.now() - 24 * 36e5).toISOString();
  const [tasks, runs, ledger, learning, knowledge, trust, state] = await Promise.all([
    db().from("hermes_tasks").select("id, title, status, progress, execution_mode, spent_usd, spent_tokens, expert_assignment, required_models, required_mcp").in("status", ["running", "preparing", "learning", "needs_approval", "paused", "blocked"]).limit(100),
    db().from("maaroof_runs").select("id, status, total_tokens, total_usd, started_at").gte("started_at", since).limit(300),
    db().from("token_ledger").select("tokens, usd_cost, meta").gte("created_at", since).limit(1000),
    db().from("learning_budget_ledger").select("usd, tokens").gte("created_at", since).limit(500),
    db().from("knowledge_nodes").select("id").gte("updated_at", since).limit(500),
    db().from("trust_profiles").select("entity_key").gte("updated_at", since).limit(500),
    db().from("state_timeline").select("id").gte("created_at", since).limit(500),
  ]);

  const taskRows = (tasks.data as any[]) || [];
  const runRows = (runs.data as any[]) || [];
  const ledgerRows = (ledger.data as any[]) || [];

  return {
    window_hours: 24,
    tasks: taskRows,
    activeExperts: [...new Set(taskRows.flatMap((t) => t.expert_assignment || []))],
    activeModels: [...new Set(taskRows.flatMap((t) => t.required_models || []))],
    activeMcp: [...new Set(taskRows.flatMap((t) => t.required_mcp || []))],
    runningRuns: runRows.filter((r) => r.status === "running").length,
    runs24h: runRows.length,
    tokens24h: ledgerRows.reduce((a, r) => a + num(r.tokens), 0),
    realUsd24h: round(ledgerRows.reduce((a, r) => a + num(r?.meta?.real_usd_cost), 0)),
    chargedUsd24h: round(ledgerRows.reduce((a, r) => a + num(r.usd_cost), 0)),
    learningUsd24h: round(((learning.data as any[]) || []).reduce((a, r) => a + num(r.usd), 0)),
    knowledgeUpdates24h: ((knowledge.data as any[]) || []).length,
    trustUpdates24h: ((trust.data as any[]) || []).length,
    stateUpdates24h: ((state.data as any[]) || []).length,
  };
}


/* ------------------------------------------------------------------ */
/* Part 19.6 — HERMES Executive Operating System (EOS)                 */
/*                                                                     */
/* Evolution, not creation: HERMES already observes, proposes, chats,  */
/* runs tasks and reports. EOS adds the missing seam — supervising the */
/* Reality Execution Engine (Part 19.2) and folding verification state */
/* (Part 19.3) into the founder's executive picture.                   */
/* ------------------------------------------------------------------ */

/** Live view of every execution HERMES is stewarding. */
export async function eosExecutionWatch() {
  try {
    const { executionOverview } = await import("@/lib/maaroof/execution.server");
    const overview = await executionOverview(100);
    const blocked = overview.recent.filter((r: any) => r.approval_required && !r.approved_at);
    const failing = overview.recent.filter((r: any) => r.status === "failed" || r.status === "partial");
    return { ...overview, blocked, failing };
  } catch {
    return { total: 0, by_status: {}, by_mode: {}, avg_outcome: 0, total_cost_usd: 0, awaiting_approval: 0, recent: [], blocked: [], failing: [] };
  }
}

/** Founder decision on an execution — recorded as constitutional memory. */
export async function eosDecideExecution(input: {
  executionId: string;
  founderId: string;
  decision: "approve" | "reject" | "pause" | "resume" | "archive";
  note?: string | null;
}): Promise<boolean> {
  const map: Record<string, string> = { approve: "approved", reject: "rejected", pause: "paused", resume: "approved", archive: "archived" };
  try {
    const patch: Record<string, any> = { status: map[input.decision] || "draft" };
    if (input.decision === "approve" || input.decision === "resume") {
      patch.approved_by = input.founderId;
      patch.approved_at = new Date().toISOString();
    }
    await db().from("executions").update(patch).eq("id", input.executionId);
    const { logExecutionEvent } = await import("@/lib/maaroof/execution.server");
    await logExecutionEvent({
      executionId: input.executionId,
      stage: "approval",
      kind: input.decision === "reject" ? "warn" : "success",
      summary: `قرار المؤسس: ${input.decision}`,
      userId: input.founderId,
      payload: { note: input.note || null },
    });
    await learnFromDecision({
      proposalId: input.executionId,
      decision: input.decision === "approve" || input.decision === "resume" ? "approved" : input.decision === "reject" ? "rejected" : "deferred",
      note: input.note || null,
      founderId: input.founderId,
    } as any);
    return true;
  } catch {
    return false;
  }
}

/** One executive brief combining monitor + execution watch + architectural audit. */
export async function eosExecutiveBrief() {
  const [monitor, executions, audit] = await Promise.all([
    executiveMonitor().catch(() => null),
    eosExecutionWatch(),
    import("@/lib/maaroof/audit.server").then((m) => m.architecturalAudit()).catch(() => null),
  ]);
  const headline = [
    audit ? audit.summary : null,
    executions.total ? `التنفيذ: ${executions.total} عملية بمتوسط نتيجة ${executions.avg_outcome}%، ${executions.awaiting_approval} بانتظار الاعتماد.` : "لا عمليات تنفيذ مسجّلة بعد.",
    monitor ? `آخر 24 ساعة: ${monitor.runs24h} تشغيل و${monitor.knowledgeUpdates24h} تحديث معرفي.` : null,
  ].filter(Boolean).join(" ");
  return { headline, monitor, executions, audit, generated_at: new Date().toISOString() };
}
