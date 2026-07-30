// Parts 9-11 admin surface — Expert Academy, Learning Budget, Knowledge Observatory.
// Thin wrapper module: no runtime helpers at module scope (server-fn splitting).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Overview of every expert: registry entry + what Maaroof has learned. */
export const listExpertAcademy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { TOOL_CATALOG } = await import("@/lib/tool-catalog");
    const { data: profiles } = await supabase.from("expert_understanding_v").select("*");
    const { data: sessions } = await supabase
      .from("expert_learning_sessions")
      .select("id, expert_key, version, status, understanding_score, tokens, usd, zero_cost_reason, duration_ms, created_at, error")
      .order("created_at", { ascending: false })
      .limit(30);

    const byKey = new Map(((profiles as any[]) || []).map((p) => [p.expert_key, p]));
    const experts = TOOL_CATALOG.filter((t) => !t.key.startsWith("agent.")).map((t) => {
      const p: any = byKey.get(t.key);
      return {
        key: t.key,
        label: t.labels?.ar || t.key,
        group: (t as any).group || "tool",
        learned: !!p,
        version: p?.version ?? 0,
        status: p?.status ?? "unlearned",
        understanding_score: Number(p?.understanding_score ?? 0),
        confidence: Number(p?.confidence ?? 0),
        sessions: Number(p?.total_sessions ?? 0),
        usd: Number(p?.total_usd ?? 0),
        last_learned_at: p?.last_learned_at ?? null,
        coverage: {
          knowledge: Number(p?.knowledge_coverage ?? 0),
          capability: Number(p?.capability_coverage ?? 0),
          reasoning: Number(p?.reasoning_coverage ?? 0),
          memory: Number(p?.memory_coverage ?? 0),
          decision: Number(p?.decision_coverage ?? 0),
          cooperation: Number(p?.cooperation_score ?? 0),
        },
      };
    });

    const learned = experts.filter((e) => e.learned);
    return {
      experts,
      sessions: sessions ?? [],
      summary: {
        total: experts.length,
        learned: learned.length,
        avg_understanding: learned.length
          ? Math.round(learned.reduce((a, b) => a + b.understanding_score, 0) / learned.length)
          : 0,
        total_usd: experts.reduce((a, b) => a + b.usd, 0),
      },
    };
  });

/** Full learned profile + improvement suggestions for one expert. */
export const getExpertProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ expertKey: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: profile } = await supabase
      .from("expert_profiles")
      .select("*")
      .eq("expert_key", data.expertKey)
      .maybeSingle();
    const { data: sessions } = await supabase
      .from("expert_learning_sessions")
      .select("id, version, status, understanding_score, tokens, usd, diff, zero_cost_reason, created_at, error")
      .eq("expert_key", data.expertKey)
      .order("created_at", { ascending: false })
      .limit(10);
    return { profile: profile ?? null, sessions: sessions ?? [] };
  });

/** Run a cognitive interview. Cost is charged to the system learning budget. */
export const runExpertLearning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ expertKey: z.string().min(1), force: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
    const settings = await getMaaroofSettings();
    if (!settings.experts.enabled) return { ok: false, error: "experts_disabled" };

    // Budget guard (Part 10): learning never exceeds its own monthly ceiling.
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { data: spend } = await supabase
      .from("learning_budget_ledger")
      .select("usd")
      .gte("created_at", monthStart.toISOString());
    const spent = ((spend as any[]) || []).reduce((a, r) => a + Number(r.usd || 0), 0);
    if (spent >= settings.experts.monthly_budget_usd) {
      return { ok: false, error: "learning_budget_exhausted", spent };
    }

    const { runExpertLearningSession } = await import("@/lib/maaroof/experts.server");
    const result = await runExpertLearningSession({
      expertKey: data.expertKey,
      model: settings.experts.learning_model,
      trigger: "manual",
      force: !!data.force,
      createdBy: userId,
    });

    if (result.ok && settings.knowledge.enabled) {
      const { syncExpertKnowledge } = await import("@/lib/maaroof/knowledge.server");
      await syncExpertKnowledge(settings.knowledge.freshness_days);
    }
    return result;
  });

/** Learning spend, by day and purpose — separate from user token spend. */
export const getLearningBudget = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: daily } = await supabase.from("learning_budget_v").select("*").limit(60);
    const { data: recent } = await supabase
      .from("learning_budget_ledger")
      .select("id, purpose, expert_key, model, tokens, usd, cache_hit, zero_cost_reason, latency_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    const rows = (daily as any[]) || [];
    return {
      daily: rows,
      recent: recent ?? [],
      total_usd: rows.reduce((a, r) => a + Number(r.usd || 0), 0),
      total_tokens: rows.reduce((a, r) => a + Number(r.tokens || 0), 0),
      free_ops: rows.reduce((a, r) => a + Number(r.free_ops || 0), 0),
    };
  });

/** Knowledge Observatory: health per layer plus the strongest nodes. */
export const getKnowledgeObservatory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: health } = await supabase.from("knowledge_health_v").select("*");
    const { data: top } = await supabase
      .from("knowledge_nodes")
      .select("id, layer, node_key, title, summary, confidence, reliability, quality, usage_count, status, freshness_at, version")
      .order("quality", { ascending: false })
      .limit(25);
    return { health: health ?? [], top: top ?? [] };
  });

/** Rebuild the "expert" knowledge layer from learned profiles. */
export const syncKnowledgeLayers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
    const settings = await getMaaroofSettings();
    const { syncExpertKnowledge } = await import("@/lib/maaroof/knowledge.server");
    const synced = await syncExpertKnowledge(settings.knowledge.freshness_days);
    return { ok: true, synced };
  });
