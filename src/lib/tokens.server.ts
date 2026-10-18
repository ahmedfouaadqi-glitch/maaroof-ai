// Server-only token charging helper. Uses Supabase service role + the
// `charge_tokens` SQL function (atomic, runs as SECURITY DEFINER).
//
// Pricing-resolution order (NO automatic fallbacks):
//   1) profiles.per_user_tool_overrides[toolKey]
//   2) active plan -> tool_plan_access(plan_id, tool_key) when enabled
//   3) NONE → tool is "unpriced" and the call is rejected with 402.
//
// The tool_pricing_catalog table is only a *suggestion library* for admins;
// it is never auto-applied to a user's run.
import { createClient } from "@supabase/supabase-js";

export type ResolvedCost = { tokens: number; usd: number; source: "user_override" | "plan" | "unpriced" | "disabled_by_admin" };
export type ChargeResult =
  | { ok: true; balance: number; used_today: number; used_month: number; tokens: number; usd: number; source: ResolvedCost["source"] }
  | { ok: false; reason: "unpriced" | "daily_limit" | "monthly_limit" | "balance" | "profile_not_found" | string; left?: number };

let _admin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

export async function resolveToolCost(userId: string, toolKey: string): Promise<ResolvedCost> {
  const db = admin();
  const { data: prof } = await db
    .from("profiles")
    .select("per_user_tool_overrides, subscription_tier, is_subscribed, subscription_expires_at")
    .eq("id", userId)
    .maybeSingle();

  // 0) Admin explicitly disabled this tool for this user
  const ov = (prof as any)?.per_user_tool_overrides?.[toolKey];
  if (ov && ov.enabled === false) {
    return { tokens: 0, usd: 0, source: "disabled_by_admin" };
  }

  // 1) Per-user override wins
  if (ov && (Number(ov.tokens_per_use) > 0 || Number(ov.usd_per_use) > 0)) {
    return {
      tokens: Number(ov.tokens_per_use) || 0,
      usd: Number(ov.usd_per_use) || 0,
      source: "user_override",
    };
  }

  // 2) Plan price
  const planActive =
    !!(prof as any)?.is_subscribed &&
    (!(prof as any)?.subscription_expires_at || new Date((prof as any).subscription_expires_at) >= new Date());
  if (planActive && (prof as any)?.subscription_tier) {
    const { data: planRow } = await db
      .from("subscription_plans")
      .select("id")
      .eq("name", (prof as any).subscription_tier)
      .maybeSingle();
    const planId = (planRow as any)?.id as string | undefined;
    if (planId) {
      const { data: tpa } = await db
        .from("tool_plan_access")
        .select("tokens_per_use, usd_per_use, enabled")
        .eq("plan_id", planId)
        .eq("tool_key", toolKey)
        .maybeSingle();
      if (tpa && !(tpa as any).enabled) {
        return { tokens: 0, usd: 0, source: "disabled_by_admin" as any };
      }
      if (tpa && (Number((tpa as any).tokens_per_use) > 0 || Number((tpa as any).usd_per_use) > 0)) {
        return {
          tokens: Number((tpa as any).tokens_per_use) || 0,
          usd: Number((tpa as any).usd_per_use) || 0,
          source: "plan",
        };
      }
    }
  }

  // 3) Sub-operation (e.g. "visibility.probe") with no own price → parent tool price.
  if (toolKey.includes(".") && !toolKey.startsWith("agent.")) {
    return resolveToolCost(userId, toolKey.split(".")[0]);
  }

  // 4) No admin-set price → unpriced
  return { tokens: 0, usd: 0, source: "unpriced" };
}

/**
 * Charge tokens for a tool run.
 *
 * Behavior:
 *  - If the user profile has NO metering (no balance and no limits set),
 *    the call is a no-op success — legacy quota logic still applies elsewhere.
 *  - If the tool is unpriced for this user (no override, no plan price),
 *    rejects with reason="unpriced". The route should return HTTP 402.
 */
export async function chargeTokens(opts: {
  userId: string;
  toolKey: string;
  runId?: string;
  meta?: Record<string, any>;
  /** Optional: charge this many units (e.g. number of engines in a probe). Default 1. */
  units?: number;
  /** Optional: per-unit token price that replaces the resolved price (admin-configured). */
  unitTokens?: number;
}): Promise<ChargeResult> {
  const db = admin();
  const { data: prof } = await db
    .from("profiles")
    .select("tokens_balance, tokens_daily_limit, tokens_monthly_limit")
    .eq("id", opts.userId)
    .maybeSingle();
  if (!prof) return { ok: false, reason: "profile_not_found" };

  const cost = await resolveToolCost(opts.userId, opts.toolKey);
  // Explicit admin disablement must win even for legacy/free accounts without token metering.
  if ((cost.source as any) === "disabled_by_admin") {
    return { ok: false, reason: "tool_disabled" };
  }

  const hasMeter =
    Number((prof as any).tokens_balance) > 0 ||
    (prof as any).tokens_daily_limit != null ||
    (prof as any).tokens_monthly_limit != null;

  // Preserve the legacy no-meter path, but never bypass an explicit admin disable.
  if (!hasMeter) {
    return { ok: true, balance: 0, used_today: 0, used_month: 0, tokens: 0, usd: 0, source: "unpriced" };
  }

  if (cost.source === "unpriced") {
    return { ok: false, reason: "unpriced" };
  }

  const units = Math.max(1, Math.round(Number(opts.units) || 1));
  const per = Number(opts.unitTokens) > 0 ? Math.round(Number(opts.unitTokens)) : cost.tokens;
  cost.tokens = per * units;
  cost.usd = cost.usd * units;
  const { data, error } = await (db.rpc as any)("charge_tokens", {
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
    source: cost.source,
  };
}

/**
 * Build the JSON body for a 402 "Token balance insufficient / unpriced" response.
 * Localized strings — server returns all three so the client can pick by current lang.
 */
export function chargeFailureBody(reason: ChargeResult extends { ok: false; reason: infer R } ? R : string, left?: number) {
  const map: Record<string, { ar: string; en: string; ku: string }> = {
    tool_disabled: {
      ar: "هذه الأداة معطّلة لحسابك من قِبل المسؤول.",
      en: "This tool has been disabled for your account by the admin.",
      ku: "ئەم ئامرازە لە لایەن بەڕێوەبەرەوە بۆ هەژمارەکەت لە کار خراوە.",
    },
    unpriced: {
      ar: "لم يقم المسؤول بتسعير هذه الأداة لحسابك بعد.",
      en: "This tool has not been priced for your account yet.",
      ku: "ئەم ئامرازە بۆ هەژمارەکەت نرخ دانەنراوە.",
    },
    balance: {
      ar: "رصيد التوكن غير كافٍ.",
      en: "Token balance insufficient.",
      ku: "بەڵانسی تۆکن کەمە.",
    },
    daily_limit: {
      ar: "تجاوزت الحدّ اليومي للتوكن.",
      en: "Daily token limit reached.",
      ku: "سنووری ڕۆژانە تەواو بووە.",
    },
    monthly_limit: {
      ar: "تجاوزت الحدّ الشهري للتوكن.",
      en: "Monthly token limit reached.",
      ku: "سنووری مانگانە تەواو بووە.",
    },
    profile_not_found: {
      ar: "الملف الشخصي غير موجود.",
      en: "Profile not found.",
      ku: "پرۆفایل نییە.",
    },
  };
  const base = map[String(reason)] || { ar: String(reason), en: String(reason), ku: String(reason) };
  return { ok: false, reason, left, message: base };
}

export type ProbePolicy = { tokensPerEngine: number | null; maxEngines: number | null; notifyAllowed: boolean; backgroundAllowed: boolean };

/**
 * Probe (live check with selected engines) policy for one user.
 * Order: per-user override on "visibility" → app_settings.tool_run_modes → none (parent price).
 */
export async function resolveProbePolicy(userId: string): Promise<ProbePolicy> {
  const db = admin();
  let global: any = {};
  try {
    const { data } = await db.from("app_settings").select("value").eq("key", "tool_run_modes").maybeSingle();
    global = (data as any)?.value || {};
  } catch {}
  let ov: any = {};
  try {
    const { data } = await db.from("profiles").select("per_user_tool_overrides").eq("id", userId).maybeSingle();
    ov = (data as any)?.per_user_tool_overrides?.visibility || {};
  } catch {}
  const num = (v: any) => (Number(v) > 0 ? Number(v) : null);
  return {
    tokensPerEngine: num(ov.probe_tokens_per_engine) ?? num(global.probe_tokens_per_engine),
    maxEngines: num(ov.max_engines) ?? num(global.probe_max_engines),
    notifyAllowed: ov.notify_allowed === false ? false : global.notify_allowed !== false,
    backgroundAllowed: ov.background_allowed === false ? false : global.background_allowed !== false,
  };
}
