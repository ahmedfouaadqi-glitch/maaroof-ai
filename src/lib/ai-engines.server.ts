// Server-side bridge between the ten answer engines and the governed model
// registry (Part 12). Every tool that talks to the Lovable AI Gateway resolves
// its model through here instead of hardcoding a model string.
import {
  ENGINE_CATALOG,
  ENGINE_KEYS,
  type EngineKey,
  enginesForPlan,
  engineLimitForPlan,
  normalizeEngines,
} from "@/lib/ai-engines";
import { loadModelRegistry, selectModel, type ModelPhase, type ModelRow } from "@/lib/maaroof/models.server";
import { getMaaroofSettings } from "@/lib/maaroof/settings.server";

export type ResolvedEngineModel = {
  engine: EngineKey | null;
  model: string;
  fallback: string | null;
  proxy: boolean;
  governed: boolean;
  reason: string;
  expected_cost_per_1k_usd: number;
};

/** Registry rows explicitly bound to an engine via `capabilities.engine_keys`. */
function rowsForEngine(registry: ModelRow[], engine: EngineKey): string[] {
  return registry
    .filter((r) => {
      const keys = (r.capabilities as any)?.engine_keys;
      return Array.isArray(keys) && keys.includes(engine);
    })
    .map((r) => r.model_key);
}

/**
 * Resolve the gateway model for one engine (or for a generic tool phase when
 * `engine` is null). Falls back to the catalog default whenever governance is
 * off, the registry is empty, or anything throws — behaviour stays identical to
 * the previous hardcoded strings in that case.
 */
export async function resolveEngineModel(
  engine: EngineKey | null,
  opts: { phase?: ModelPhase; defaultModel?: string; riskLevel?: string | null; budgetUsd?: number | null } = {},
): Promise<ResolvedEngineModel> {
  const def = engine ? ENGINE_CATALOG[engine] : null;
  const defaultModel = opts.defaultModel || def?.defaultModel || "google/gemini-2.5-flash";
  const base: ResolvedEngineModel = {
    engine,
    model: defaultModel,
    fallback: null,
    proxy: def?.proxy ?? false,
    governed: false,
    reason: "النموذج الافتراضي للمحرك.",
    expected_cost_per_1k_usd: 0,
  };

  try {
    const settings = await getMaaroofSettings();
    const gov = settings.model_governance;
    if (!gov?.enabled) return base;

    const registry = await loadModelRegistry();
    const preferred = engine ? rowsForEngine(registry, engine) : [];
    const choice = await selectModel({
      phase: opts.phase || "final",
      enabled: true,
      defaultModel,
      fallbackModel: settings.fallback_model,
      preferredModels: preferred.length ? preferred : null,
      riskLevel: opts.riskLevel ?? null,
      budgetUsd: opts.budgetUsd ?? null,
      registry,
    });
    return {
      engine,
      model: choice.model || defaultModel,
      fallback: choice.fallback,
      proxy: def?.proxy ?? false,
      governed: choice.governed,
      reason: choice.reason,
      expected_cost_per_1k_usd: choice.expected_cost_per_1k_usd,
    };
  } catch {
    return base;
  }
}

/** Convenience for single-model tools: resolve by phase with a legacy default. */
export async function resolveToolModel(
  defaultModel: string,
  phase: ModelPhase = "final",
): Promise<string> {
  const r = await resolveEngineModel(null, { defaultModel, phase });
  return r.model;
}

/** Resolve every engine in one round-trip (one registry load, one settings read). */
export async function resolveEngineModels(
  engines: EngineKey[],
  phase: ModelPhase = "final",
): Promise<Record<string, ResolvedEngineModel>> {
  const out: Record<string, ResolvedEngineModel> = {};
  for (const e of engines) out[e] = await resolveEngineModel(e, { phase });
  return out;
}

export type EngineHealth = {
  engine: EngineKey;
  model: string;
  status: "ok" | "slow" | "error" | "unknown";
  avg_latency_ms: number;
  failure_rate: number;
  calls: number;
  last_call_at: string | null;
  /** Short human reason, used when a run excludes the engine. */
  reason: string;
};

const SLOW_MS = 25000;
const BAD_FAILURE_RATE = 0.4;

/**
 * Health per engine, derived from the governed model behind it
 * (`ai_model_health` telemetry written after every gateway call).
 * Never throws: unknown health always behaves as usable.
 */
export async function engineHealthMap(
  engines: EngineKey[] = [...ENGINE_KEYS],
): Promise<Record<string, EngineHealth>> {
  const resolved = await resolveEngineModels(engines, "final");
  const out: Record<string, EngineHealth> = {};
  let rows: any[] = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const models = Array.from(new Set(Object.values(resolved).map((r) => r.model)));
    const { data } = await supabaseAdmin
      .from("ai_model_health")
      .select("model_key, calls, failures, total_latency_ms, last_status, last_call_at")
      .in("model_key", models);
    rows = (data as any[]) || [];
  } catch {
    rows = [];
  }
  for (const e of engines) {
    const model = resolved[e]?.model || ENGINE_CATALOG[e].defaultModel;
    const r = rows.find((x) => x.model_key === model);
    const calls = Number(r?.calls || 0);
    const failures = Number(r?.failures || 0);
    const avg = calls > 0 ? Math.round(Number(r?.total_latency_ms || 0) / calls) : 0;
    const rate = calls > 0 ? failures / calls : 0;
    let status: EngineHealth["status"] = "unknown";
    let reason = "لا توجد بيانات كافية بعد.";
    if (calls > 0) {
      if (rate >= BAD_FAILURE_RATE || r?.last_status === "error") {
        status = "error";
        reason = `نسبة الأخطاء ${(rate * 100).toFixed(0)}% — تم استثناء المحرك من هذه الجلسة.`;
      } else if (avg >= SLOW_MS) {
        status = "slow";
        reason = `زمن استجابة مرتفع (${Math.round(avg / 1000)}s).`;
      } else {
        status = "ok";
        reason = `يعمل — متوسط ${Math.round(avg / 1000)}s.`;
      }
    }
    out[e] = {
      engine: e,
      model,
      status,
      avg_latency_ms: avg,
      failure_rate: Number(rate.toFixed(3)),
      calls,
      last_call_at: r?.last_call_at ?? null,
      reason,
    };
  }
  return out;
}

/**
 * Drop engines whose model is currently failing, so one broken provider cannot
 * fail a whole run. Slow/unknown engines are kept. If everything looks broken
 * the original list is returned unchanged (fail-open, never an empty run).
 */
export async function excludeUnhealthyEngines(
  engines: EngineKey[],
): Promise<{ engines: EngineKey[]; excluded: Array<{ engine: EngineKey; reason: string }> }> {
  if (!engines.length) return { engines, excluded: [] };
  try {
    const health = await engineHealthMap(engines);
    const excluded = engines
      .filter((e) => health[e]?.status === "error")
      .map((e) => ({ engine: e, reason: health[e]!.reason }));
    const kept = engines.filter((e) => !excluded.some((x) => x.engine === e));
    if (!kept.length) return { engines, excluded: [] };
    return { engines: kept, excluded };
  } catch {
    return { engines, excluded: [] };
  }
}

export type EngineEntitlement = {
  plan: string | null;
  isAdmin: boolean;
  limit: number;
  allowed: EngineKey[];
  locked: EngineKey[];
};

/**
 * Which engines this user may run, from their active plan.
 * MARK 1 = 3 engines, MARK 2 = 6, MARK 3 = 9, admins = all.
 */
export async function enginesAllowedForUser(
  admin: any,
  userId: string,
): Promise<EngineEntitlement> {
  let plan: string | null = null;
  let isAdmin = false;
  try {
    const { data: prof } = await admin
      .from("profiles")
      .select("subscription_tier, is_subscribed, subscription_expires_at")
      .eq("id", userId)
      .maybeSingle();
    const active =
      (prof as any)?.is_subscribed &&
      (!(prof as any)?.subscription_expires_at || new Date((prof as any).subscription_expires_at) > new Date());
    if (active) plan = (prof as any)?.subscription_tier || null;
  } catch {}
  try {
    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    isAdmin = !!role;
  } catch {}

  const allowed = enginesForPlan(plan, isAdmin);
  return {
    plan,
    isAdmin,
    limit: engineLimitForPlan(plan, isAdmin),
    allowed,
    locked: ENGINE_KEYS.filter((k) => !allowed.includes(k)),
  };
}

/** Intersect a requested engine list with the user's entitlement. */
export function applyEntitlement(requested: unknown, ent: EngineEntitlement): EngineKey[] {
  const list = normalizeEngines(requested);
  const base = list.length ? list : ent.allowed;
  return base.filter((e) => ent.allowed.includes(e)).slice(0, ent.limit);
}
