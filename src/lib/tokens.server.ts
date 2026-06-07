// Server-only token charging helper. Uses Supabase service role + the
// `charge_tokens` SQL function (atomic, runs as SECURITY DEFINER).
import { createClient } from "@supabase/supabase-js";

export type ChargeResult =
  | { ok: true; balance: number; used_today: number; used_month: number; tokens: number; usd: number }
  | { ok: false; reason: string; left?: number };

let _admin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

/**
 * Resolve the effective per-use cost for (user, toolKey) in this order:
 *   1) profiles.per_user_tool_overrides[toolKey]
 *   2) active plan -> tool_plan_access(plan_id, tool_key)
 *   3) tool_pricing_catalog default
 */
export async function resolveToolCost(userId: string, toolKey: string): Promise<{ tokens: number; usd: number; source: string }> {
  const db = admin();
  const { data: prof } = await db
    .from("profiles")
    .select("per_user_tool_overrides, subscription_tier, is_subscribed, subscription_expires_at")
    .eq("id", userId)
    .maybeSingle();

  const ov = (prof as any)?.per_user_tool_overrides?.[toolKey];
  if (ov && typeof ov.tokens_per_use === "number") {
    return { tokens: Number(ov.tokens_per_use) || 0, usd: Number(ov.usd_per_use) || 0, source: "user_override" };
  }

  const planActive =
    !!(prof as any)?.is_subscribed &&
    (!(prof as any)?.subscription_expires_at || new Date((prof as any).subscription_expires_at) >= new Date());
  if (planActive && (prof as any)?.subscription_tier) {
    const { data: planRow } = await db.from("subscription_plans").select("id").eq("name", (prof as any).subscription_tier).maybeSingle();
    const planId = (planRow as any)?.id as string | undefined;
    if (planId) {
      const { data: tpa } = await db
        .from("tool_plan_access")
        .select("tokens_per_use, usd_per_use, enabled")
        .eq("plan_id", planId)
        .eq("tool_key", toolKey)
        .maybeSingle();
      if (tpa && (tpa as any).enabled && Number((tpa as any).tokens_per_use) > 0) {
        return { tokens: Number((tpa as any).tokens_per_use), usd: Number((tpa as any).usd_per_use) || 0, source: "plan" };
      }
    }
  }

  const { data: cat } = await db
    .from("tool_pricing_catalog")
    .select("default_tokens, default_usd")
    .eq("tool_key", toolKey)
    .maybeSingle();
  return {
    tokens: Number((cat as any)?.default_tokens) || 0,
    usd: Number((cat as any)?.default_usd) || 0,
    source: "catalog",
  };
}

/**
 * Charge tokens for a tool run. If the user has no token controls
 * configured (no balance, no limits), the call is a no-op (legacy quota
 * logic in each endpoint still applies).
 */
export async function chargeTokens(opts: {
  userId: string;
  toolKey: string;
  runId?: string;
  meta?: Record<string, any>;
}): Promise<ChargeResult> {
  const db = admin();
  const { data: prof } = await db
    .from("profiles")
    .select("tokens_balance, tokens_daily_limit, tokens_monthly_limit")
    .eq("id", opts.userId)
    .maybeSingle();
  if (!prof) return { ok: true, balance: 0, used_today: 0, used_month: 0, tokens: 0, usd: 0 };

  const hasMeter =
    Number((prof as any).tokens_balance) > 0 ||
    (prof as any).tokens_daily_limit != null ||
    (prof as any).tokens_monthly_limit != null;
  if (!hasMeter) return { ok: true, balance: 0, used_today: 0, used_month: 0, tokens: 0, usd: 0 };

  const cost = await resolveToolCost(opts.userId, opts.toolKey);
  if (cost.tokens <= 0) return { ok: true, balance: Number((prof as any).tokens_balance) || 0, used_today: 0, used_month: 0, tokens: 0, usd: 0 };

  const { data, error } = await db.rpc("charge_tokens", {
    _user_id: opts.userId,
    _tool_key: opts.toolKey,
    _tokens: cost.tokens,
    _usd: cost.usd,
    _run_id: opts.runId || null,
    _meta: opts.meta || {},
  });
  if (error) return { ok: false, reason: error.message };
  const r = data as any;
  if (!r?.ok) return { ok: false, reason: r?.reason || "unknown", left: r?.left };
  return {
    ok: true,
    balance: Number(r.balance) || 0,
    used_today: Number(r.used_today) || 0,
    used_month: Number(r.used_month) || 0,
    tokens: cost.tokens,
    usd: cost.usd,
  };
}
