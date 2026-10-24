// Client-safe RPC: expected cost of a tool (or sub-operation) before running it.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ENGINE_KEYS } from "@/lib/ai-engines";

export type CostPreview = {
  metered: boolean;
  balance: number;
  perUnit: number;
  units: number;
  total: number;
  source: string;
  enough: boolean;
  maxEngines: number | null;
  notifyAllowed: boolean;
  backgroundAllowed: boolean;
  /** Remaining daily quota in tokens, or null when no daily limit is set. */
  dailyRemaining: number | null;
  /** Remaining monthly quota in tokens, or null when no monthly limit is set. */
  monthlyRemaining: number | null;
};

export const getCostPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { toolKey: string; units?: number }) => ({
    toolKey: String(d?.toolKey || "").slice(0, 60),
    units: Math.max(1, Math.min(ENGINE_KEYS.length * (String(d?.toolKey || "") === "visibility.probe" ? 2 : 1), Math.round(Number(d?.units) || 1))),
  }))
  .handler(async ({ data, context }): Promise<CostPreview> => {
    const { resolveToolCost, resolveProbePolicy } = await import("@/lib/tokens.server");
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("tokens_balance, tokens_daily_limit, tokens_monthly_limit, tokens_used_today, tokens_used_month, usage_day_start, usage_period_start")
      .eq("id", context.userId)
      .maybeSingle();
    const balance = Number((prof as any)?.tokens_balance) || 0;
    const metered = balance > 0 || (prof as any)?.tokens_daily_limit != null || (prof as any)?.tokens_monthly_limit != null;
    const cost = await resolveToolCost(context.userId, data.toolKey);
    const policy = data.toolKey === "visibility.probe" ? await resolveProbePolicy(context.userId) : null;
    const perUnit = policy?.tokensPerEngine ?? cost.tokens;
    const total = perUnit * data.units;
    // Usage counters roll over in the database when the day/month changes;
    // a stale counter is treated as zero remaining-usage for the current period.
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 8) + "01";
    const usedToday = String((prof as any)?.usage_day_start || "").slice(0, 10) === today ? Number((prof as any)?.tokens_used_today) || 0 : 0;
    const usedMonth = String((prof as any)?.usage_period_start || "").slice(0, 10) === monthStart ? Number((prof as any)?.tokens_used_month) || 0 : 0;
    const dailyLimit = (prof as any)?.tokens_daily_limit;
    const monthlyLimit = (prof as any)?.tokens_monthly_limit;
    return {
      metered,
      balance,
      perUnit,
      units: data.units,
      total,
      source: String(cost.source),
      enough: !metered || balance >= total,
      maxEngines: policy?.maxEngines ?? null,
      notifyAllowed: policy?.notifyAllowed ?? true,
      backgroundAllowed: policy?.backgroundAllowed ?? true,
      dailyRemaining: dailyLimit != null ? Math.max(0, Number(dailyLimit) - usedToday) : null,
      monthlyRemaining: monthlyLimit != null ? Math.max(0, Number(monthlyLimit) - usedMonth) : null,
    };
  });
