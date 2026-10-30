// Client-safe RPC around the ten-engine entitlement + governed model map.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ENGINE_KEYS, type EngineKey } from "@/lib/ai-engines";

export type EngineStatusView = {
  status: "ok" | "slow" | "error" | "unknown";
  avg_latency_ms: number;
  calls: number;
  last_call_at: string | null;
};

export type EngineEntitlementView = {
  plan: string | null;
  isAdmin: boolean;
  limit: number;
  allowed: EngineKey[];
  locked: EngineKey[];
  models: Record<string, { model: string; governed: boolean; proxy: boolean }>;
  /** Live health per engine, so a failing provider is visible before a run. */
  health: Record<string, EngineStatusView>;
};

/** What the signed-in user may run, plus the model and health behind each engine today. */
export const getEngineEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EngineEntitlementView> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enginesAllowedForUser, resolveEngineModels, engineHealthMap } = await import("@/lib/ai-engines.server");
    const ent = await enginesAllowedForUser(supabaseAdmin, context.userId);
    const resolved = await resolveEngineModels([...ENGINE_KEYS], "final");
    const models: EngineEntitlementView["models"] = {};
    for (const [k, v] of Object.entries(resolved)) {
      models[k] = { model: v.model, governed: v.governed, proxy: v.proxy };
    }
    const health: Record<string, EngineStatusView> = {};
    try {
      const hm = await engineHealthMap([...ENGINE_KEYS]);
      for (const [k, v] of Object.entries(hm)) {
        // No error text for non-admins: status + timing only.
        health[k] = {
          status: v.status,
          avg_latency_ms: v.avg_latency_ms,
          calls: v.calls,
          last_call_at: v.last_call_at,
        };
      }
    } catch {
      /* health is advisory only */
    }
    return {
      plan: ent.plan,
      isAdmin: ent.isAdmin,
      limit: ent.limit,
      allowed: ent.allowed,
      locked: ent.locked,
      models,
      health,
    };
  });
