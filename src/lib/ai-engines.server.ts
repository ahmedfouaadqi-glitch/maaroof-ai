// Server-side bridge between the nine answer engines and the governed model
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
