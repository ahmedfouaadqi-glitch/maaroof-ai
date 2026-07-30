// Client-safe RPC around the nine-engine entitlement + governed model map.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ENGINE_KEYS, type EngineKey } from "@/lib/ai-engines";

export type EngineEntitlementView = {
  plan: string | null;
  isAdmin: boolean;
  limit: number;
  allowed: EngineKey[];
  locked: EngineKey[];
  models: Record<string, { model: string; governed: boolean; proxy: boolean }>;
};

/** What the signed-in user may run, plus the model behind each engine today. */
export const getEngineEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EngineEntitlementView> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enginesAllowedForUser, resolveEngineModels } = await import("@/lib/ai-engines.server");
    const ent = await enginesAllowedForUser(supabaseAdmin, context.userId);
    const resolved = await resolveEngineModels([...ENGINE_KEYS], "final");
    const models: EngineEntitlementView["models"] = {};
    for (const [k, v] of Object.entries(resolved)) {
      models[k] = { model: v.model, governed: v.governed, proxy: v.proxy };
    }
    return {
      plan: ent.plan,
      isAdmin: ent.isAdmin,
      limit: ent.limit,
      allowed: ent.allowed,
      locked: ent.locked,
      models,
    };
  });
