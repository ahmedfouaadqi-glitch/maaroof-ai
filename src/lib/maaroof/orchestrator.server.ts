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
import {
  classifyReality,
  persistReality,
  realityNotice,
  realityPromptBlock,
  closeRealityLoop,
  type RealityAssessment,
} from "./reality.server";
import { loadModelRegistry, selectModel, recordModelCall, costOf, proposeModelUpgrade, type ModelPhase, type ModelChoice } from "./models.server";
import { DecisionTracer, chooseAlternative } from "./decisions.server";


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
  // Part 12 — model governance. When disabled, every phase resolves to MODEL,
  // pricing keeps the legacy estimate and no telemetry is written.
  const mg = settings.model_governance || ({} as any);
  const modelRegistry = mg.enabled || mg.use_registry_pricing ? await loadModelRegistry() : [];
  const phaseModels = new Map<ModelPhase, ModelChoice>();
  const modelChoices: any[] = [];
  async function modelFor(phase: ModelPhase): Promise<ModelChoice> {
    const hit = phaseModels.get(phase);
    if (hit) return hit;
    const choice = await selectModel({
      phase,
      enabled: !!(mg.enabled && mg.per_phase_selection),
      defaultModel: MODEL,
      fallbackModel: settings.fallback_model,
      preferredModels: (workspaceProfile?.preferred_models as string[]) || null,
      riskLevel: (workspaceProfile?.risk_level as string) || null,
      budgetUsd: Number((workspaceProfile?.budget as any)?.max_usd ?? NaN) || null,
      registry: modelRegistry,
    });
    phaseModels.set(phase, choice);
    if (choice.governed) modelChoices.push({ phase, model: choice.model, reason: choice.reason });
    return choice;
  }

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

  // Part 16 — Living State Anchor. The run gets an identity anchor inherited
  // from the platform (and its workspace) BEFORE anything executes. Disabled by
  // default, and never fatal: a failure here degrades to the previous behaviour.
  const anchorCfg = (settings as any).state_anchor || {};
  let runAnchor: any = null;
  let anchorValidation: any = null;
  if (anchorCfg.enabled) {
    try {
      const { upsertAnchor, validateBeforeExecution } = await import("@/lib/maaroof/state.server");
      if (anchorCfg.validate_before_execution !== false) {
        anchorValidation = await validateBeforeExecution({
          goal: ctx.goal,
          userId: ctx.userId,
          workspaceId: ctx.workspaceId || null,
          language: ctx.language,
        });
        await ctx.emit("state_anchor", { validation: anchorValidation });
      }
      runAnchor = await upsertAnchor({
        level: "run",
        scopeId: runId,
        userId: ctx.userId,
        workspaceId: ctx.workspaceId || null,
        runId,
        label: ctx.goal.slice(0, 80),
        currentGoal: ctx.goal,
        language: ctx.language,
        geo: { country: geo.country, city: geo.city },
      });
    } catch (e) {
      await ctx.emit("state_anchor_error", { message: String((e as any)?.message || e) });
    }
  }



  let totalUsd = 0;
  let totalTokens = 0;

  const logMsg = async (role: string, parts: any, tokens = 0, usd = 0) => {
    await db().from("maaroof_messages").insert({ run_id: runId, role, parts, tokens, usd });
  };
  await logMsg("user", { text: ctx.goal });

  // Part 12/13 — every gateway call goes through one governed entry point:
  // it resolves the phase model, prices the call from the registry and feeds
  // model health. Behaviour with governance off is identical to before.
  const call = async (phase: ModelPhase, messages: any[]) => {
    const choice = await modelFor(phase);
    const t0 = Date.now();
    try {
      const r = await callGateway(apiKey, choice.model, messages, {
        signal: ctx.signal,
        registry: mg.use_registry_pricing ? modelRegistry : undefined,
      });
      if (mg.health_tracking !== false) {
        void recordModelCall({ model: choice.model, ok: true, latencyMs: Date.now() - t0, tokens: r.tokens, usd: r.usd });
      }
      return r;
    } catch (e: any) {
      if (mg.health_tracking !== false) {
        void recordModelCall({ model: choice.model, ok: false, latencyMs: Date.now() - t0, error: String(e?.message || e) });
      }
      // Governed fallback: retry once on the phase fallback model.
      if (choice.governed && choice.fallback && choice.fallback !== choice.model) {
        const r = await callGateway(apiKey, choice.fallback, messages, {
          signal: ctx.signal,
          registry: mg.use_registry_pricing ? modelRegistry : undefined,
        });
        return r;
      }
      throw e;
    }
  };

  // Part 13 — Executive Decision Intelligence trace (opt-in).
  const dec = settings.decision || ({} as any);
  const tracer = new DecisionTracer({
    enabled: !!(dec.enabled && dec.trace_enabled),
    runId,
    userId: ctx.userId,
    workspaceId: ctx.workspaceId || null,
    emit: ctx.emit,
  });

  let activeAgent: MaaroofAgent | null = null;
  try {
    // 2) Recall memory (workspace-scoped when available)
    const memories = await recall(ctx.userId, ctx.goal, 10, { workspaceId: ctx.workspaceId || null });
    if (memories.length) await ctx.emit("memory", { items: memories });

    const baseSystemPrompt = buildSystemPrompt(ctx, geo, memories, workspaceProfile);

    // Part 13 — pipeline stages 1..6 (understanding & context).
    if (tracer.enabled) {
      await tracer.trace({
        stage: "goal_understanding",
        summary: String(ctx.goal).slice(0, 200),
        payload: { language: ctx.language, execution_mode: executionMode, chars: ctx.goal.length },
      });
      await tracer.trace({
        stage: "context_analysis",
        summary: `النطاق الجغرافي: ${geo.label || "World"}`,
        payload: { country: geo.country, city: geo.city, scope: ctx.geoScope || { mode: "auto" } },
      });
      await tracer.trace({
        stage: "workspace_analysis",
        summary: workspaceProfile?.name ? `مساحة العمل: ${workspaceProfile.name}` : "بدون مساحة عمل",
        payload: {
          goals: workspaceProfile?.goals || null,
          policies: workspaceProfile?.policies || null,
          risk_level: workspaceProfile?.risk_level || null,
        },
      });
      await tracer.trace({
        stage: "user_analysis",
        summary: `المستخدم ${ctx.userId.slice(0, 8)}…`,
        payload: { workspace_scoped: !!ctx.workspaceId },
      });
      await tracer.trace({
        stage: "memory_analysis",
        summary: `استُدعيت ${memories.length} ذاكرة ذات صلة.`,
        payload: { count: memories.length },
      });
    }

    // 2.4) Learned expert snapshots (Part 9) + living knowledge (Part 11).
    //      Both are additive prompt blocks: disabled ⇒ byte-identical prompt.
    let learnedBlock = "";
    if (settings.experts?.enabled && settings.experts?.use_snapshots) {
      try {
        const { readExpertSnapshots, snapshotPromptBlock } = await import("./experts.server");
        const snaps = await readExpertSnapshots(settings.enabled_tools || []);
        learnedBlock += snapshotPromptBlock(snaps);
      } catch {}
    }
    if (settings.knowledge?.enabled && settings.knowledge?.recall_enabled) {
      try {
        const { recallKnowledge, knowledgePromptBlock } = await import("./knowledge.server");
        const nodes = await recallKnowledge({
          userId: ctx.userId,
          workspaceId: ctx.workspaceId || null,
          minConfidence: settings.knowledge.min_confidence,
          limit: 8,
        });
        if (nodes.length) await ctx.emit("knowledge", { items: nodes.map((n) => ({ layer: n.layer, title: n.title, quality: n.quality })) });
        learnedBlock += knowledgePromptBlock(nodes);
        if (tracer.enabled) {
          await tracer.trace({
            stage: "knowledge_analysis",
            summary: `عُقد معرفية مستخدمة: ${nodes.length}`,
            payload: { layers: nodes.map((n) => n.layer) },
          });
        }
      } catch {}
    }

    const systemPrompt = `${baseSystemPrompt}${learnedBlock}` + (settings.system_prompt_extra ? `\n\n[Admin guidance]\n${settings.system_prompt_extra}` : "");


    // 2.5) ENVISION — Future-Driven step (Part 2). Derive a future_goal and
    //      backward_chain BEFORE planning. Kill-switchable; returns to Part 1
    //      behaviour when disabled.
    const decisionLog: any[] = [];
    let envision: any = null;
    if (settings.council?.envision_enabled !== false) {
      try {
        await ctx.emit("phase", { phase: "envision" });
        const eResp = await call("envision", [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Goal: ${ctx.goal}\n\nApply Future-Driven thinking. Return JSON only:\n{ "future_goal": "<1-2 sentence outcome to aim for>", "backward_chain": ["step working backwards from the future", "..."], "success_metrics": ["..."] }\nUse the user's language (${ctx.language}).`,
          },
        ]);
        totalUsd += eResp.usd; totalTokens += eResp.tokens;
        envision = extractJsonObject<any>(eResp.text) || null;
        if (envision) {
          decisionLog.push({ phase: "envision", ...envision, at: new Date().toISOString() });
          await ctx.emit("envision", envision);
          await logMsg("envision", envision, eResp.tokens, eResp.usd);
          if (tracer.enabled) {
            await tracer.trace({
              stage: "future_impact",
              summary: String(envision.future_goal || "").slice(0, 200),
              payload: { backward_chain: envision.backward_chain || [], success_metrics: envision.success_metrics || [] },
              cost_usd: eResp.usd,
            });
          }
        }
      } catch {}
    }

    // 3) PLAN (uses envision output when present)
    await ctx.emit("phase", { phase: "planning" });
    const planUserMsg =
      (envision ? `Future goal: ${envision.future_goal || ""}\nBackward chain: ${JSON.stringify(envision.backward_chain || []).slice(0, 1200)}\n\n` : "") +
      `Goal: ${ctx.goal}\n\nProduce a JSON plan: { "steps": [ { "tool": "<one of the available tool keys>", "input": { ... }, "reason": "..." } ], "final_answer_hint": "..." }\nUse 1-6 steps. Only use tool keys from the list. Return JSON only.`;
    const planResp = await call("planning", [
      { role: "system", content: systemPrompt },
      { role: "user", content: planUserMsg },
    ]);
    totalUsd += planResp.usd; totalTokens += planResp.tokens;
    const planObj = extractJsonObject<{ steps: PlanStep[]; final_answer_hint?: string }>(planResp.text) || { steps: [] };
    const steps = Array.isArray(planObj.steps) ? planObj.steps.slice(0, MAX_STEPS) : [];
    await db().from("maaroof_runs").update({ plan: planObj }).eq("id", runId);
    await logMsg("plan", planObj, planResp.tokens, planResp.usd);
    await ctx.emit("plan", { plan: planObj });

    // Part 13 — pipeline stages 7..16 recorded from the plan we just built.
    if (tracer.enabled) {
      const planCaps = Array.from(
        new Set(steps.flatMap((st) => TOOL_CATALOG.find((t) => t.key === st.tool)?.capabilities || [])),
      );
      const plannerChoice = await modelFor("planning");
      const finalChoice = await modelFor("final");
      await tracer.trace({
        stage: "expert_selection",
        summary: `خبراء مطلوبون حسب القدرات: ${planCaps.length}`,
        experts: planCaps.flatMap((c) => findExpertsByCapability(c as Capability).map((t) => t.key)).slice(0, 12),
        capabilities: planCaps,
      });
      await tracer.trace({ stage: "capability_selection", summary: planCaps.join(", ").slice(0, 200), capabilities: planCaps });
      await tracer.trace({
        stage: "tool_selection",
        summary: steps.map((st) => st.tool).join(" → ").slice(0, 200),
        tools: steps.map((st) => ({ tool: st.tool, reason: st.reason || null })),
      });
      await tracer.trace({
        stage: "mcp_selection",
        summary: (workspaceProfile?.preferred_mcp || []).length ? "MCP مفضّلة من مساحة العمل" : "لا توجد MCP مطلوبة لهذه المهمة",
        mcp: workspaceProfile?.preferred_mcp || [],
      });
      await tracer.trace({
        stage: "model_selection",
        summary: `تخطيط: ${plannerChoice.model} — إجابة: ${finalChoice.model}`,
        models: [
          { phase: "planning", model: plannerChoice.model, reason: plannerChoice.reason },
          { phase: "final", model: finalChoice.model, reason: finalChoice.reason },
        ],
        alternatives: plannerChoice.fallback
          ? [{ option: plannerChoice.fallback, reason: "نموذج احتياطي — يُستخدم فقط عند فشل النموذج الأساسي." }]
          : [],
        cost_usd: plannerChoice.expected_cost_per_1k_usd,
      });

      // Cost-aware decision: compare candidate execution strategies.
      if (dec.cost_aware_alternatives) {
        const unit = (await modelFor("planning")).expected_cost_per_1k_usd || 0.005;
        const options = [
          { label: `خطة مختصرة (${Math.max(1, Math.min(2, steps.length))} خطوة)`, quality: 62, cost_usd: unit * 2, minutes: 1 },
          { label: `الخطة المقترحة (${steps.length} خطوة)`, quality: 85, cost_usd: unit * Math.max(2, steps.length), minutes: Math.max(2, steps.length) },
          { label: `خطة موسّعة (${steps.length + 2} خطوة)`, quality: 90, cost_usd: unit * (steps.length + 4), minutes: steps.length + 4 },
        ];
        const pick = chooseAlternative(options);
        if (pick) {
          await tracer.trace({
            stage: "execution_strategy",
            summary: pick.reason,
            alternatives: pick.rejected,
            cost_usd: pick.chosen.cost_usd,
            confidence: pick.chosen.quality,
          });
        }
      } else {
        await tracer.trace({ stage: "execution_strategy", summary: `تنفيذ ${steps.length} خطوة بالتسلسل.`, tools: steps.map((st) => st.tool) });
      }
      await tracer.trace({
        stage: "cost_analysis",
        summary: `تكلفة التخطيط حتى الآن: ${totalUsd.toFixed(5)}$`,
        cost_usd: totalUsd,
      });
      await tracer.trace({
        stage: "risk_analysis",
        summary: workspaceProfile?.risk_level ? `مستوى المخاطر: ${workspaceProfile.risk_level}` : "مخاطر قياسية",
        risk: workspaceProfile?.risk_level === "high" ? 70 : workspaceProfile?.risk_level === "low" ? 20 : 40,
      });
    }

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



    // 3.3) PART 8 — Laws of Cognitive Intelligence. The laws block is injected
    //      into the SAME system prompt (no extra request). Counters below feed
    //      the compliance evaluation performed just before the final answer.
    const laws = (settings as any).laws || {};
    if (laws.enabled && laws.prompt_injection) {
      effectivePrompt += lawsPromptBlock(ctx.language);
    }

    // 3.4) PART 19 — Reality Constitution. Same prompt, no extra request: the
    //      model is told to classify every conclusion and never hide uncertainty.
    const realityCfg = (settings as any).reality_engine || {};
    if (realityCfg.enabled && realityCfg.inject_prompt !== false) {
      effectivePrompt += realityPromptBlock(ctx.language);
    }

    let capabilityChoices = 0;
    let needsHumanFlag = false;




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
          capabilityChoices++;
          await ctx.emit("capability_choice", {
            capability: cap, expert: choice.expert.key, score: choice.score,
            reason: choice.reason, alternatives: choice.alternatives,
          });
        }

        if (!expert) continue;
        try {
          const cResp = await call("council", [
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
          ]);
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
            needsHumanFlag = true;
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
            const xResp = await call("conflict", [
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
            ]);
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
          const dResp = await call("council", [
            { role: "system", content: effectivePrompt },
            {
              role: "user",
              content: `Council opinions (JSON): ${JSON.stringify(decisionLog).slice(0, 4000)}\n\nWrite a brief final decision (1-2 sentences in ${ctx.language}): keep plan, adjust, or add a step. Return JSON: { "decision": "...", "rationale": "..." }`,
            },
          ]);
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
        const ref = await call("reflection", [
          { role: "system", content: effectivePrompt },
          { role: "user", content: `Progress so far:\n${JSON.stringify(results).slice(0, 4000)}\n\nShould we continue, adjust, or stop? Reply briefly.` },
        ]);
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
    const finalResp = await call("final", [
      { role: "system", content: effectivePrompt },
      { role: "user", content: `Goal: ${ctx.goal}\n\nTool results:\n${JSON.stringify(results).slice(0, 8000)}\n\nWrite the final answer for the user in ${ctx.language === "ar" ? "Arabic" : ctx.language === "ku" ? "Kurdish" : "English"}. Be specific, actionable, tailored to ${geo.label}. Use Markdown.${trustInstruction}` },
    ]);
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

    // PART 15 — Executive Trust Architecture. Evolves the Part 7 envelope into a
    // measured 13-stage pipeline plus living per-entity trust profiles. Pure
    // arithmetic over signals the run already produced: zero extra model cost.
    const trustCfg = (settings as any).trust_engine || {};
    if (trustCfg.enabled) {
      try {
        const { evaluateTrustPipeline, executiveDecisionScore, recordTrustEvent } =
          await import("@/lib/maaroof/trust.server");
        const councilConfs2 = decisionLog
          .filter((d: any) => d.phase === "council" && typeof d.confidence === "number")
          .map((d: any) => d.confidence as number);
        const okResults = results.filter((r) => r.ok).length;
        const pipeline = trustCfg.pipeline_enabled === false ? null : evaluateTrustPipeline({
          sources: results.filter((r) => r.ok).length,
          evidence: Array.isArray(trust?.evidence) ? trust.evidence.length : (trust?.evidence_graph?.length || 0),
          reasoningSteps: steps.length,
          knowledgeNodes: memories.length,
          expertConfidence: councilConfs2.length
            ? Math.round(councilConfs2.reduce((a, b) => a + b, 0) / councilConfs2.length)
            : null,
          modelReliability: typeof trust?.confidence === "number" ? trust.confidence : null,
          pastSuccessRate: results.length ? Math.round((okResults / results.length) * 100) : null,
          historicalSamples: memories.length,
          hasBusinessContext: !!workspaceProfile,
          hasFutureSimulation: !!envision,
          risks: Array.isArray(trust?.risks) ? trust.risks.length : 0,
          contradictions: results.filter((r) => !r.ok).length,
        });

        const execScore = trustCfg.executive_score_enabled === false || !pipeline ? null : executiveDecisionScore({
          trustScore: pipeline.score,
          qualityScore: typeof trust?.confidence === "number" ? trust.confidence : null,
          costUsd: totalUsd,
          expectedValueUsd: null,
          risks: Array.isArray(trust?.risks) ? trust.risks.length : 0,
          alternatives: Array.isArray(trust?.alternatives) ? trust.alternatives.length : 0,
          rollbackPossible: executionMode !== "execution",
          futureImpact: null,
        });

        trust = { ...(trust || {}), pipeline, executive: execScore };
        await ctx.emit("trust", trust);
        try { await db().from("maaroof_runs").update({ trust }).eq("id", runId); } catch {}

        if (trustCfg.profiles_enabled !== false) {
          const ok = pipeline ? pipeline.score >= Number(trustCfg.min_trust ?? 55) : okResults > 0;
          const jobs: Promise<any>[] = [];
          for (const m of new Set(modelChoices.map((c: any) => c.model).filter(Boolean))) {
            jobs.push(recordTrustEvent({
              entityType: "model", entityKey: String(m), ok,
              reason: "run_completed", runId, confidence: pipeline?.score ?? null,
              costUsd: totalUsd, contradiction: (trust?.contradictions?.length || 0) > 0,
            }));
          }
          for (const r of results) {
            jobs.push(recordTrustEvent({
              entityType: "tool", entityKey: String(r.tool), ok: !!r.ok,
              reason: r.ok ? "tool_succeeded" : "tool_failed", runId,
              confidence: pipeline?.score ?? null,
            }));
          }
          if (activeAgent?.id) {
            jobs.push(recordTrustEvent({
              entityType: "agent", entityKey: String(activeAgent.id), ok,
              reason: "run_completed", runId, userId: ctx.userId,
              confidence: pipeline?.score ?? null, costUsd: totalUsd,
            }));
          }
          await Promise.allSettled(jobs);
        }
      } catch (e) {
        // Trust measurement must never break a run.
        await ctx.emit("trust_error", { message: String((e as any)?.message || e) });
      }
    }
    // PART 8 — Constitutional compliance gate. Evaluates the 30 laws against
    // signals the run already produced (zero extra LLM cost). When
    // enforce_hard_laws is on, a hard-law breach downgrades the answer from a
    // final recommendation to a flagged draft instead of hiding the breach.
    let compliance: LawEvaluation | null = null;
    if (laws.enabled) {
      const councilConfsAll = decisionLog
        .filter((d: any) => d.phase === "council" && typeof d.confidence === "number")
        .map((d: any) => d.confidence as number);
      compliance = evaluateLaws(
        {
          hasEnvision: !!envision,
          planSteps: steps.length,
          memoriesRecalled: memories.length,
          councilOpinions: decisionLog.filter((d: any) => d.phase === "council" && !d.error).length,
          councilAvgConfidence: councilConfsAll.length
            ? Math.round(councilConfsAll.reduce((a, b) => a + b, 0) / councilConfsAll.length)
            : null,
          capabilityChoices,
          hasAgent: !!activeAgent,
          reflections: results.length >= 3 ? Math.floor(results.length / 3) : 0,
          toolResults: results.map((r) => ({ ok: !!r.ok })),
          trust,
          timingVerdict: timing?.verdict ?? null,
          qualityScore: null,
          decisionLogEntries: decisionLog.length,
          executionMode,
          workspaceId: ctx.workspaceId || null,
          memoryScoped: !!ctx.workspaceId,
          consent: null,
          totalUsd,
          hasWorkspaceContext: !!workspaceProfile,
          hasGenome: !!(exec.enabled && exec.genome_enabled && ctx.workspaceId),
          needsHuman: needsHumanFlag,
          finalTextLength: finalText.length,
        },
        { minTrust: Number(laws.min_trust ?? 55) },
      );
      if (laws.enforce_hard_laws && compliance.verdict === "violation") {
        finalText = hardLawNotice(compliance, ctx.language) + finalText;
      }
      await ctx.emit("compliance", compliance);
      if (laws.log_compliance !== false) {
        try { await db().from("maaroof_runs").update({ compliance }).eq("id", runId); } catch {}
      }
    }

    // PART 19 — Reality classification + evidence. Runs after trust and the
    // constitutional gate so it can read their verdicts. Pure local arithmetic
    // over signals the run already produced: zero extra model cost. Verified
    // outcomes are fed back into knowledge + trust to close the Reality Loop.
    let reality: RealityAssessment | null = null;
    if (realityCfg.enabled) {
      try {
        const councilConfsR = decisionLog
          .filter((d: any) => d.phase === "council" && typeof d.confidence === "number")
          .map((d: any) => d.confidence as number);
        reality = classifyReality({
          toolResults: results.map((r) => ({ tool: String(r.tool), ok: !!r.ok })),
          memoriesRecalled: memories.length,
          knowledgeNodes: Array.isArray((trust as any)?.evidence_graph) ? (trust as any).evidence_graph.length : 0,
          councilOpinions: decisionLog.filter((d: any) => d.phase === "council" && !d.error).length,
          councilAvgConfidence: councilConfsR.length
            ? Math.round(councilConfsR.reduce((a, b) => a + b, 0) / councilConfsR.length)
            : null,
          trustScore: typeof (trust as any)?.pipeline?.score === "number"
            ? (trust as any).pipeline.score
            : typeof (trust as any)?.confidence === "number"
              ? (trust as any).confidence
              : null,
          trustRisks: Array.isArray((trust as any)?.risks) ? (trust as any).risks.length : 0,
          trustAlternatives: Array.isArray((trust as any)?.alternatives) ? (trust as any).alternatives : [],
          hasEnvision: !!envision,
          timingVerdict: timing?.verdict ?? null,
          executionMode,
          complianceVerdict: (compliance as any)?.verdict ?? null,
          externalSources: results.filter((r) => r.ok).length,
          historicalSamples: memories.length,
          finalTextLength: finalText.length,
        });

        if (realityCfg.transparency_notice !== false) {
          finalText = realityNotice(reality, ctx.language) + finalText;
        }
        await ctx.emit("reality", reality);
        try { await db().from("maaroof_runs").update({ reality }).eq("id", runId); } catch {}

        if (realityCfg.persist_enabled !== false) {
          await persistReality({
            assessment: reality,
            runId,
            userId: ctx.userId,
            workspaceId: ctx.workspaceId || null,
            subject: "answer",
            signals: { execution_mode: executionMode, steps: steps.length, cost_usd: totalUsd },
          });
        }
        if (realityCfg.close_loop !== false) {
          await closeRealityLoop({
            assessment: reality,
            runId,
            userId: ctx.userId,
            workspaceId: ctx.workspaceId || null,
          });
        }
      } catch (e) {
        await ctx.emit("reality_error", { message: String((e as any)?.message || e) });
      }
    }

    await ctx.emit("final", { text: finalText });
    await logMsg("assistant", { text: finalText, trust, compliance, reality }, finalResp.tokens, finalResp.usd);


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

    // Part 13 — closing pipeline stages + Decision Score.
    let decisionScore: any = null;
    if (tracer.enabled) {
      const okCount = results.filter((r) => r.ok).length;
      if (timing) {
        await tracer.trace({
          stage: "time_analysis",
          summary: `توقيت التنفيذ: ${timing.verdict}`,
          payload: timing as any,
        });
      }
      await tracer.trace({
        stage: "execution",
        summary: `نُفِّذت ${results.length} خطوة، نجح منها ${okCount}.`,
        tools: results.map((r) => ({ tool: r.tool, ok: !!r.ok })),
        cost_usd: totalUsd,
      });
      await tracer.trace({
        stage: "validation",
        summary: compliance ? `امتثال دستوري: ${(compliance as any).verdict ?? "—"}` : "تحقق داخلي من النتائج",
        confidence: typeof trust?.confidence === "number" ? trust.confidence : null,
      });
      await tracer.trace({
        stage: "approval",
        summary: executionMode === "execution" ? "تنفيذ مباشر ضمن صلاحيات المستخدم." : `وضع ${executionMode} — بلا تنفيذ فعلي.`,
        payload: { execution_mode: executionMode },
      });
      await tracer.trace({
        stage: "learning",
        summary: "تسجيل النتائج في الذاكرة والحمض المعرفي للاستفادة المستقبلية.",
        payload: { memory: true, dna: !!settings.cognitive?.dna_enabled },
      });
      if (dec.score_enabled) {
        decisionScore = { ...tracer.score(), models: modelChoices, stages: tracer.snapshot().length };
        await ctx.emit("decision_score", decisionScore);
      }
    }

    // Part 12 — file an upgrade proposal for the admin when the registry shows a
    // clearly better option. Never applied automatically.
    if (mg.enabled && mg.auto_proposals) {
      try { await proposeModelUpgrade(MODEL); } catch {}
    }

    // Part 16 — close the run anchor: measure drift against the anchored
    // identity, compute the state health score, and stamp a rollback point.
    if (anchorCfg.enabled && runAnchor?.id) {
      try {
        const { detectDrift, stateHealth, closeRunAnchor } = await import("@/lib/maaroof/state.server");
        const okSteps = results.filter((r: any) => r.ok).length;
        const drifts = anchorCfg.drift_detection === false ? [] : detectDrift({
          anchor: runAnchor,
          goal: ctx.goal,
          planSummary: JSON.stringify(steps.map((s: any) => s.tool || s.title || "")).slice(0, 2000),
          language: ctx.language,
          workspaceId: ctx.workspaceId || null,
          trustScore: typeof (trust as any)?.pipeline?.score === "number" ? (trust as any).pipeline.score : null,
          failedSteps: results.length - okSteps,
          totalSteps: results.length,
        });
        const health = stateHealth({
          drifts,
          validationOk: anchorValidation ? !!anchorValidation.ok : true,
          trustScore: typeof (trust as any)?.pipeline?.score === "number" ? (trust as any).pipeline.score : null,
          qualityScore: typeof qualityScore === "number" ? qualityScore : null,
          complianceVerdict: (compliance as any)?.verdict ?? null,
          successRatio: results.length ? okSteps / results.length : 1,
          versions: runAnchor.version,
        });
        await closeRunAnchor({
          anchorId: runAnchor.id, level: "run", scopeId: runId,
          userId: ctx.userId, runId, drifts, health,
          costUsd: totalUsd, tokens: totalTokens,
        });
        await ctx.emit("state_health", { health, drift: drifts });
      } catch (e) {
        await ctx.emit("state_anchor_error", { message: String((e as any)?.message || e) });
      }
    }


    // 6) Persist totals + summarize to memory + ledger LLM cost
    await db().from("maaroof_runs").update({
      status: "done",
      total_tokens: totalTokens,
      total_usd: totalUsd,
      steps_count: steps.length,
      finished_at: new Date().toISOString(),
      ...(qualityScore ? { quality_score: qualityScore } : {}),
      ...(decisionScore ? { decision_log: [...decisionLog, { phase: "decision_score", ...decisionScore }] } : {}),
    }).eq("id", runId);

    try {
      await db().from("token_ledger").insert({
        user_id: ctx.userId,
        tool_key: "maaroof.llm",
        tokens: totalTokens,
        usd_cost: totalUsd,
        run_id: runId,
        meta: { maaroof_run_id: runId, model: MODEL, models: modelChoices, geo: { country: geo.country, city: geo.city }, steps: steps.length },
      });
    } catch {}

    await remember({ userId: ctx.userId, runId, kind: "summary", content: `Goal: ${ctx.goal}\nResult: ${String(finalResp.text).slice(0, 500)}`, importance: 3 });
    if (geo.country) await remember({ userId: ctx.userId, runId, kind: "preference", content: `User location: ${geo.label}`, importance: 4 });

    // 6.5) Capture the run into the living knowledge graph (Part 11).
    if (settings.knowledge?.enabled && settings.knowledge?.capture_enabled) {
      try {
        const { upsertKnowledgeNode } = await import("./knowledge.server");
        const conf = Math.round(((qualityScore?.overall ?? 0.7) as number) * 100) || 70;
        await upsertKnowledgeNode(
          {
            layer: ctx.workspaceId ? "workspace" : "user",
            key: `run_insight_${ctx.goal.slice(0, 60).replace(/\s+/g, "_")}`,
            title: ctx.goal.slice(0, 120),
            summary: String(finalResp.text).slice(0, 400),
            payload: { run_id: runId, tools: steps.map((s: any) => s?.tool).filter(Boolean), geo: geo.label },
            scope: ctx.workspaceId ? "workspace" : "user",
            userId: ctx.workspaceId ? null : ctx.userId,
            workspaceId: ctx.workspaceId || null,
            confidence: conf,
            reliability: conf,
            importance: 55,
          },
          settings.knowledge.freshness_days,
        );
      } catch {}
    }


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

async function callGateway(apiKey: string, model: string, messages: any[], opts: { signal?: AbortSignal; registry?: any[] } = {}): Promise<{ text: string; tokens: number; usd: number }> {
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
  // Part 12 — real pricing from the model registry when governance provides it.
  const usd = opts.registry?.length
    ? costOf(model, inTok, outTok, opts.registry as any)
    : inTok * 1.25e-6 + outTok * 10e-6; // legacy estimate ($1.25/M in, $10/M out)
  return { text, tokens, usd };
}
