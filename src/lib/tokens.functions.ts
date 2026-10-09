// Client-safe RPC: expected cost of a tool (or sub-operation) before running it.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
};

export const getCostPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { toolKey: string; units?: number }) => ({
    toolKey: String(d?.toolKey || "").slice(0, 60),
    units: Math.max(1, Math.min(9, Math.round(Number(d?.units) || 1))),
  }))
  .handler(async ({ data, context }): Promise<CostPreview> => {
    const { resolveToolCost, resolveProbePolicy } = await import("@/lib/tokens.server");
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("tokens_balance, tokens_daily_limit, tokens_monthly_limit")
      .eq("id", context.userId)
      .maybeSingle();
    const balance = Number((prof as any)?.tokens_balance) || 0;
    const metered = balance > 0 || (prof as any)?.tokens_daily_limit != null || (prof as any)?.tokens_monthly_limit != null;
    const cost = await resolveToolCost(context.userId, data.toolKey);
    const policy = data.toolKey === "visibility.probe" ? await resolveProbePolicy(context.userId) : null;
    const perUnit = policy?.tokensPerEngine ?? cost.tokens;
    const total = perUnit * data.units;
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
    };
  });
