// Parts 12-13 admin surface — AI Model Center + Executive Decision Center.
// Thin wrapper module: no runtime helpers at module scope (server-fn splitting).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Registry + health + proposals + latest benchmarks in one payload. */
export const getModelCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: models } = await supabase
      .from("ai_models")
      .select("*")
      .order("status", { ascending: true })
      .order("model_key", { ascending: true });
    const { data: health } = await supabase.from("ai_model_health").select("*");
    const { data: proposals } = await supabase
      .from("ai_model_proposals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    const { data: benchmarks } = await supabase
      .from("ai_model_benchmarks")
      .select("id, batch_id, task, model_key, accuracy, reasoning_score, latency_ms, tokens, usd, error, created_at")
      .order("created_at", { ascending: false })
      .limit(40);

    const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
    const settings = await getMaaroofSettings();

    const byKey = new Map(((health as any[]) || []).map((h) => [h.model_key, h]));
    const rows = ((models as any[]) || []).map((m) => {
      const h: any = byKey.get(m.model_key) || {};
      const calls = Number(h.calls || 0);
      return {
        ...m,
        calls,
        failures: Number(h.failures || 0),
        success_rate: calls ? Math.round(((calls - Number(h.failures || 0)) / calls) * 100) : null,
        avg_latency_ms: calls ? Math.round(Number(h.total_latency_ms || 0) / calls) : null,
        total_usd: Number(h.total_usd || 0),
        total_tokens: Number(h.total_tokens || 0),
        last_call_at: h.last_call_at || null,
        last_error: h.last_error || null,
      };
    });

    return {
      models: rows,
      proposals: proposals ?? [],
      benchmarks: benchmarks ?? [],
      governance: settings.model_governance,
      defaults: { planner_model: settings.planner_model, fallback_model: settings.fallback_model },
    };
  });

/** Approve or reject a model proposal. Activation stays a human decision. */
export const reviewModelProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), decision: z.enum(["approved", "rejected"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase
      .from("ai_model_proposals")
      .update({ status: data.decision, reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Ask Maaroof to scan the registry and file a proposal if a better model exists. */
export const scanModelUpgrades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
    const settings = await getMaaroofSettings();
    const { proposeModelUpgrade } = await import("@/lib/maaroof/models.server");
    const id = await proposeModelUpgrade(settings.planner_model);
    return { ok: true, proposal_id: id };
  });

/** Run the same task across selected models and record the comparison. */
export const runModelBenchmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ task: z.string().min(4).max(2000), models: z.array(z.string().min(1)).min(1).max(4) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
    const settings = await getMaaroofSettings();
    if (!settings.model_governance?.benchmark_enabled) return { ok: false, error: "benchmark_disabled" };

    const { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders } = await import("@/lib/lovable-ai");
    const { loadModelRegistry, costOf, recordModelCall } = await import("@/lib/maaroof/models.server");
    const registry = await loadModelRegistry(true);
    const apiKey = process.env.LOVABLE_API_KEY!;
    const batchId = crypto.randomUUID();
    const rows: any[] = [];

    for (const model of data.models) {
      const t0 = Date.now();
      try {
        const resp = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: lovableAiHeaders(apiKey),
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: "You are a GEO/AI-visibility expert. Answer concisely and concretely." },
              { role: "user", content: data.task },
            ],
          }),
        });
        const latency = Date.now() - t0;
        if (!resp.ok) throw new Error(`gateway_${resp.status}`);
        const j: any = await resp.json();
        const text = j?.choices?.[0]?.message?.content || "";
        const usage = j?.usage || {};
        const tokens = Number(usage.total_tokens || 0);
        const usd = costOf(model, Number(usage.prompt_tokens || 0), Number(usage.completion_tokens || 0), registry);
        // Deterministic proxy scores: substance density and structure.
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        const accuracy = Math.max(0, Math.min(100, Math.round(Math.min(words, 400) / 4)));
        const reasoning = Math.max(
          0,
          Math.min(100, Math.round((text.match(/\n[-*\d]/g)?.length || 0) * 8 + (words > 120 ? 40 : 20))),
        );
        rows.push({
          batch_id: batchId, task: data.task, model_key: model,
          accuracy, reasoning_score: reasoning, latency_ms: latency, tokens, usd,
          output_sample: text.slice(0, 1200), created_by: userId,
        });
        await recordModelCall({ model, ok: true, latencyMs: latency, tokens, usd });
      } catch (e: any) {
        rows.push({
          batch_id: batchId, task: data.task, model_key: model,
          latency_ms: Date.now() - t0, error: String(e?.message || e).slice(0, 300), created_by: userId,
        });
        await recordModelCall({ model, ok: false, latencyMs: Date.now() - t0, error: String(e?.message || e) });
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_model_benchmarks").insert(rows as any);
    await supabaseAdmin
      .from("ai_models")
      .update({ last_evaluated_at: new Date().toISOString() })
      .in("model_key", data.models);
    return { ok: true, batch_id: batchId, rows };
  });

/** Decision Center: runs with their pipeline traces, filterable. */
export const getDecisionCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().max(200).optional(),
        stage: z.string().max(40).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    let q = supabase
      .from("decision_traces")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 120);
    if (data.stage) q = q.eq("stage", data.stage);
    if (data.search) q = q.ilike("summary", `%${data.search}%`);
    const { data: traces } = await q;

    const runIds = Array.from(new Set(((traces as any[]) || []).map((t) => t.run_id).filter(Boolean)));
    let runs: any[] = [];
    if (runIds.length) {
      const { data: r } = await supabase
        .from("maaroof_runs")
        .select("id, goal, status, model, total_usd, total_tokens, steps_count, quality_score, decision_log, created_at, execution_mode")
        .in("id", runIds);
      runs = (r as any[]) || [];
    }
    return { traces: traces ?? [], runs };
  });

/** Read the full trace of a single run (for the decision tree + export). */
export const getRunDecisionTrace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: traces } = await supabase
      .from("decision_traces")
      .select("*")
      .eq("run_id", data.runId)
      .order("seq", { ascending: true });
    const { data: run } = await supabase
      .from("maaroof_runs")
      .select("id, goal, status, model, total_usd, total_tokens, steps_count, quality_score, trust, compliance, decision_log, created_at")
      .eq("id", data.runId)
      .maybeSingle();
    return { run: run ?? null, traces: traces ?? [] };
  });
