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
  dailyRemaining: number | null;
  monthlyRemaining: number | null;
  maxEngines: number | null;
  notifyAllowed: boolean;
  backgroundAllowed: boolean;
};

export const getCostPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { toolKey: string; units?: number }) => ({
    toolKey: String(d?.toolKey || "").slice(0, 60),
    units: Math.max(1, Math.min(ENGINE_KEYS.length, Math.round(Number(d?.units) || 1))),
  }))
  .handler(async ({ data, context }): Promise<CostPreview> => {
    const { resolveToolCost, resolveProbePolicy } = await import("@/lib/tokens.server");
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("tokens_balance, tokens_daily_limit, tokens_monthly_limit, tokens_used_today, tokens_used_month")
      .eq("id", context.userId)
      .maybeSingle();
    const balance = Number((prof as any)?.tokens_balance) || 0;
    const metered = balance > 0 || (prof as any)?.tokens_daily_limit != null || (prof as any)?.tokens_monthly_limit != null;
    const cost = await resolveToolCost(context.userId, data.toolKey);
    const policy = data.toolKey === "visibility.probe" ? await resolveProbePolicy(context.userId) : null;
    const units = policy?.maxEngines != null ? Math.min(data.units, policy.maxEngines) : data.units;
    const perUnit = policy?.tokensPerEngine ?? cost.tokens;
    const total = perUnit * units;
    const dailyRemaining = (prof as any)?.tokens_daily_limit == null ? null : Math.max(0, Number((prof as any).tokens_daily_limit) - (Number((prof as any).tokens_used_today) || 0));
    const monthlyRemaining = (prof as any)?.tokens_monthly_limit == null ? null : Math.max(0, Number((prof as any).tokens_monthly_limit) - (Number((prof as any).tokens_used_month) || 0));
    const pricedOrLegacyFree = !metered || cost.source !== "unpriced";
    const enabled = (cost.source as string) !== "disabled_by_admin";
    const enough = enabled && pricedOrLegacyFree && (!metered || (balance >= total && (dailyRemaining == null || dailyRemaining >= total) && (monthlyRemaining == null || monthlyRemaining >= total)));
    return {
      metered,
      balance,
      perUnit,
      units,
      total,
      source: String(cost.source),
      enough,
      dailyRemaining,
      monthlyRemaining,
      maxEngines: policy?.maxEngines ?? null,
      notifyAllowed: policy?.notifyAllowed ?? true,
      backgroundAllowed: policy?.backgroundAllowed ?? true,
    };
  });
