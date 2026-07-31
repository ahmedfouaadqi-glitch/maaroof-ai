// Part 19 — Reality Execution & Verification: admin surface.
// Thin wrapper module: no runtime helpers at module scope (server-fn splitting).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Aggregated reality states, loop stages and verification gaps. */
export const getRealityCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { realityOverview } = await import("@/lib/maaroof/reality.server");
    const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
    const [overview, settings] = await Promise.all([realityOverview(200), getMaaroofSettings()]);
    return { ...overview, settings: (settings as any).reality_engine };
  });

/** Evidence items behind one reality record — the audit drill-down. */
export const getRealityEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { recordId: string }) => z.object({ recordId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: items } = await supabaseAdmin
      .from("evidence_items")
      .select("id, claim, source_kind, source_ref, weight, reproducible, contradicts, verified_at, success_count, created_at")
      .eq("reality_record_id", data.recordId)
      .order("weight", { ascending: false })
      .limit(200);
    return { items: (items as any[]) || [] };
  });
