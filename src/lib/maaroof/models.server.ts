// Part 12 — AI Model Governance & Evolution.
//
// Evolution, not replacement: `settings.planner_model` / `fallback_model`
// remain the source of truth whenever governance is OFF, so the runtime
// behaves byte-for-byte as before. When governance is ON, this module turns
// models into governed *executive resources*: a central registry with real
// prices, per-phase selection with a stated reason, health telemetry fed by
// every gateway call, benchmarks, and admin-approved upgrade proposals.
import { createClient } from "@supabase/supabase-js";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db as any;
}

export type ModelRow = {
  model_key: string;
  provider: string;
  version: string | null;
  capabilities: Record<string, any>;
  strengths: any[];
  weaknesses: any[];
  speed: number;
  latency_ms: number | null;
  reliability: number;
  cost_in_usd_per_mtok: number;
  cost_out_usd_per_mtok: number;
  recommended_use_cases: any[];
  limitations: any[];
  status: string;
};

/** Decision phases that may pick a different model. */
export type ModelPhase =
  | "envision"
  | "planning"
  | "council"
  | "conflict"
  | "reflection"
  | "final"
  | "learning";

export type ModelChoice = {
  model: string;
  fallback: string | null;
  reason: string;
  expected_cost_per_1k_usd: number;
  governed: boolean;
};

const TTL_MS = 120_000;
let _cache: { at: number; rows: ModelRow[] } | null = null;

export async function loadModelRegistry(force = false): Promise<ModelRow[]> {
  if (!force && _cache && Date.now() - _cache.at < TTL_MS) return _cache.rows;
  try {
    const { data } = await db()
      .from("ai_models")
      .select(
        "model_key, provider, version, capabilities, strengths, weaknesses, speed, latency_ms, reliability, cost_in_usd_per_mtok, cost_out_usd_per_mtok, recommended_use_cases, limitations, status",
      );
    const rows = ((data as any[]) || []) as ModelRow[];
    _cache = { at: Date.now(), rows };
    return rows;
  } catch {
    return _cache?.rows || [];
  }
}

export function invalidateModelRegistry() {
  _cache = null;
}

export type ModelCatalogHealth = {
  activeModels: number;
  providers: string[];
  realRegistry: boolean;
  hasGovernedOptions: boolean;
  reason: string;
};

/** Pure summary for UI/audit surfaces; it never invents catalog entries. */
export function summarizeModelRegistry(rows: ModelRow[]): ModelCatalogHealth {
  const active = rows.filter((row) => row.status === "active");
  const providers = [...new Set(active.map((row) => row.provider).filter(Boolean))].sort();
  return {
    activeModels: active.length,
    providers,
    realRegistry: active.length > 0,
    hasGovernedOptions: active.length > 1,
    reason:
      active.length > 0
        ? `سجل النماذج يحتوي ${active.length} نموذجاً نشطاً عبر ${providers.length} مزود.`
        : "سجل النماذج فارغ؛ سيُستخدم planner_model وfallback_model من الإعدادات.",
  };
}

/** Real USD cost of a call, from registry prices (falls back to Gemini Pro rates). */
export function costOf(model: string, inTok: number, outTok: number, registry: ModelRow[]): number {
  const row = registry.find((r) => r.model_key === model);
  const cin = row ? Number(row.cost_in_usd_per_mtok) : 1.25;
  const cout = row ? Number(row.cost_out_usd_per_mtok) : 10;
  return (inTok / 1e6) * cin + (outTok / 1e6) * cout;
}

/** Weight profile per phase: how much reasoning vs cost vs speed matters. */
const PHASE_WEIGHTS: Record<ModelPhase, { reasoning: number; cost: number; speed: number }> = {
  envision:   { reasoning: 0.6, cost: 0.2, speed: 0.2 },
  planning:   { reasoning: 0.6, cost: 0.25, speed: 0.15 },
  council:    { reasoning: 0.45, cost: 0.35, speed: 0.2 },
  conflict:   { reasoning: 0.5, cost: 0.3, speed: 0.2 },
  reflection: { reasoning: 0.25, cost: 0.5, speed: 0.25 },
  final:      { reasoning: 0.65, cost: 0.2, speed: 0.15 },
  learning:   { reasoning: 0.3, cost: 0.5, speed: 0.2 },
};

export type SelectModelInput = {
  phase: ModelPhase;
  /** Governance master switch — when false we return the configured default verbatim. */
  enabled: boolean;
  defaultModel: string;
  fallbackModel: string;
  /** workspace.preferred_models — a hard allow-list when non-empty. */
  preferredModels?: string[] | null;
  /** "low" | "medium" | "high" — high risk pushes toward stronger reasoning. */
  riskLevel?: string | null;
  /** Remaining budget hint in USD; small budgets push toward cheaper models. */
  budgetUsd?: number | null;
  registry?: ModelRow[];
};

/**
 * Choose the most suitable model for one phase, with an explicit reason.
 * Deterministic and zero-cost: no LLM call is made to pick a model.
 */
export async function selectModel(input: SelectModelInput): Promise<ModelChoice> {
  const fallback = input.fallbackModel || null;
  if (!input.enabled) {
    return {
      model: input.defaultModel,
      fallback,
      reason: "حوكمة النماذج مُطفأة — استُخدم النموذج الافتراضي المُعدّ في الإعدادات.",
      expected_cost_per_1k_usd: 0,
      governed: false,
    };
  }

  const registry = (input.registry || (await loadModelRegistry())).filter(
    (r) => r.status === "active",
  );
  if (!registry.length) {
    return {
      model: input.defaultModel,
      fallback,
      reason: "سجل النماذج فارغ — الرجوع إلى النموذج الافتراضي.",
      expected_cost_per_1k_usd: 0,
      governed: false,
    };
  }

  const allow = (input.preferredModels || []).filter(Boolean);
  const pool = allow.length ? registry.filter((r) => allow.includes(r.model_key)) : registry;
  const candidates = pool.length ? pool : registry;

  const w = { ...PHASE_WEIGHTS[input.phase] };
  if (input.riskLevel === "high") { w.reasoning += 0.15; w.cost -= 0.15; }
  if (input.riskLevel === "low") { w.cost += 0.1; w.reasoning -= 0.1; }
  if (typeof input.budgetUsd === "number" && input.budgetUsd > 0 && input.budgetUsd < 1) {
    w.cost += 0.2; w.reasoning -= 0.2;
  }

  const maxCost = Math.max(
    ...candidates.map((r) => Number(r.cost_in_usd_per_mtok) + Number(r.cost_out_usd_per_mtok)),
    0.0001,
  );

  const scored = candidates.map((r) => {
    const reasoning = Number(r.capabilities?.reasoning ?? 50) / 100;
    const costUnit = (Number(r.cost_in_usd_per_mtok) + Number(r.cost_out_usd_per_mtok)) / maxCost;
    const speed = Number(r.speed ?? 50) / 100;
    const score =
      w.reasoning * reasoning + w.cost * (1 - costUnit) + w.speed * speed + Number(r.reliability ?? 0.95) * 0.1;
    return { row: r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1]?.row?.model_key || fallback;

  const r = best.row;
  const expected = ((Number(r.cost_in_usd_per_mtok) + Number(r.cost_out_usd_per_mtok)) / 1e6) * 1000;

  return {
    model: r.model_key,
    fallback: second,
    reason:
      `مرحلة «${input.phase}»: استدلال ${r.capabilities?.reasoning ?? "—"}، سرعة ${r.speed}، ` +
      `تكلفة ${r.cost_in_usd_per_mtok}/${r.cost_out_usd_per_mtok} $/M` +
      (allow.length ? " — ضمن نماذج مساحة العمل المفضّلة." : " — الأفضل توازناً بين الجودة والتكلفة والسرعة."),
    expected_cost_per_1k_usd: Number(expected.toFixed(6)),
    governed: true,
  };
}

/** Model health telemetry — updated after every gateway call (best effort). */
export async function recordModelCall(input: {
  model: string;
  ok: boolean;
  latencyMs: number;
  tokens?: number;
  usd?: number;
  error?: string | null;
}): Promise<void> {
  try {
    const { data } = await db()
      .from("ai_model_health")
      .select("model_key, calls, failures, total_latency_ms, total_tokens, total_usd")
      .eq("model_key", input.model)
      .maybeSingle();
    const prev: any = data || {};
    await db()
      .from("ai_model_health")
      .upsert(
        {
          model_key: input.model,
          calls: Number(prev.calls || 0) + 1,
          failures: Number(prev.failures || 0) + (input.ok ? 0 : 1),
          total_latency_ms: Number(prev.total_latency_ms || 0) + Math.max(0, Math.round(input.latencyMs)),
          total_tokens: Number(prev.total_tokens || 0) + Math.max(0, Math.round(input.tokens || 0)),
          total_usd: Number(prev.total_usd || 0) + Math.max(0, Number(input.usd || 0)),
          last_error: input.ok ? prev.last_error ?? null : String(input.error || "").slice(0, 300),
          last_status: input.ok ? "ok" : "error",
          last_call_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "model_key" },
      );
  } catch {
    /* telemetry must never break a run */
  }
}

/**
 * Detect governance-worthy changes and file a proposal for the admin.
 * Never applies anything: activation stays a human decision (Part 12 final rule).
 */
export async function proposeModelUpgrade(currentModel: string): Promise<string | null> {
  try {
    const registry = await loadModelRegistry(true);
    const current = registry.find((r) => r.model_key === currentModel);
    if (!current) return null;
    const currentUnit = Number(current.cost_in_usd_per_mtok) + Number(current.cost_out_usd_per_mtok);
    const currentReason = Number(current.capabilities?.reasoning ?? 50);

    const better = registry
      .filter((r) => r.model_key !== currentModel && r.status !== "deprecated")
      .filter((r) => {
        const unit = Number(r.cost_in_usd_per_mtok) + Number(r.cost_out_usd_per_mtok);
        const reason = Number(r.capabilities?.reasoning ?? 50);
        return (reason >= currentReason && unit < currentUnit * 0.8) || reason >= currentReason + 8;
      })
      .sort((a, b) => Number(b.capabilities?.reasoning ?? 0) - Number(a.capabilities?.reasoning ?? 0))[0];
    if (!better) return null;

    const { data: existing } = await db()
      .from("ai_model_proposals")
      .select("id")
      .eq("model_key", better.model_key)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return (existing as any).id;

    const betterUnit = Number(better.cost_in_usd_per_mtok) + Number(better.cost_out_usd_per_mtok);
    const gain = currentUnit > 0 ? Math.round(((currentUnit - betterUnit) / currentUnit) * 100) : 0;

    const { data: ins } = await db()
      .from("ai_model_proposals")
      .insert({
        model_key: better.model_key,
        kind: "adopt",
        reason: `مقارنة بـ ${currentModel}: استدلال ${better.capabilities?.reasoning ?? "—"} مقابل ${currentReason}، وتكلفة وحدة ${betterUnit} مقابل ${currentUnit}.`,
        pros: better.strengths || [],
        cons: better.weaknesses || [],
        current_cost_usd: currentUnit,
        expected_cost_usd: betterUnit,
        impact: {
          quality: Number(better.capabilities?.reasoning ?? 50) - currentReason,
          speed: Number(better.speed ?? 50) - Number(current.speed ?? 50),
          cost_pct: gain,
        },
        migration_plan: "تفعيل النموذج لمرحلة واحدة (reflection) أولاً، ثم التوسّع بعد أسبوع من القياس.",
        test_plan: "تشغيل Benchmark على نفس المهمة بين النموذجين ومقارنة الدقة والتكلفة والتوكنات.",
        rollback_plan: `إعادة planner_model إلى ${currentModel} من إعدادات معروف — بدون أي تغيير في البيانات.`,
        risks: better.limitations || [],
        expected_gain_pct: gain,
        status: "pending",
      })
      .select("id")
      .single();
    return (ins as any)?.id || null;
  } catch {
    return null;
  }
}
