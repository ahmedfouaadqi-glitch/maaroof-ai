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

export async function decideProposal(input: {
  proposalId: string;
  decision: "approved" | "rejected" | "deferred";
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
  await learnFromDecision({ proposal, decision: input.decision, note: input.note });
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
}): Promise<{ conversationId: string; reply: string; tokens: number; usd: number; observatory: Observatory }> {
  let conversationId = input.conversationId || null;
  if (!conversationId) {
    const { data } = await db().from("hermes_conversations")
      .insert({ user_id: input.userId, title: input.message.slice(0, 60) || "مكتب هرمس" })
      .select().maybeSingle();
    conversationId = (data as any)?.id;
  }

  const [observatory, dna, proposals, history] = await Promise.all([
    observePlatform(),
    getFounderDna(),
    listProposals("pending"),
    db().from("hermes_messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(20),
  ]);

  const system = [
    `أنت «${HERMES_IDENTITY.name}»، ${HERMES_IDENTITY.role} (${HERMES_IDENTITY.founder}).`,
    `ولاؤك: ${HERMES_IDENTITY.loyalty}.`,
    `حدودك المطلقة:\n${HERMES_IDENTITY.hardLimits.map((l) => `- ${l}`).join("\n")}`,
    "تتكلم بلغة تنفيذية موجزة: الخلاصة أولاً، ثم الدليل الرقمي، ثم الكلفة والعائد، ثم التوصية وخطة التراجع.",
    "كل رقم تذكره يجب أن يكون من بيانات المرصد أدناه. إن لم يوجد رقم، قل ذلك صراحة ولا تقدّره.",
    FACTUAL_SAFETY_PROMPT,
    founderDnaPrompt(dna),
    `مرصد المنصة (آخر ${observatory.window_days} يوماً):\n${JSON.stringify(observatory)}`,
    proposals.length ? `اقتراحات معلّقة بانتظار قرارك: ${proposals.map((p) => p.title).join(" | ")}` : "لا اقتراحات معلّقة.",
  ].join("\n\n");

  const messages = [
    { role: "system", content: system },
    ...(((history.data as any[]) || []).map((m) => ({ role: m.role, content: m.content }))),
    { role: "user", content: input.message },
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
  await db().rpc; // no-op guard for typed clients
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
