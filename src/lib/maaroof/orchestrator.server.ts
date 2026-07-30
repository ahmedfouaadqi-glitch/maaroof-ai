// Maaroof orchestrator: Plan → Act → Reflect over the existing 16 tool endpoints.
// Direct fetch to Lovable AI Gateway + internal HTTP to /api/* routes (worker-internal).
import { createClient } from "@supabase/supabase-js";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders, extractJsonObject } from "@/lib/lovable-ai";
import { TOOL_CATALOG, findExpertsByCapability, type Capability, type ToolDef } from "@/lib/tool-catalog";
import { loadCapabilityScores, buildCapabilityGraph, chooseImplementation, buildEvidenceGraph } from "./capability.server";
import { recall, remember } from "./memory.server";
import type { DetectedGeo, GeoScope } from "./geo.server";
import { effectiveGeo } from "./geo.server";
import { getMaaroofSettings } from "./settings.server";
import { getOrCreateAgent, finalizeAgent, evolvePersonality, readPersonality, personalityPromptBlock, type MaaroofAgent } from "./agents.server";
import { assessTiming, type TimingDecision } from "./timing.server";
import { readWorkspaceGenome, genomePromptBlock } from "./genome.server";
import { evaluateLaws, lawsPromptBlock, hardLawNotice, type LawEvaluation } from "./laws.server";


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

export type ExecutionMode = "simulation" | "recommendation" | "execution";

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
  /** Part 6 — three-way execution mode. Defaults to "execution" for backward compat. */
  executionMode?: ExecutionMode;
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

  // Load workspace profile if scoped — used by envision/plan/council.
  let workspaceProfile: any = null;
  if (ctx.workspaceId) {
    try {
      const { data } = await db()
        .from("workspaces")
        .select("id, name, kind, brand_url, brand_summary, keywords, language, country, city, profile, policies, goals, success_metrics, preferred_models, preferred_experts, preferred_mcp, risk_level, budget")
        .eq("id", ctx.workspaceId)
        .maybeSingle();
      workspaceProfile = data || null;
    } catch {}
  }

  // Part 6 — three-way execution mode. Backward compatible: defaults to "execution".
  const executionMode: ExecutionMode =
    settings.platform_evolution?.execution_modes_enabled && ctx.executionMode
      ? ctx.executionMode
      : "execution";

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
      execution_mode: executionMode,
    })
    .select("id")
    .single();
  if (runErr || !runIns) throw new Error(runErr?.message || "run_create_failed");
  const runId = (runIns as any).id as string;
  await ctx.emit("run", { runId, geo, executionMode });

  let totalUsd = 0;
  let totalTokens = 0;

  const logMsg = async (role: string, parts: any, tokens = 0, usd = 0) => {
    await db().from("maaroof_messages").insert({ run_id: runId, role, parts, tokens, usd });
  };
  await logMsg("user", { text: ctx.goal });

  let activeAgent: MaaroofAgent | null = null;
  try {
    // 2) Recall memory (workspace-scoped when available)
    const memories = await recall(ctx.userId, ctx.goal, 10, { workspaceId: ctx.workspaceId || null });
    if (memories.length) await ctx.emit("memory", { items: memories });

    const baseSystemPrompt = buildSystemPrompt(ctx, geo, memories, workspaceProfile);
    const systemPrompt = settings.system_prompt_extra ? `${baseSystemPrompt}\n\n[Admin guidance]\n${settings.system_prompt_extra}` : baseSystemPrompt;

    // 2.5) ENVISION — Future-Driven step (Part 2). Derive a future_goal and
    //      backward_chain BEFORE planning. Kill-switchable; returns to Part 1
    //      behaviour when disabled.
    const decisionLog: any[] = [];
    let envision: any = null;
    if (settings.council?.envision_enabled !== false) {
      try {
        await ctx.emit("phase", { phase: "envision" });
        const eResp = await callGateway(apiKey, MODEL, [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Goal: ${ctx.goal}\n\nApply Future-Driven thinking. Return JSON only:\n{ "future_goal": "<1-2 sentence outcome to aim for>", "backward_chain": ["step working backwards from the future", "..."], "success_metrics": ["..."] }\nUse the user's language (${ctx.language}).`,
          },
        ], { signal: ctx.signal });
        totalUsd += eResp.usd; totalTokens += eResp.tokens;
        envision = extractJsonObject<any>(eResp.text) || null;
        if (envision) {
          decisionLog.push({ phase: "envision", ...envision, at: new Date().toISOString() });
          await ctx.emit("envision", envision);
          await logMsg("envision", envision, eResp.tokens, eResp.usd);
        }
      } catch {}
    }

    // 3) PLAN (uses envision output when present)
    await ctx.emit("phase", { phase: "planning" });
    const planUserMsg =
      (envision ? `Future goal: ${envision.future_goal || ""}\nBackward chain: ${JSON.stringify(envision.backward_chain || []).slice(0, 1200)}\n\n` : "") +
      `Goal: ${ctx.goal}\n\nProduce a JSON plan: { "steps": [ { "tool": "<one of the available tool keys>", "input": { ... }, "reason": "..." } ], "final_answer_hint": "..." }\nUse 1-6 steps. Only use tool keys from the list. Return JSON only.`;
    const planResp = await callGateway(apiKey, MODEL, [
      { role: "system", content: systemPrompt },
      { role: "user", content: planUserMsg },
    ], { signal: ctx.signal });
    totalUsd += planResp.usd; totalTokens += planResp.tokens;
    const planObj = extractJsonObject<{ steps: PlanStep[]; final_answer_hint?: string }>(planResp.text) || { steps: [] };
    const steps = Array.isArray(planObj.steps) ? planObj.steps.slice(0, MAX_STEPS) : [];
    await db().from("maaroof_runs").update({ plan: planObj }).eq("id", runId);
    await logMsg("plan", planObj, planResp.tokens, planResp.usd);
    await ctx.emit("plan", { plan: planObj });

    // Part 6 — Recommendation mode: stop after producing the plan.
    if (executionMode === "recommendation") {
      await ctx.emit("phase", { phase: "recommendation" });
      await ctx.emit("final", { text: `**Recommended plan** (not executed):\n\n${JSON.stringify(planObj, null, 2)}` });
      await db().from("maaroof_runs").update({
        status: "done", total_tokens: totalTokens, total_usd: totalUsd,
        steps_count: 0, finished_at: new Date().toISOString(),
      }).eq("id", runId);
      await ctx.emit("done", { runId, totalUsd, totalTokens, steps: 0, executionMode });
      return { runId };
    }

    // 3.1) AGENT FACTORY — reuse a warm agent or mint a new one for this run.
    //      DNA is derived from the plan's required capabilities + workspace prefs.
    //      Backward compatible: if agent_factory.enabled is false, we skip entirely.
    // (activeAgent hoisted above the try block so catch can finalize it)
    if (settings.agent_factory?.enabled !== false) {
      try {
        const requiredCapsForDna = new Set<Capability>();
        for (const s of steps) {
          const def = TOOL_CATALOG.find((t) => t.key === s.tool);
          for (const c of def?.capabilities || []) requiredCapsForDna.add(c);
        }
        const dna = {
          capabilities: Array.from(requiredCapsForDna),
          preferred_experts: (workspaceProfile?.preferred_experts as string[]) || [],
          preferred_models: (workspaceProfile?.preferred_models as string[]) || [MODEL],
          preferred_mcp: (workspaceProfile?.preferred_mcp as string[]) || [],
          decision_style: workspaceProfile?.risk_level ? `risk:${workspaceProfile.risk_level}` : "balanced",
          thinking_style: envision ? "future-driven" : "reactive",
        };
        // Pick a concise role from the goal (first ~48 chars) — evolvable later.
        const role = (workspaceProfile?.name ? `${workspaceProfile.name} Executive` : "Maaroof Executive").slice(0, 80);
        const mission = String(ctx.goal).slice(0, 240);
        const { agent, reused } = await getOrCreateAgent({
          userId: ctx.userId,
          workspaceId: ctx.workspaceId || null,
          role,
          mission,
          dna,
          warmReuse: settings.agent_factory?.warm_reuse_enabled !== false,
          minSuccessRate: 0.5,
        });
        activeAgent = agent;
        if (agent) {
          await ctx.emit("agent", {
            id: agent.id,
            role: agent.role,
            version: agent.version,
            lifecycle_state: agent.lifecycle_state,
            reused,
            success_rate: agent.success_rate,
          });
        }
      } catch {}
    }

    // 3.2) PART 7 — Executive layer prompt enrichment (personality + genome).
    //      Additive: when settings.executive.enabled is false, `effectivePrompt`
    //      is byte-identical to the Part 6 systemPrompt.
    const exec = settings.executive || ({} as any);
    let effectivePrompt = systemPrompt;
    if (exec.enabled) {
      if (exec.personality_enabled && activeAgent) {
        try {
          const p = readPersonality(activeAgent);
          effectivePrompt += personalityPromptBlock(p, ctx.language);
          await ctx.emit("personality", { agentId: activeAgent.id, traits: p, version: activeAgent.personality_version || 1 });
        } catch {}
      }
      if (exec.genome_enabled && ctx.workspaceId) {
        try {
          const g = await readWorkspaceGenome(ctx.workspaceId);
          effectivePrompt += genomePromptBlock(g);
          if (g) await ctx.emit("genome", { scope: "workspace", id: g.id, runs: g.runs_count, memories: g.memory_count, risk: g.risk_level });
        } catch {}
      }
    }


    // 3.5) EXPERT COUNCIL — deliberate before acting.
    //      Part 4: implementations are chosen via the Capability OS
    //      (live scores + DNA + workspace preferences), not just the static
    //      picker. Backward compatible via settings.capability_os.enabled.
    const capScores = settings.capability_os?.scoring_enabled !== false ? await loadCapabilityScores() : {};
    if (settings.capability_os?.graph_enabled !== false) {
      try {
        const graph = buildCapabilityGraph(capScores);
        await ctx.emit("graph", { nodes: graph.slice(0, 40) });
      } catch {}
    }

    if (settings.council?.enabled) {
      await ctx.emit("phase", { phase: "council" });
      const requiredCaps = new Set<Capability>();
      for (const s of steps) {
        const def = TOOL_CATALOG.find((t) => t.key === s.tool);
        for (const c of def?.capabilities || []) requiredCaps.add(c);
      }
      const capsList = Array.from(requiredCaps).slice(0, settings.council.max_experts);
      for (const cap of capsList) {
        if (ctx.signal.aborted) break;
        const preferred = (workspaceProfile?.preferred_experts as string[]) || [];
        const maxRisk = (workspaceProfile?.risk_level as "low" | "medium" | "high") || undefined;
        const choice = settings.capability_os?.enabled !== false
          ? chooseImplementation({ capability: cap, scores: capScores, preferredExperts: preferred, maxRiskLevel: maxRisk })
          : null;
        const expert: ToolDef | undefined = choice?.expert || findExpertsByCapability(cap)[0];
        if (choice) {
          await ctx.emit("capability_choice", {
            capability: cap, expert: choice.expert.key, score: choice.score,
            reason: choice.reason, alternatives: choice.alternatives,
          });
        }
        if (!expert) continue;
        try {
          const cResp = await callGateway(apiKey, MODEL, [
            {
              role: "system",
              content: `You are the "${expert.labels.en}" expert (DNA: ${expert.dna || expert.labels.en}). ` +
                `Strengths: ${(expert.strengths || []).join(", ") || "—"}. ` +
                `Weaknesses: ${(expert.weaknesses || []).join(", ") || "—"}. ` +
                `Reply with a JSON object: { "opinion": "<one paragraph>", "objection": "<empty or issue>", "suggest_tools": ["tool_key", ...], "confidence": 0-100 }. ` +
                `Use the user's language (${ctx.language}).`,
            },
            {
              role: "user",
              content: `Goal: ${ctx.goal}\nCapability under review: ${cap}\nProposed plan (JSON):\n${JSON.stringify(planObj).slice(0, 2500)}\n\nGive your expert opinion.`,
            },
          ], { signal: ctx.signal });
          totalUsd += cResp.usd; totalTokens += cResp.tokens;
          const parsed = extractJsonObject<any>(cResp.text) || { opinion: cResp.text };
          const entry = {
            phase: "council",
            capability: cap,
            expert: expert.key,
            opinion: parsed.opinion || parsed.text || cResp.text.slice(0, 400),
            objection: parsed.objection || null,
            suggest_tools: parsed.suggest_tools || [],
            confidence: Number(parsed.confidence) || null,
            at: new Date().toISOString(),
          };
          decisionLog.push(entry);
          await ctx.emit("council", entry);
          await logMsg("council", entry, cResp.tokens, cResp.usd);
          // Emit needs_human when confidence falls below threshold.
          const minConf = settings.agent_factory?.min_confidence ?? 40;
          if (entry.confidence != null && entry.confidence < minConf) {
            await ctx.emit("needs_human", {
              expert: expert.key,
              capability: cap,
              confidence: entry.confidence,
              objection: entry.objection,
              threshold: minConf,
            });
          }
        } catch (e: any) {
          const entry = { phase: "council", capability: cap, expert: expert.key, error: String(e?.message || e), at: new Date().toISOString() };
          decisionLog.push(entry);
          await ctx.emit("council", entry);
        }
      }

      // 3.6) PART 7 — COGNITIVE CONFLICT ENGINE.
      //      Runs ONE extra deliberation pass only when the council actually
      //      disagrees (objection, wide confidence spread, or divergent tool
      //      suggestions). No conflict → zero extra cost, identical to Part 6.
      if (exec.enabled && exec.conflict_enabled) {
        try {
          const opinions = decisionLog.filter((d: any) => d.phase === "council" && !d.error);
          const confs = opinions.map((d: any) => (typeof d.confidence === "number" ? d.confidence : null)).filter((v: any) => v != null) as number[];
          const spread = confs.length > 1 ? Math.max(...confs) - Math.min(...confs) : 0;
          const objections = opinions.filter((d: any) => d.objection && String(d.objection).trim()).length;
          const toolSets = opinions.map((d: any) => JSON.stringify((d.suggest_tools || []).slice().sort()));
          const divergentTools = new Set(toolSets).size > 1;
          const threshold = Number(exec.conflict_threshold ?? 25);
          const conflicted = objections > 0 || spread > threshold || divergentTools;
          if (conflicted && opinions.length > 1) {
            await ctx.emit("phase", { phase: "conflict" });
            const xResp = await callGateway(apiKey, MODEL, [
              {
                role: "system",
                content:
                  `You resolve cognitive conflicts between expert positions. There is NO VOTING. ` +
                  `Weigh each position on: evidence, confidence, expected quality, cost, risk, and available knowledge. ` +
                  `Return JSON only: { "positions": [ { "expert": "...", "claim": "...", "evidence": 0-1, "risk": 0-1, "cost": 0-1, "score": 0-1 } ], "chosen": "<expert key>", "why": "<1-2 sentences>", "residual_risk": "<short>" }. ` +
                  `Answer in ${ctx.language}.`,
              },
              {
                role: "user",
                content: `Goal: ${ctx.goal}\nConflict signals: objections=${objections}, confidence_spread=${spread}, divergent_tools=${divergentTools}\nPositions (JSON):\n${JSON.stringify(opinions).slice(0, 4000)}`,
              },
            ], { signal: ctx.signal });
            totalUsd += xResp.usd; totalTokens += xResp.tokens;
            const parsed = extractJsonObject<any>(xResp.text) || { why: xResp.text.slice(0, 400) };
            const entry = {
              phase: "conflict",
              positions: parsed.positions || [],
              weights: { evidence: 0.3, confidence: 0.2, quality: 0.2, cost: 0.15, risk: 0.15 },
              chosen: parsed.chosen || null,
              why: parsed.why || null,
              residual_risk: parsed.residual_risk || null,
              signals: { objections, spread, divergentTools },
              at: new Date().toISOString(),
            };
            decisionLog.push(entry);
            await ctx.emit("conflict", entry);
            await logMsg("conflict", entry, xResp.tokens, xResp.usd);
          }
        } catch {}
      }

      // Maaroof's final decision on the council opinions.
      if (decisionLog.length) {
        try {
          const dResp = await callGateway(apiKey, MODEL, [
            { role: "system", content: effectivePrompt },
            {
              role: "user",
              content: `Council opinions (JSON): ${JSON.stringify(decisionLog).slice(0, 4000)}\n\nWrite a brief final decision (1-2 sentences in ${ctx.language}): keep plan, adjust, or add a step. Return JSON: { "decision": "...", "rationale": "..." }`,
            },
          ], { signal: ctx.signal });
          totalUsd += dResp.usd; totalTokens += dResp.tokens;
          const d = extractJsonObject<any>(dResp.text) || { decision: dResp.text };
          const finalEntry = { phase: "decision", decision: d.decision, rationale: d.rationale, at: new Date().toISOString() };
          decisionLog.push(finalEntry);
          await ctx.emit("decision", finalEntry);
          await logMsg("decision", finalEntry, dResp.tokens, dResp.usd);
          if (settings.council.log_decisions) {
            try {
              await remember({
                userId: ctx.userId, runId, kind: "decision",
                content: `${d.decision || ""} — ${d.rationale || ""}`.slice(0, 500),
                importance: 3, sourceRunId: runId,
              });
            } catch {}
          }
        } catch {}
        await db().from("maaroof_runs").update({ decision_log: decisionLog }).eq("id", runId);
      }
    }

    // Part 6 — Simulation mode: after council deliberation, persist a scenario
    // to whatif_scenarios and stop before any tool execution.
    if (executionMode === "simulation") {
      await ctx.emit("phase", { phase: "simulation" });
      try {
        await db().from("whatif_scenarios").insert({
          user_id: ctx.userId,
          brand: workspaceProfile?.name || ctx.goal.slice(0, 80),
          changes: { plan: planObj },
          projection: { council: decisionLog, envision },
          kind: "plan",
          axes: { workspace: workspaceProfile?.id || null, geo: { country: geo.country, city: geo.city } },
        });
      } catch {}
      await ctx.emit("final", { text: "**Simulation complete** — plan and council opinions were captured as a scenario. No tools were executed." });
      await db().from("maaroof_runs").update({
        status: "done", total_tokens: totalTokens, total_usd: totalUsd,
        steps_count: 0, finished_at: new Date().toISOString(),
      }).eq("id", runId);
      await ctx.emit("done", { runId, totalUsd, totalTokens, steps: 0, executionMode });
      return { runId };
    }

    // 3.9) PART 7 — STRATEGIC TIME ENGINE. Decides WHEN to act. Heuristic
    //      (no LLM cost). `execute_now` keeps the Part 6 path untouched.
    let timing: TimingDecision | null = null;
    if (exec.enabled && exec.timing_enabled) {
      const opinions = decisionLog.filter((d: any) => d.phase === "council" && !d.error);
      const confs = opinions.map((d: any) => d.confidence).filter((v: any) => typeof v === "number") as number[];
      timing = assessTiming({
        goal: ctx.goal,
        steps,
        councilObjections: opinions.filter((d: any) => d.objection && String(d.objection).trim()).length,
        councilAvgConfidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null,
        spentUsd: totalUsd,
        workspace: workspaceProfile
          ? { risk_level: workspaceProfile.risk_level, budget: workspaceProfile.budget, policies: workspaceProfile.policies }
          : null,
      });
      await ctx.emit("timing", timing);
      try { await db().from("maaroof_runs").update({ timing }).eq("id", runId); } catch {}

      if (timing.verdict !== "execute_now") {
        if (timing.verdict === "schedule") {
          try {
            await db().from("maaroof_schedules").insert({
              user_id: ctx.userId,
              workspace_id: ctx.workspaceId || null,
              name: ctx.goal.slice(0, 80),
              prompt: ctx.goal,
              language: ctx.language,
              cadence: "once",
              starts_at: timing.suggested_at || new Date().toISOString(),
              next_run_at: timing.suggested_at || new Date().toISOString(),
              status: "active",
              meta: { created_by: "strategic_time_engine", run_id: runId, reason: timing.reason },
            });
          } catch {}
        }
        const label: Record<string, string> = {
          delay: "تأجيل", schedule: "جدولة", observe: "مراقبة", cancel: "إلغاء",
        };
        await ctx.emit("final", {
          text: `**قرار التوقيت: ${label[timing.verdict] || timing.verdict}**\n\n${timing.reason}\n\n_لم يتم تنفيذ أي أداة، ولم تُصرف أي تكلفة تنفيذ._`,
        });
        await db().from("maaroof_runs").update({
          status: "done", total_tokens: totalTokens, total_usd: totalUsd,
          steps_count: 0, finished_at: new Date().toISOString(),
        }).eq("id", runId);
        await ctx.emit("done", { runId, totalUsd, totalTokens, steps: 0, executionMode, timing: timing.verdict });
        return { runId };
      }
    }

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
          { role: "system", content: effectivePrompt },
          { role: "user", content: `Progress so far:\n${JSON.stringify(results).slice(0, 4000)}\n\nShould we continue, adjust, or stop? Reply briefly.` },
        ], { signal: ctx.signal });
        totalUsd += ref.usd; totalTokens += ref.tokens;
        await ctx.emit("reflection", { text: ref.text });
        await logMsg("reflection", { text: ref.text }, ref.tokens, ref.usd);
      }
    }

    // 5) FINAL ANSWER
    //    Part 7 — Trust Engine is folded into THIS call (no extra request):
    //    the model appends a structured envelope after a ---TRUST--- marker.
    await ctx.emit("phase", { phase: "summarizing" });
    const trustEnabled = !!(exec.enabled && exec.trust_enabled);
    const trustInstruction = trustEnabled
      ? `\n\nAfter the answer, output a line containing exactly ---TRUST--- and then a JSON object only:\n{ "confidence": 0-100, "evidence": ["..."], "assumptions": ["..."], "limitations": ["..."], "alternatives": ["..."], "risks": ["..."], "expected_outcome": "..." }`
      : "";
    const finalResp = await callGateway(apiKey, MODEL, [
      { role: "system", content: effectivePrompt },
      { role: "user", content: `Goal: ${ctx.goal}\n\nTool results:\n${JSON.stringify(results).slice(0, 8000)}\n\nWrite the final answer for the user in ${ctx.language === "ar" ? "Arabic" : ctx.language === "ku" ? "Kurdish" : "English"}. Be specific, actionable, tailored to ${geo.label}. Use Markdown.${trustInstruction}` },
    ], { signal: ctx.signal });
    totalUsd += finalResp.usd; totalTokens += finalResp.tokens;

    let finalText = finalResp.text;
    let trust: any = null;
    if (trustEnabled && finalText.includes("---TRUST---")) {
      const idx = finalText.indexOf("---TRUST---");
      const tail = finalText.slice(idx + "---TRUST---".length);
      finalText = finalText.slice(0, idx).trim();
      trust = extractJsonObject<any>(tail) || null;
    }
    if (trustEnabled) {
      const evidence = buildEvidenceGraph({ memories, decisionLog, results, envision, timing });
      trust = { ...(trust || {}), evidence_graph: evidence.slice(0, 30) };
      await ctx.emit("trust", trust);
      try { await db().from("maaroof_runs").update({ trust }).eq("id", runId); } catch {}
    }
    await ctx.emit("final", { text: finalText });
    await logMsg("assistant", { text: finalText, trust }, finalResp.tokens, finalResp.usd);

    // Part 6 — Executive Quality Score (11 dims). Computed heuristically from
    // observed signals to avoid additional LLM cost. Flag-gated.
    let qualityScore: Record<string, number> | null = null;
    if (settings.platform_evolution?.quality_score_enabled) {
      const okCount = results.filter((r) => r.ok).length;
      const okRatio = results.length ? okCount / results.length : 1;
      const councilConfs = decisionLog
        .filter((d: any) => d.phase === "council" && typeof d.confidence === "number")
        .map((d: any) => d.confidence as number / 100);
      const avgConf = councilConfs.length ? councilConfs.reduce((a, b) => a + b, 0) / councilConfs.length : 0.7;
      const clamp = (v: number) => Math.max(0, Math.min(1, Number(v.toFixed(3))));
      qualityScore = {
        decision: clamp(avgConf),
        planning: clamp(steps.length > 0 && steps.length <= 6 ? 0.85 : 0.6),
        expert: clamp(avgConf),
        capability: clamp(okRatio),
        memory: clamp(memories.length > 0 ? 0.8 : 0.5),
        simulation: clamp(envision ? 0.85 : 0.5),
        execution: clamp(okRatio),
        reflection: clamp(0.75),
        learning: clamp(settings.cognitive?.dna_enabled ? 0.8 : 0.5),
        cost_efficiency: clamp(totalUsd < 0.05 ? 0.9 : totalUsd < 0.2 ? 0.75 : 0.55),
        user_satisfaction: clamp(okRatio * 0.9 + 0.1),
      };
      await ctx.emit("quality_score", qualityScore);
    }

    // 6) Persist totals + summarize to memory + ledger LLM cost
    await db().from("maaroof_runs").update({
      status: "done",
      total_tokens: totalTokens,
      total_usd: totalUsd,
      steps_count: steps.length,
      finished_at: new Date().toISOString(),
      ...(qualityScore ? { quality_score: qualityScore } : {}),
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

    // Finalize agent lifecycle + metrics.
    if (activeAgent) {
      const okCount = results.filter((r) => r.ok).length;
      const success = results.length === 0 ? true : okCount / results.length >= 0.5;
      const councilConfs = decisionLog
        .filter((d: any) => d.phase === "council" && typeof d.confidence === "number")
        .map((d: any) => d.confidence as number);
      const avgConf = councilConfs.length ? councilConfs.reduce((a, b) => a + b, 0) / councilConfs.length : null;
      await finalizeAgent({
        agentId: activeAgent.id,
        runId,
        success,
        confidence: { council_avg: avgConf, tools_success: results.length ? okCount / results.length : null },
        costBreakdown: { total_usd: totalUsd, total_tokens: totalTokens, steps: steps.length, tools_ok: okCount, tools_total: results.length },
      });
      await ctx.emit("agent_finalized", { id: activeAgent.id, success, lifecycle_state: success ? "standby" : "archived" });

      // Part 7 — evolve executive personality from this run's signals.
      if (exec.enabled && exec.personality_enabled) {
        const traits = await evolvePersonality({
          agentId: activeAgent.id,
          signals: {
            success,
            toolsSuccessRatio: results.length ? okCount / results.length : null,
            councilAvgConfidence: avgConf,
            objections: decisionLog.filter((d: any) => d.phase === "council" && d.objection).length,
            totalUsd,
            steps: steps.length,
            hadEnvision: !!envision,
            conflictResolved: decisionLog.some((d: any) => d.phase === "conflict"),
          },
        });
        if (traits) await ctx.emit("personality_evolved", { agentId: activeAgent.id, traits });
      }
    }

    // Part 7 — Future DNA: anonymized outcome priors for both success and failure.
    if (exec.enabled && exec.future_dna_enabled) {
      try {
        const { recordDna } = await import("./cognition.server");
        const okCount = results.filter((r) => r.ok).length;
        await recordDna({
          kind: "future",
          sourceRunId: runId,
          payload: {
            outcome: results.length === 0 ? "no_tools" : okCount / results.length >= 0.5 ? "success" : "failure",
            plan_shape: steps.map((s) => s.tool).slice(0, 8),
            timing_verdict: timing?.verdict || "execute_now",
            quality_dims: qualityScore || null,
            total_usd: Number(totalUsd.toFixed(6)),
          },
          weight: 1,
        });
      } catch {}
    }

    // Part 5 — anonymized Platform DNA extraction (opt-in via settings.cognitive.dna_enabled).
    try {
      const s: any = settings;
      if (s?.cognitive?.enabled && s?.cognitive?.dna_enabled) {
        const { recordDna } = await import("./cognition.server");
        const okCount = results.filter((r) => r.ok).length;
        await recordDna({
          kind: "execution",
          sourceRunId: runId,
          payload: {
            steps: steps.length,
            tools_ok: okCount,
            tools_total: results.length,
            total_usd: Number(totalUsd.toFixed(6)),
            total_tokens: totalTokens,
            capability_choices: decisionLog.filter((d: any) => d.phase === "council").map((d: any) => ({ capability: d.capability, expert: d.expert })).slice(0, 8),
          },
          weight: 1,
        });
      }
    } catch {}

    await ctx.emit("done", { runId, totalUsd, totalTokens, steps: steps.length });
    return { runId };
  } catch (e: any) {
    await db().from("maaroof_runs").update({ status: "error", error: String(e?.message || e), finished_at: new Date().toISOString() }).eq("id", runId);
    if (activeAgent) {
      try {
        await finalizeAgent({ agentId: activeAgent.id, runId, success: false, confidence: {}, costBreakdown: { total_usd: totalUsd, total_tokens: totalTokens } });
      } catch {}
    }
    await ctx.emit("error", { message: String(e?.message || e) });
    throw e;
  }
}

function buildSystemPrompt(
  ctx: RunContext,
  geo: { country: string; city?: string; label: string },
  memories: string[],
  workspaceProfile?: any,
): string {
  const memBlock = memories.length ? `\n\nLong-term memory about this user:\n${memories.slice(0, 10).join("\n")}` : "";
  let wsBlock = "";
  if (workspaceProfile) {
    const wp = workspaceProfile;
    const bits: string[] = [];
    if (wp.name) bits.push(`Workspace: ${wp.name} (${wp.kind || "brand"})`);
    if (wp.brand_url) bits.push(`Site: ${wp.brand_url}`);
    if (wp.brand_summary) bits.push(`Brand: ${String(wp.brand_summary).slice(0, 400)}`);
    if (Array.isArray(wp.keywords) && wp.keywords.length) bits.push(`Keywords: ${wp.keywords.slice(0, 10).join(", ")}`);
    if (wp.profile && Object.keys(wp.profile).length) bits.push(`Profile: ${JSON.stringify(wp.profile).slice(0, 600)}`);
    if (Array.isArray(wp.goals) && wp.goals.length) bits.push(`Goals: ${JSON.stringify(wp.goals).slice(0, 400)}`);
    if (wp.policies && Object.keys(wp.policies).length) bits.push(`Policies: ${JSON.stringify(wp.policies).slice(0, 400)}`);
    if (wp.risk_level) bits.push(`Risk level: ${wp.risk_level}`);
    if (bits.length) wsBlock = `\n\n[Workspace context]\n${bits.join("\n")}`;
  }
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
- Reply concisely in JSON when asked.${wsBlock}${memBlock}`;
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
