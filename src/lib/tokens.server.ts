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
import { resolveScopedAccessMode } from "@/lib/maaroof/skill-access-policy";
import { MAAROOF_SKILLS, defaultSkillAccessPolicy } from "@/lib/maaroof/skill-catalog";

export type ResolvedCost = { tokens: number; usd: number; source: "user_override" | "plan" | "unpriced" };
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


type AccessMode = "self_service" | "contact" | "disabled";
function validAccessMode(value: unknown): value is AccessMode {
  return value === "self_service" || value === "contact" || value === "disabled";
}

/** Tool licensing is checked before metering, so a no-token-meter account cannot bypass sales gates. */
async function resolveToolAccessMode(userId: string, toolKey: string): Promise<AccessMode> {
  const db = admin();
  const [{ data: settingsRow, error: settingsError }, { data: profile, error: profileError }] = await Promise.all([
    db.from("app_settings").select("value").eq("key", "user_interface_policy").maybeSingle(),
    db.from("profiles").select("subscription_tier,is_subscribed,subscription_expires_at").eq("id", userId).maybeSingle(),
  ]);
  // If policy lookup fails, fail closed rather than bypassing licensing.
  if (settingsError || profileError) return "disabled";
  const value = (settingsRow as any)?.value || {};
  const planActive = !!(profile as any)?.is_subscribed &&
    (!(profile as any)?.subscription_expires_at || new Date((profile as any).subscription_expires_at).getTime() > Date.now());
  const planKey = planActive ? String((profile as any)?.subscription_tier || "").trim().toLocaleLowerCase() : "";
  const globalPolicy = value.tool_access && typeof value.tool_access === "object" ? value.tool_access : {};
  const byPlan = value.tool_access_by_plan && typeof value.tool_access_by_plan === "object" ? value.tool_access_by_plan : {};
  const byUser = value.tool_access_by_user && typeof value.tool_access_by_user === "object" ? value.tool_access_by_user : {};
  const globalSkillPolicy = value.skill_access && typeof value.skill_access === "object" ? value.skill_access : defaultSkillAccessPolicy();
  const planSkillPolicy = value.skill_access_by_plan && typeof value.skill_access_by_plan === "object" ? value.skill_access_by_plan : {};
  const userSkillPolicy = value.skill_access_by_user && typeof value.skill_access_by_user === "object" ? value.skill_access_by_user : {};
  const skillMode = (skillKey: string) => resolveScopedAccessMode({
    key: skillKey, globalPolicy: globalSkillPolicy, byPlan: planSkillPolicy, byUser: userSkillPolicy, planKey, userId,
  });
  const explicit = (key: string): AccessMode | undefined => {
    const candidates = [byUser?.[userId]?.[key], planKey ? byPlan?.[planKey]?.[key] : undefined, globalPolicy?.[key]];
    return candidates.find(validAccessMode);
  };
  const exact = explicit(toolKey);
  if (exact) return exact;
  if (toolKey.includes(".")) {
    const parent = explicit(toolKey.split(".")[0]);
    if (parent) return parent;
  }
  // No explicit tool override exists; inherit a gate only when every skill mapped
  // to this tool is gated. Shared tools remain available through a self-service skill.
  const baseToolKey = toolKey.includes(".") ? toolKey.split(".")[0] : toolKey;
  const mappedSkills = MAAROOF_SKILLS.filter(skill => skill.tools.includes(baseToolKey as any));
  if (mappedSkills.length) {
    const enabledSkillKeys = Array.isArray(value.enabled_skills)
      ? value.enabled_skills
      : MAAROOF_SKILLS.map(skill => skill.key);
    const activeMappedSkills = mappedSkills.filter(skill => enabledSkillKeys.includes(skill.key));
    // The global enabled-skills list is a hard allow-list for direct tool calls.
    if (activeMappedSkills.length === 0) return "disabled";
    const modes = activeMappedSkills.map(skill => skillMode(skill.key));
    if (modes.every(mode => mode === "disabled")) return "disabled";
    if (modes.every(mode => mode === "contact" || mode === "disabled")) return "contact";
  }
  return "self_service";
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
    return { tokens: 0, usd: 0, source: "disabled_by_admin" as any };
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
      if (tpa && (tpa as any).enabled && (Number((tpa as any).tokens_per_use) > 0 || Number((tpa as any).usd_per_use) > 0)) {
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
  const accessMode = await resolveToolAccessMode(opts.userId, opts.toolKey);
  if (accessMode === "contact") return { ok: false, reason: "sales_contact_required" };
  if (accessMode === "disabled") return { ok: false, reason: "tool_disabled" };
  const { data: prof } = await db
    .from("profiles")
    .select("tokens_balance, tokens_daily_limit, tokens_monthly_limit")
    .eq("id", opts.userId)
    .maybeSingle();
  if (!prof) return { ok: false, reason: "profile_not_found" };

  const hasMeter =
    Number((prof as any).tokens_balance) > 0 ||
    (prof as any).tokens_daily_limit != null ||
    (prof as any).tokens_monthly_limit != null;

  // No metering configured for this user → skip token system entirely.
  if (!hasMeter) {
    return { ok: true, balance: 0, used_today: 0, used_month: 0, tokens: 0, usd: 0, source: "unpriced" };
  }

  const cost = await resolveToolCost(opts.userId, opts.toolKey);
  if ((cost.source as any) === "disabled_by_admin") {
    return { ok: false, reason: "tool_disabled" };
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
    sales_contact_required: {
      ar: "هذه الميزة تتطلب ترخيصاً مخصصاً. تواصل معنا لمعرفة خيارات التفعيل.",
      en: "This feature requires a dedicated license. Contact us to discuss activation.",
      ku: "ئەم تایبەتمەندییە پێویستی بە مۆڵەتی تایبەت هەیە؛ پەیوەندیمان پێوە بکە.",
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
  return { ok: false, reason, left, message: base, ...(String(reason) === "sales_contact_required" ? { contact_url: "/contact" } : {}) };
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
