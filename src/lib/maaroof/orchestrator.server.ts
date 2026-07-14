// Maaroof orchestrator: Plan → Act → Reflect over the existing 16 tool endpoints.
// Direct fetch to Lovable AI Gateway + internal HTTP to /api/* routes (worker-internal).
import { createClient } from "@supabase/supabase-js";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders, extractJsonObject } from "@/lib/lovable-ai";
import { TOOL_CATALOG, findExpertsByCapability, type Capability, type ToolDef } from "@/lib/tool-catalog";
import { recall, remember } from "./memory.server";
import type { DetectedGeo, GeoScope } from "./geo.server";
import { effectiveGeo } from "./geo.server";
import { getMaaroofSettings } from "./settings.server";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return _db as any;
}

// Map tool keys -> internal API path + body builder
type ToolCall = { tool: string; input: any; reason?: string };
type PlanStep = ToolCall;

function toolPath(toolKey: string): string | null {
  const map: Record<string, string> = {
    analyze: "/api/analyze",
    suggest: "/api/suggest",
    compare: "/api/compare",
    feasibility: "/api/feasibility",
    bizdev: "/api/bizdev",
    research: "/api/research",
    visibility: "/api/visibility",
    brand_boost: "/api/brand-boost",
    company_email: "/api/company-email",
    applied_ranking: "/api/applied-ranking",
    geo_strategist: "/api/geo-strategist",
    competitor_monitor: "/api/competitor-monitor",
    social_analysis: "/api/social-analysis",
    what_if: "/api/what-if",
    brand_authority: "/api/brand-authority",
    geo_rewrite: "/api/geo-rewrite",
  };
  return map[toolKey] || null;
}

function toolsDescription(): string {
  return TOOL_CATALOG.filter((t) => t.group === "tools")
    .map((t) => `- ${t.key}: ${t.labels.en}`)
    .join("\n");
}

export type RunContext = {
  userId: string;
  goal: string;
  language: "ar" | "en" | "ku";
  detectedGeo: DetectedGeo;
  geoScope?: GeoScope;
  workspaceId?: string | null;
  authBearer: string; // forwarded to internal /api calls
  origin: string;     // base URL for internal fetches
  emit: (event: string, data: any) => Promise<void>;
  signal: AbortSignal;
};

export async function runMaaroof(ctx: RunContext): Promise<{ runId: string }> {
  const apiKey = process.env.LOVABLE_API_KEY!;
  const settings = await getMaaroofSettings();
  if (settings.kill_switch) {
    await ctx.emit("error", { message: "تم تعطيل معروف مؤقتاً من قبل الإدارة." });
    throw new Error("maaroof_disabled");
  }
  const MODEL = settings.planner_model;
  const MAX_STEPS = settings.max_steps;
  const geo = effectiveGeo(ctx.detectedGeo, ctx.geoScope);


  // 1) Create run row
  const { data: runIns, error: runErr } = await db()
    .from("maaroof_runs")
    .insert({
      user_id: ctx.userId,
      workspace_id: ctx.workspaceId || null,
      goal: ctx.goal,
      status: "running",
      detected_geo: ctx.detectedGeo,
      geo_scope: ctx.geoScope || { mode: "auto" },
      language: ctx.language,
      model: MODEL,
    })
    .select("id")
    .single();
  if (runErr || !runIns) throw new Error(runErr?.message || "run_create_failed");
  const runId = (runIns as any).id as string;
  await ctx.emit("run", { runId, geo });

  let totalUsd = 0;
  let totalTokens = 0;

  const logMsg = async (role: string, parts: any, tokens = 0, usd = 0) => {
    await db().from("maaroof_messages").insert({ run_id: runId, role, parts, tokens, usd });
  };
  await logMsg("user", { text: ctx.goal });

  try {
    // 2) Recall memory
    const memories = await recall(ctx.userId, ctx.goal, 10);
    if (memories.length) await ctx.emit("memory", { items: memories });

    const baseSystemPrompt = buildSystemPrompt(ctx, geo, memories);
    const systemPrompt = settings.system_prompt_extra ? `${baseSystemPrompt}\n\n[Admin guidance]\n${settings.system_prompt_extra}` : baseSystemPrompt;

    // 3) PLAN
    await ctx.emit("phase", { phase: "planning" });
    const planResp = await callGateway(apiKey, MODEL, [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Goal: ${ctx.goal}\n\nProduce a JSON plan: { "steps": [ { "tool": "<one of the available tool keys>", "input": { ... }, "reason": "..." } ], "final_answer_hint": "..." }\nUse 1-6 steps. Only use tool keys from the list. Return JSON only.`,
      },
    ], { signal: ctx.signal });
    totalUsd += planResp.usd; totalTokens += planResp.tokens;
    const planObj = extractJsonObject<{ steps: PlanStep[]; final_answer_hint?: string }>(planResp.text) || { steps: [] };
    const steps = Array.isArray(planObj.steps) ? planObj.steps.slice(0, MAX_STEPS) : [];
    await db().from("maaroof_runs").update({ plan: planObj }).eq("id", runId);
    await logMsg("plan", planObj, planResp.tokens, planResp.usd);
    await ctx.emit("plan", { plan: planObj });

    // 4) EXECUTE
    const results: Array<{ tool: string; ok: boolean; output: any }> = [];
    for (let i = 0; i < steps.length; i++) {
      if (ctx.signal.aborted) break;
      const step = steps[i];
      await ctx.emit("tool_call", { index: i, tool: step.tool, input: step.input, reason: step.reason });
      await logMsg("tool_call", step);

      const path = toolPath(step.tool);
      if (!path || (settings.enabled_tools.length && !settings.enabled_tools.includes(step.tool))) {
        const err = { error: path ? "tool_disabled" : "unknown_tool", tool: step.tool };
        results.push({ tool: step.tool, ok: false, output: err });
        await ctx.emit("tool_result", { index: i, tool: step.tool, ok: false, output: err });
        await logMsg("tool_result", err);
        continue;
      }
      try {
        const body = { ...(step.input || {}), scope: geo.country ? { scope: geo.city ? "city" : "country", country: geo.country, city: geo.city } : { scope: "world" }, lang: ctx.language };
        const toolCtl = new AbortController();
        const toolTimer = setTimeout(() => toolCtl.abort(), settings.tool_timeout_ms);
        const onAbort = () => toolCtl.abort();
        ctx.signal.addEventListener("abort", onAbort);
        let resp: Response;
        try {
          resp = await fetch(`${ctx.origin}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: ctx.authBearer },
            body: JSON.stringify(body),
            signal: toolCtl.signal,
          });
        } finally {
          clearTimeout(toolTimer);
          ctx.signal.removeEventListener("abort", onAbort);
        }
        const json = await resp.json().catch(() => ({}));
        const ok = resp.ok;
        results.push({ tool: step.tool, ok, output: json });
        await ctx.emit("tool_result", { index: i, tool: step.tool, ok, output: json });
        await logMsg("tool_result", { tool: step.tool, ok, output: json });
        // Record tool usage in token_ledger for finance/health tracking.
        try {
          await db().from("token_ledger").insert({
            user_id: ctx.userId,
            tool_key: `maaroof.${step.tool}`,
            tokens: 0,
            usd_cost: 0,
            run_id: runId,
            meta: { maaroof_run_id: runId, step_index: i, tool: step.tool, geo: { country: geo.country, city: geo.city }, ok },
          });
        } catch {}
      } catch (e: any) {
        const err = { error: String(e?.message || e) };
        results.push({ tool: step.tool, ok: false, output: err });
        await ctx.emit("tool_result", { index: i, tool: step.tool, ok: false, output: err });
        await logMsg("tool_result", err);
      }

      // Reflect every 3 steps
      if ((i + 1) % 3 === 0 && i < steps.length - 1) {
        const ref = await callGateway(apiKey, MODEL, [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Progress so far:\n${JSON.stringify(results).slice(0, 4000)}\n\nShould we continue, adjust, or stop? Reply briefly.` },
        ], { signal: ctx.signal });
        totalUsd += ref.usd; totalTokens += ref.tokens;
        await ctx.emit("reflection", { text: ref.text });
        await logMsg("reflection", { text: ref.text }, ref.tokens, ref.usd);
      }
    }

    // 5) FINAL ANSWER
    await ctx.emit("phase", { phase: "summarizing" });
    const finalResp = await callGateway(apiKey, MODEL, [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Goal: ${ctx.goal}\n\nTool results:\n${JSON.stringify(results).slice(0, 8000)}\n\nWrite the final answer for the user in ${ctx.language === "ar" ? "Arabic" : ctx.language === "ku" ? "Kurdish" : "English"}. Be specific, actionable, tailored to ${geo.label}. Use Markdown.` },
    ], { signal: ctx.signal });
    totalUsd += finalResp.usd; totalTokens += finalResp.tokens;
    await ctx.emit("final", { text: finalResp.text });
    await logMsg("assistant", { text: finalResp.text }, finalResp.tokens, finalResp.usd);

    // 6) Persist totals + summarize to memory + ledger LLM cost
    await db().from("maaroof_runs").update({
      status: "done",
      total_tokens: totalTokens,
      total_usd: totalUsd,
      steps_count: steps.length,
      finished_at: new Date().toISOString(),
    }).eq("id", runId);

    try {
      await db().from("token_ledger").insert({
        user_id: ctx.userId,
        tool_key: "maaroof.llm",
        tokens: totalTokens,
        usd_cost: totalUsd,
        run_id: runId,
        meta: { maaroof_run_id: runId, model: MODEL, geo: { country: geo.country, city: geo.city }, steps: steps.length },
      });
    } catch {}

    await remember({ userId: ctx.userId, runId, kind: "summary", content: `Goal: ${ctx.goal}\nResult: ${String(finalResp.text).slice(0, 500)}`, importance: 3 });
    if (geo.country) await remember({ userId: ctx.userId, runId, kind: "preference", content: `User location: ${geo.label}`, importance: 4 });

    await ctx.emit("done", { runId, totalUsd, totalTokens, steps: steps.length });
    return { runId };
  } catch (e: any) {
    await db().from("maaroof_runs").update({ status: "error", error: String(e?.message || e), finished_at: new Date().toISOString() }).eq("id", runId);
    await ctx.emit("error", { message: String(e?.message || e) });
    throw e;
  }
}

function buildSystemPrompt(ctx: RunContext, geo: { country: string; city?: string; label: string }, memories: string[]): string {
  const memBlock = memories.length ? `\n\nLong-term memory about this user:\n${memories.slice(0, 10).join("\n")}` : "";
  return `أنت "معروف" — وكيل ذكي محترف للتسويق الرقمي وتحسين الظهور في محركات البحث الذكية (GEO) حول العالم.
You are "Maaroof" — a Manus-style intelligent agent that PLANS, USES TOOLS, and REFLECTS to achieve the user's goal.

User location/scope: ${geo.label || "World"} (country=${geo.country || "—"}, city=${geo.city || "—"})
Tailor every step to this market: language, currency, competitors, channels, regulations, culture.

Available tools (call by exact key):
${toolsDescription()}

Rules:
- Be evidence-based; never invent facts, numbers, or sources.
- Prefer 2-5 well-chosen tool steps over many shallow ones.
- For each tool, provide minimal valid input; the executor injects "scope" and "lang" automatically.
- Reply concisely in JSON when asked.${memBlock}`;
}

async function callGateway(apiKey: string, model: string, messages: any[], opts: { signal?: AbortSignal } = {}): Promise<{ text: string; tokens: number; usd: number }> {
  const resp = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: lovableAiHeaders(apiKey),
    body: JSON.stringify({ model, messages }),
    signal: opts.signal,
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`gateway_${resp.status}: ${t.slice(0, 200)}`);
  }
  const j: any = await resp.json();
  const text = j?.choices?.[0]?.message?.content || "";
  const usage = j?.usage || {};
  const tokens = Number(usage.total_tokens || 0);
  // Rough USD estimate from gateway response header if absent (Gemini 2.5 Pro pricing approx)
  const inTok = Number(usage.prompt_tokens || 0);
  const outTok = Number(usage.completion_tokens || 0);
  const usd = inTok * 1.25e-6 + outTok * 10e-6; // $1.25/M in, $10/M out
  return { text, tokens, usd };
}
