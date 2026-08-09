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

/** Execution Inspector — recent executions with per-task accountability. */
export const getExecutionInspector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { state?: string; limit?: number }) =>
    z.object({ state: z.string().max(40).optional(), limit: z.number().int().min(1).max(100).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: execs } = await supabaseAdmin
      .from("executions")
      .select("id, goal, mode, status, reality_state, outcome_score, cost_usd, tokens, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 25);
    const ids = ((execs as any[]) || []).map((e) => e.id);
    let tasks: any[] = [];
    if (ids.length) {
      let q = supabaseAdmin
        .from("execution_tasks")
        .select("id, execution_id, seq, title, status, verification_state, execution_kind, result_kind, provider, duration_ms, cost_usd, tokens, error")
        .in("execution_id", ids)
        .order("seq");
      if (data.state) q = q.eq("verification_state", data.state);
      const { data: rows } = await q.limit(1000);
      tasks = (rows as any[]) || [];
    }
    const { rollupTasks } = await import("@/lib/maaroof/truth");
    const executions = ((execs as any[]) || []).map((e) => {
      const own = tasks.filter((t) => t.execution_id === e.id);
      return { ...e, tasks: own, rollup: rollupTasks(own) };
    });
    return { executions };
  });
