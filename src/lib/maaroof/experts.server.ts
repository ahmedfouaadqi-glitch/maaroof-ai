// Part 9 + 10 — Expert Learning Engine & Learning Governance.
//
// Evolution, not replacement: the static Capability Registry in
// `tool-catalog.ts` stays the single source of truth for *what* an expert is.
// This module adds what the registry cannot express — what Maaroof has
// actually *learned* about each expert through a cognitive interview, how
// well it understands it, and a frozen snapshot agents read instead of
// re-reading the tool definition every run.
//
// Governance (Part 10): every token spent here is charged to the System
// Learning Budget (`learning_budget_ledger`) and NEVER to a user balance.
// Zero-cost operations are still recorded, with the reason they were free.
import { createClient } from "@supabase/supabase-js";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders, extractJsonObject } from "@/lib/lovable-ai";
import { TOOL_CATALOG, type ToolDef } from "@/lib/tool-catalog";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db as any;
}

/* ------------------------------------------------------------------ */
/* Cognitive interview                                                 */
/* ------------------------------------------------------------------ */

/** Part 9 — the cognitive interview. Not a test: a two-way conversation. */
export const INTERVIEW_QUESTIONS: string[] = [
  "من أنت؟ وما رسالتك؟",
  "ما المشكلة التي تحلها؟ وما الذي لا تستطيع حله؟",
  "متى يجب استخدامك؟ ومتى يجب عدم استخدامك؟",
  "ما أفضل النتائج التي تقدمها؟ وما أسوأ الحالات؟",
  "ما هي حدودك ومخاطرك؟",
  "ما نقاط قوتك ونقاط ضعفك؟",
  "ما طريقة تفكيرك وأسلوب اتخاذ القرار لديك؟",
  "كيف تقيّم الجودة وتقيس النجاح؟",
  "كيف تتعامل مع نقص البيانات وعدم اليقين؟",
  "ما أفضل أنواع المستخدمين والعلامات التجارية والمشاريع لك؟",
  "ما البيانات التي تحتاجها وما التي لا تحتاجها؟",
  "ما أفضل النماذج وأفضل MCP لك؟",
  "ما التكلفة المثالية؟ وكيف تقللها وترفع الجودة؟",
  "ما الذي تحتاج تطويره؟ وما الذي تقترحه على معروف؟",
  "كيف تتعاون مع الخبراء الآخرين؟",
];

/** The reverse leg: the expert interrogates Maaroof and advises it. */
const DIALOGUE_PROMPT = `الآن اعكس الأدوار: أنت الخبير وتسأل "معروف" وتنصحه.
اذكر: كيف يستخدمك بأفضل شكل، أفضل الممارسات، الأخطاء الشائعة عند استخدامك،
كيف يدمجك مع خبراء آخرين، ومتى يجب أن يتجنبك تماماً.
ثم اذكر ما الذي تحتاج أن تعرفه من معروف قبل كل مهمة.`;

const EXTRACTION_PROMPT = `استخرج الآن من كل ما سبق كائن JSON واحد فقط بلا أي نص آخر، بهذا الشكل:
{
  "identity": "...", "mission": "...",
  "thinking_style": "...", "decision_style": "...", "reasoning_style": "...",
  "strengths": ["..."], "weaknesses": ["..."], "limitations": ["..."], "risks": ["..."],
  "success_indicators": ["..."], "failure_indicators": ["..."],
  "when_to_use": ["..."], "when_not_to_use": ["..."],
  "required_data": ["..."], "unneeded_data": ["..."],
  "preferred_models": ["..."], "preferred_mcp": ["..."],
  "policies": { "quality": "...", "uncertainty": "...", "cost": "..." },
  "memory_behaviour": "...", "learning_behaviour": "...", "confidence_behaviour": "...",
  "cost_behaviour": "...", "risk_behaviour": "...",
  "knowledge_graph": [{ "entity": "...", "relation": "...", "target": "..." }],
  "capability_graph": [{ "capability": "...", "level": 0 }],
  "cooperation": [{ "expert": "...", "how": "..." }],
  "brand_impact": ["..."],
  "improvement_suggestions": [{ "title": "...", "why": "...", "impact": "..." }]
}`;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ExpertProfile = {
  expert_key: string;
  version: number;
  status: string;
  dna: Record<string, any>;
  thinking_style: string | null;
  decision_style: string | null;
  reasoning_style: string | null;
  knowledge_graph: any[];
  capability_graph: any[];
  strengths: any[];
  weaknesses: any[];
  limitations: any[];
  risks: any[];
  success_indicators: any[];
  failure_indicators: any[];
  preferred_models: any[];
  preferred_mcp: any[];
  policies: Record<string, any>;
  cooperation: any[];
  improvement_suggestions: any[];
  coverage: Record<string, number>;
  understanding_score: number;
  confidence: number;
  sessions_count: number;
  last_learned_at: string | null;
  fingerprint: string | null;
};

export type LearningResult = {
  ok: boolean;
  expertKey: string;
  sessionId?: string;
  version?: number;
  understanding_score?: number;
  usd?: number;
  tokens?: number;
  zero_cost_reason?: string | null;
  error?: string;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function toolDef(key: string): ToolDef | null {
  return TOOL_CATALOG.find((t) => t.key === key) || null;
}

/** Stable hash of everything that defines the expert. Change ⇒ re-learn. */
function fingerprintOf(def: ToolDef): string {
  const src = JSON.stringify({
    key: def.key,
    labels: def.labels,
    dna: (def as any).dna,
    capabilities: (def as any).capabilities,
    strengths: (def as any).strengths,
    weaknesses: (def as any).weaknesses,
    preferred_models: (def as any).preferredModels,
    cost: (def as any).costProfile,
    risk: (def as any).risk,
  });
  let h = 0;
  for (let i = 0; i < src.length; i++) h = (Math.imul(31, h) + src.charCodeAt(i)) | 0;
  return `fp_${(h >>> 0).toString(16)}_${src.length}`;
}

const COVERAGE_FIELDS: Record<string, string[]> = {
  knowledge: ["identity", "mission", "required_data", "knowledge_graph"],
  capability: ["capability_graph", "when_to_use", "when_not_to_use", "strengths"],
  reasoning: ["thinking_style", "reasoning_style", "confidence_behaviour"],
  memory: ["memory_behaviour", "learning_behaviour"],
  decision: ["decision_style", "policies", "risk_behaviour"],
  cooperation: ["cooperation", "preferred_models", "preferred_mcp"],
};

function filled(v: any): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return String(v).trim().length > 2;
}

/** Deterministic coverage + understanding score — no extra model call. */
export function scoreUnderstanding(extracted: Record<string, any>): {
  coverage: Record<string, number>;
  understanding: number;
} {
  const coverage: Record<string, number> = {};
  for (const [dim, fields] of Object.entries(COVERAGE_FIELDS)) {
    const hits = fields.filter((f) => filled(extracted?.[f])).length;
    coverage[dim] = Math.round((hits / fields.length) * 100);
  }
  const vals = Object.values(coverage);
  const understanding = Math.round(vals.reduce((a, b) => a + b, 0) / (vals.length || 1));
  return { coverage, understanding };
}

/** Rough per-model USD estimate. Mirrors the orchestrator's gateway accounting. */
function estimateUsd(model: string, inTok: number, outTok: number): number {
  const cheap = /flash|mini|lite/i.test(model);
  return cheap ? inTok * 0.3e-6 + outTok * 2.5e-6 : inTok * 1.25e-6 + outTok * 10e-6;
}

async function gateway(model: string, messages: any[]): Promise<{ text: string; inTok: number; outTok: number; usd: number }> {
  const apiKey = process.env.LOVABLE_API_KEY!;
  const resp = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: lovableAiHeaders(apiKey),
    body: JSON.stringify({ model, messages }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`gateway_${resp.status}: ${t.slice(0, 200)}`);
  }
  const j: any = await resp.json();
  const usage = j?.usage || {};
  const inTok = Number(usage.prompt_tokens || 0);
  const outTok = Number(usage.completion_tokens || 0);
  return {
    text: j?.choices?.[0]?.message?.content || "",
    inTok,
    outTok,
    usd: estimateUsd(model, inTok, outTok),
  };
}

/** Part 10 — every learning op is recorded, including the free ones. */
export async function recordLearningSpend(entry: {
  purpose: string;
  expertKey?: string | null;
  sessionId?: string | null;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  usd?: number;
  cacheHit?: boolean;
  zeroCostReason?: string | null;
  latencyMs?: number | null;
  meta?: Record<string, any>;
}): Promise<void> {
  try {
    const inTok = entry.inputTokens || 0;
    const outTok = entry.outputTokens || 0;
    await db().from("learning_budget_ledger").insert({
      purpose: entry.purpose,
      expert_key: entry.expertKey || null,
      session_id: entry.sessionId || null,
      model: entry.model || null,
      input_tokens: inTok,
      output_tokens: outTok,
      tokens: inTok + outTok,
      usd: entry.usd || 0,
      cache_hit: !!entry.cacheHit,
      zero_cost_reason: entry.zeroCostReason || null,
      budget_source: "system",
      latency_ms: entry.latencyMs ?? null,
      meta: entry.meta || {},
    });
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Difference report (Part 10)                                         */
/* ------------------------------------------------------------------ */

export function diffExtractions(prev: Record<string, any> | null, next: Record<string, any>): Record<string, any> {
  if (!prev) return { first_version: true, added: Object.keys(next), removed: [], changed: [] };
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of keys) {
    const a = prev[k];
    const b = next[k];
    if (!filled(a) && filled(b)) added.push(k);
    else if (filled(a) && !filled(b)) removed.push(k);
    else if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(k);
  }
  return { first_version: false, added, removed, changed };
}

/* ------------------------------------------------------------------ */
/* Learning session                                                    */
/* ------------------------------------------------------------------ */

/**
 * Runs a full cognitive interview with one expert. Two model calls total
 * (interview + reverse dialogue & extraction). Skips entirely — at zero cost,
 * still logged — when the expert definition has not changed since the last
 * approved snapshot and `force` is not set.
 */
export async function runExpertLearningSession(opts: {
  expertKey: string;
  model: string;
  trigger?: string;
  force?: boolean;
  createdBy?: string | null;
}): Promise<LearningResult> {
  const def = toolDef(opts.expertKey);
  if (!def) return { ok: false, expertKey: opts.expertKey, error: "unknown_expert" };

  const startedAt = Date.now();
  const fp = fingerprintOf(def);
  const { data: prev } = await db().from("expert_profiles").select("*").eq("expert_key", def.key).maybeSingle();
  const prevProfile = (prev as ExpertProfile | null) || null;

  // Snapshot reuse — Part 10 "cost transparency": free, but never invisible.
  if (!opts.force && prevProfile && prevProfile.fingerprint === fp && prevProfile.status === "learned") {
    const { data: ins } = await db()
      .from("expert_learning_sessions")
      .insert({
        expert_key: def.key,
        version: prevProfile.version,
        status: "skipped",
        trigger: opts.trigger || "manual",
        transcript: [],
        extracted: {},
        understanding_score: prevProfile.understanding_score,
        confidence: prevProfile.confidence,
        zero_cost_reason: "snapshot_reused",
        duration_ms: Date.now() - startedAt,
        created_by: opts.createdBy || null,
      })
      .select("id")
      .single();
    await recordLearningSpend({
      purpose: "expert_learning",
      expertKey: def.key,
      sessionId: (ins as any)?.id || null,
      zeroCostReason: "snapshot_reused",
      latencyMs: Date.now() - startedAt,
    });
    return {
      ok: true,
      expertKey: def.key,
      sessionId: (ins as any)?.id,
      version: prevProfile.version,
      understanding_score: prevProfile.understanding_score,
      usd: 0,
      tokens: 0,
      zero_cost_reason: "snapshot_reused",
    };
  }

  const version = (prevProfile?.version || 0) + 1;
  const { data: sessIns } = await db()
    .from("expert_learning_sessions")
    .insert({
      expert_key: def.key,
      version,
      status: "running",
      trigger: opts.trigger || "manual",
      model: opts.model,
      created_by: opts.createdBy || null,
    })
    .select("id")
    .single();
  const sessionId = (sessIns as any)?.id as string | undefined;

  const persona = `أنت المحرك الخبير "${def.labels?.ar || def.key}" داخل منصة معروف.
المفتاح التقني: ${def.key}
الوصف الذاتي: ${(def as any).dna || ""}
القدرات المعلنة: ${JSON.stringify((def as any).capabilities || [])}
نقاط القوة المعلنة: ${JSON.stringify((def as any).strengths || [])}
نقاط الضعف المعلنة: ${JSON.stringify((def as any).weaknesses || [])}
ملف التكلفة: ${(def as any).costProfile || "medium"} — مستوى المخاطرة: ${(def as any).risk || "low"}

أجب بصفتك هذا الخبير، بصدق ودقة، بلا مبالغة، وباللغة العربية.
إن كنت لا تعرف شيئاً فقل ذلك صراحة بدل اختراعه.`;

  const transcript: Array<{ role: string; content: string }> = [];
  let inTok = 0;
  let outTok = 0;
  let usd = 0;

  try {
    // Leg 1 — the interview.
    const q1 = INTERVIEW_QUESTIONS.map((q, i) => `${i + 1}) ${q}`).join("\n");
    const r1 = await gateway(opts.model, [
      { role: "system", content: persona },
      { role: "user", content: `أجب على كل سؤال برقمه وبإيجاز مركّز:\n${q1}` },
    ]);
    transcript.push({ role: "maaroof", content: q1 }, { role: "expert", content: r1.text });
    inTok += r1.inTok; outTok += r1.outTok; usd += r1.usd;

    // Leg 2 — reverse dialogue + structured extraction in one call.
    const r2 = await gateway(opts.model, [
      { role: "system", content: persona },
      { role: "user", content: q1 },
      { role: "assistant", content: r1.text },
      { role: "user", content: `${DIALOGUE_PROMPT}\n\n${EXTRACTION_PROMPT}` },
    ]);
    transcript.push({ role: "maaroof", content: DIALOGUE_PROMPT }, { role: "expert", content: r2.text });
    inTok += r2.inTok; outTok += r2.outTok; usd += r2.usd;

    const extracted = extractJsonObject<Record<string, any>>(r2.text) || {};
    if (!Object.keys(extracted).length) throw new Error("extraction_failed");

    const { coverage, understanding } = scoreUnderstanding(extracted);
    const confidence = Math.round(understanding * 0.9);
    const diff = diffExtractions((prevProfile?.dna as any) || null, extracted);

    await db().from("expert_profiles").upsert(
      {
        expert_key: def.key,
        version,
        status: "learned",
        dna: extracted,
        thinking_style: extracted.thinking_style || null,
        decision_style: extracted.decision_style || null,
        reasoning_style: extracted.reasoning_style || null,
        knowledge_graph: extracted.knowledge_graph || [],
        capability_graph: extracted.capability_graph || [],
        strengths: extracted.strengths || [],
        weaknesses: extracted.weaknesses || [],
        limitations: extracted.limitations || [],
        risks: extracted.risks || [],
        success_indicators: extracted.success_indicators || [],
        failure_indicators: extracted.failure_indicators || [],
        preferred_models: extracted.preferred_models || [],
        preferred_mcp: extracted.preferred_mcp || [],
        policies: extracted.policies || {},
        cooperation: extracted.cooperation || [],
        improvement_suggestions: extracted.improvement_suggestions || [],
        coverage,
        understanding_score: understanding,
        confidence,
        sessions_count: (prevProfile?.sessions_count || 0) + 1,
        last_learned_at: new Date().toISOString(),
        fingerprint: fp,
      },
      { onConflict: "expert_key" },
    );

    await db().from("expert_snapshots").insert({
      expert_key: def.key,
      version,
      session_id: sessionId || null,
      approved: true,
      payload: {
        identity: extracted.identity,
        mission: extracted.mission,
        thinking_style: extracted.thinking_style,
        decision_style: extracted.decision_style,
        reasoning_style: extracted.reasoning_style,
        when_to_use: extracted.when_to_use,
        when_not_to_use: extracted.when_not_to_use,
        limitations: extracted.limitations,
        strengths: extracted.strengths,
        preferred_models: extracted.preferred_models,
        preferred_mcp: extracted.preferred_mcp,
        policies: extracted.policies,
        cost_behaviour: extracted.cost_behaviour,
        coverage,
        understanding_score: understanding,
        confidence,
        version,
      },
    });

    if (sessionId) {
      await db()
        .from("expert_learning_sessions")
        .update({
          status: "done",
          transcript,
          extracted,
          diff,
          understanding_score: understanding,
          confidence,
          input_tokens: inTok,
          output_tokens: outTok,
          tokens: inTok + outTok,
          usd,
          duration_ms: Date.now() - startedAt,
        })
        .eq("id", sessionId);
    }

    await recordLearningSpend({
      purpose: "expert_learning",
      expertKey: def.key,
      sessionId,
      model: opts.model,
      inputTokens: inTok,
      outputTokens: outTok,
      usd,
      latencyMs: Date.now() - startedAt,
      meta: { version, trigger: opts.trigger || "manual" },
    });

    return { ok: true, expertKey: def.key, sessionId, version, understanding_score: understanding, usd, tokens: inTok + outTok };
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 300);
    if (sessionId) {
      await db()
        .from("expert_learning_sessions")
        .update({
          status: "failed",
          error: msg,
          transcript,
          input_tokens: inTok,
          output_tokens: outTok,
          tokens: inTok + outTok,
          usd,
          duration_ms: Date.now() - startedAt,
        })
        .eq("id", sessionId);
    }
    await recordLearningSpend({
      purpose: "expert_learning",
      expertKey: def.key,
      sessionId,
      model: opts.model,
      inputTokens: inTok,
      outputTokens: outTok,
      usd,
      latencyMs: Date.now() - startedAt,
      meta: { failed: true },
    });
    return { ok: false, expertKey: def.key, sessionId, error: msg, usd, tokens: inTok + outTok };
  }
}

/* ------------------------------------------------------------------ */
/* Snapshot reads (used by the orchestrator)                           */
/* ------------------------------------------------------------------ */

export type ExpertSnapshot = { expert_key: string; version: number; payload: Record<string, any> };

/** Latest approved snapshot per expert. Agents read this, never the raw tool. */
export async function readExpertSnapshots(keys: string[]): Promise<Record<string, ExpertSnapshot>> {
  const out: Record<string, ExpertSnapshot> = {};
  if (!keys.length) return out;
  try {
    const { data } = await db()
      .from("expert_snapshots")
      .select("expert_key, version, payload")
      .in("expert_key", keys)
      .eq("approved", true)
      .order("version", { ascending: false });
    for (const row of ((data as any[]) || [])) {
      if (!out[row.expert_key]) out[row.expert_key] = row as ExpertSnapshot;
    }
  } catch {}
  return out;
}

/** Compact prompt block so learned knowledge actually shapes tool choice. */
export function snapshotPromptBlock(snaps: Record<string, ExpertSnapshot>): string {
  const entries = Object.values(snaps);
  if (!entries.length) return "";
  const lines = entries.slice(0, 12).map((s) => {
    const p = s.payload || {};
    const use = Array.isArray(p.when_to_use) ? p.when_to_use.slice(0, 2).join(" / ") : "";
    const avoid = Array.isArray(p.when_not_to_use) ? p.when_not_to_use.slice(0, 2).join(" / ") : "";
    return `- ${s.expert_key} (v${s.version}, فهم ${p.understanding_score ?? "—"}%): ${p.identity || ""}${use ? ` | استخدمه عند: ${use}` : ""}${avoid ? ` | تجنّبه عند: ${avoid}` : ""}`;
  });
  return `\n\n[Learned expert snapshots]\n${lines.join("\n")}`;
}

/** Experts that have never completed a learning session. */
export async function unlearnedExperts(): Promise<string[]> {
  try {
    const { data } = await db().from("expert_profiles").select("expert_key, status");
    const learned = new Set(((data as any[]) || []).filter((r) => r.status === "learned").map((r) => r.expert_key));
    return TOOL_CATALOG.filter((t) => !t.key.startsWith("agent.") && t.key !== "maaroof")
      .map((t) => t.key)
      .filter((k) => !learned.has(k));
  } catch {
    return [];
  }
}
