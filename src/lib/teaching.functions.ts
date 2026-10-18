// Prompt 22 — "Teach Once, Work Forever"™ server functions (RPC).
// Thin wrappers only: every runtime helper lives in teaching.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ENGINE_KEYS, ENGINE_CATALOG, ENGINE_PERSONA, type EngineKey } from "@/lib/ai-engines";

const uuid = z.string().uuid();

// Defense in depth: every user-facing operation must act only on a space owned
// by the authenticated user, even if a database policy is accidentally loosened.
async function assertOwnedSpace(supabase: any, spaceId: string, userId: string) {
  const { data: space, error } = await supabase
    .from("knowledge_spaces")
    .select("id")
    .eq("id", spaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !space) throw new Error("not_found");
  return space;
}

// ===== Spaces ==============================================================
export const listKnowledgeSpaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data, error } = await supabase
      .from("knowledge_spaces")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { spaces: data || [] };
  });

export const createKnowledgeSpace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; description?: string; lang?: string; workspaceId?: string | null }) =>
    z.object({
      name: z.string().min(2).max(120),
      description: z.string().max(2000).optional(),
      lang: z.enum(["ar", "en", "ku"]).optional(),
      workspaceId: uuid.nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (data.workspaceId) {
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("id", data.workspaceId)
        .eq("owner_id", userId)
        .maybeSingle();
      if (!workspace) throw new Error("workspace_not_found");
    }
    const { data: row, error } = await supabase
      .from("knowledge_spaces")
      .insert({
        user_id: userId,
        workspace_id: data.workspaceId ?? null,
        name: data.name,
        description: data.description ?? null,
        lang: data.lang || "ar",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { space: row };
  });

export const updateKnowledgeSpace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    spaceId: string; name?: string; description?: string; lang?: string;
    status?: string; inheritance?: Record<string, any>; policies?: Record<string, any>;
    brandIdentity?: Record<string, any>;
  }) =>
    z.object({
      spaceId: uuid,
      name: z.string().min(2).max(120).optional(),
      description: z.string().max(2000).optional(),
      lang: z.enum(["ar", "en", "ku"]).optional(),
      status: z.enum(["active", "paused", "archived"]).optional(),
      inheritance: z.record(z.string(), z.any()).optional(),
      policies: z.record(z.string(), z.any()).optional(),
      brandIdentity: z.record(z.string(), z.any()).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertOwnedSpace(supabase, data.spaceId, userId);
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.name) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.lang) patch.lang = data.lang;
    if (data.status) patch.status = data.status;
    if (data.inheritance) patch.inheritance = data.inheritance;
    if (data.policies) patch.policies = data.policies;
    if (data.brandIdentity) patch.brand_identity = data.brandIdentity;
    const { error } = await supabase.from("knowledge_spaces").update(patch).eq("id", data.spaceId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteKnowledgeSpace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { spaceId: string }) => z.object({ spaceId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertOwnedSpace(supabase, data.spaceId, userId);
    const { error } = await supabase.from("knowledge_spaces").delete().eq("id", data.spaceId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Assets ==============================================================
export const listSpaceAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { spaceId: string }) => z.object({ spaceId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertOwnedSpace(supabase, data.spaceId, userId);
    const [assets, prompts, interviews, nodes] = await Promise.all([
      supabase.from("knowledge_space_assets")
        .select("id, title, kind, source_type, source_url, file_path, mime_type, size_bytes, status, stage, stages, classification, extracted, confidence, evidence_score, reality_score, verification_score, conflicts, needs_approval, approved, nodes_created, error, created_at")
        .eq("space_id", data.spaceId).order("created_at", { ascending: false }).limit(200),
      supabase.from("knowledge_space_prompts")
        .select("id, title, intent, structure, prompt_dna, quality, approved, created_at")
        .eq("space_id", data.spaceId).order("quality", { ascending: false }).limit(100),
      supabase.from("knowledge_space_interviews")
        .select("id, question, topic, answer, answered_at, created_at")
        .eq("space_id", data.spaceId).order("created_at", { ascending: false }).limit(60),
      supabase.from("knowledge_nodes")
        .select("id, title, summary, layer, payload, confidence, quality, approved, updated_at")
        .eq("space_id", data.spaceId).order("quality", { ascending: false }).limit(120),
    ]);
    return {
      assets: assets.data || [],
      prompts: prompts.data || [],
      interviews: interviews.data || [],
      nodes: nodes.data || [],
    };
  });

/** Register an uploaded file (already in storage) or a URL / pasted text asset. */
export const registerSpaceAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    spaceId: string; title: string; sourceType: "file" | "url" | "text";
    filePath?: string; sourceUrl?: string; text?: string; mimeType?: string; sizeBytes?: number; kind?: string;
  }) =>
    z.object({
      spaceId: uuid,
      title: z.string().min(1).max(300),
      sourceType: z.enum(["file", "url", "text"]),
      filePath: z.string().max(500).optional(),
      sourceUrl: z.string().url().max(2000).optional(),
      text: z.string().max(200_000).optional(),
      mimeType: z.string().max(150).optional(),
      sizeBytes: z.number().int().nonnegative().optional(),
      kind: z.string().max(60).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertOwnedSpace(supabase, data.spaceId, userId);
    if (data.sourceType === "file" && !data.filePath) throw new Error("filePath required");
    if (data.sourceType === "url" && !data.sourceUrl) throw new Error("sourceUrl required");
    if (data.sourceType === "text" && !data.text?.trim()) throw new Error("text required");
    if (data.filePath && !String(data.filePath).startsWith(`${userId}/`)) throw new Error("invalid path");
    const { data: row, error } = await supabase.from("knowledge_space_assets").insert({
      space_id: data.spaceId,
      user_id: userId,
      kind: data.kind || "document",
      source_type: data.sourceType,
      title: data.title,
      file_path: data.filePath ?? null,
      source_url: data.sourceUrl ?? null,
      raw_text: data.sourceType === "text" ? data.text : null,
      mime_type: data.mimeType ?? null,
      size_bytes: data.sizeBytes ?? null,
      status: "queued",
      stage: "import",
    }).select("id, title, status, stage, created_at").single();
    if (error) throw new Error(error.message);
    return { asset: row };
  });

/** Run (or resume) the learning pipeline for one asset. Metered per run. */
export const learnSpaceAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { assetId: string }) => z.object({ assetId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: asset } = await supabase
      .from("knowledge_space_assets")
      .select("id, space_id")
      .eq("id", data.assetId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!asset) throw new Error("not_found");
    await assertOwnedSpace(supabase, asset.space_id, userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const { chargeTokens, chargeFailureBody } = await import("@/lib/tokens.server");
    const charge = await chargeTokens({ userId, toolKey: "teach_space", meta: { asset_id: data.assetId } });
    if (!charge.ok) {
      return { ok: false, billing: chargeFailureBody(charge.reason as any, (charge as any).left) };
    }

    const { ingestAsset } = await import("@/lib/maaroof/teaching.server");
    const result = await ingestAsset({ apiKey, assetId: data.assetId, userId });
    return { ok: result.ok, result, cost: { tokens: charge.tokens, usd: charge.usd } };
  });

export const deleteSpaceAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { assetId: string }) => z.object({ assetId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: asset } = await supabase
      .from("knowledge_space_assets")
      .select("id, space_id, file_path")
      .eq("id", data.assetId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!asset) throw new Error("not_found");
    await assertOwnedSpace(supabase, asset.space_id, userId);
    if (asset.file_path) {
      await supabase.storage.from("knowledge-spaces").remove([asset.file_path]);
    }
    const { error } = await supabase.from("knowledge_space_assets").delete().eq("id", data.assetId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    const { refreshSpaceMetrics } = await import("@/lib/maaroof/teaching.server");
    await refreshSpaceMetrics(asset.space_id);
    return { ok: true };
  });

// ===== Approval ============================================================
export const approveSpaceKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { assetId?: string; nodeId?: string; promptId?: string; approved: boolean }) =>
    z.object({
      assetId: uuid.optional(),
      nodeId: uuid.optional(),
      promptId: uuid.optional(),
      approved: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const now = new Date().toISOString();
    let spaceId: string | null = null;

    if (data.assetId) {
      const { data: asset } = await supabase
        .from("knowledge_space_assets").select("id, space_id").eq("id", data.assetId).eq("user_id", userId).maybeSingle();
      if (!asset) throw new Error("not_found");
      spaceId = asset.space_id;
      await supabase.from("knowledge_space_assets").update({
        approved: data.approved,
        needs_approval: !data.approved,
        approved_at: data.approved ? now : null,
        status: data.approved ? "learned" : "needs_approval",
        stage: data.approved ? "institutional_learning" : "approval",
      }).eq("id", data.assetId).eq("user_id", userId);
      // Cascade to the nodes learned from this asset.
      const { data: nodes } = await supabase
        .from("knowledge_nodes").select("id, payload").eq("space_id", asset.space_id).eq("user_id", userId);
      for (const n of (nodes || [])) {
        if ((n.payload as any)?.asset_id === data.assetId) {
          await supabase.from("knowledge_nodes").update({ approved: data.approved }).eq("id", n.id).eq("user_id", userId);
        }
      }
    }
    if (data.nodeId) {
      const { data: node } = await supabase.from("knowledge_nodes").select("space_id").eq("id", data.nodeId).eq("user_id", userId).maybeSingle();
      spaceId = node?.space_id ?? spaceId;
      await supabase.from("knowledge_nodes").update({ approved: data.approved }).eq("id", data.nodeId).eq("user_id", userId);
    }
    if (data.promptId) {
      const { data: p } = await supabase.from("knowledge_space_prompts").select("space_id").eq("id", data.promptId).eq("user_id", userId).maybeSingle();
      spaceId = p?.space_id ?? spaceId;
      await supabase.from("knowledge_space_prompts").update({ approved: data.approved }).eq("id", data.promptId).eq("user_id", userId);
    }
    if (spaceId) {
      const { refreshSpaceMetrics } = await import("@/lib/maaroof/teaching.server");
      await refreshSpaceMetrics(spaceId);
    }
    return { ok: true };
  });

// ===== Interview mode: ten engine perspectives ============================
export const generateSpaceInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { spaceId: string }) => z.object({ spaceId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: space } = await supabase
      .from("knowledge_spaces")
      .select("id, name, lang, metrics, space_dna, brand_identity")
      .eq("id", data.spaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!space) throw new Error("not_found");

    // Include knowledge already learned in this space and previous answers,
    // so the ten perspectives target real gaps rather than repeat questions.
    const [{ data: nodes }, { data: priorInterviews }] = await Promise.all([
      supabase
        .from("knowledge_nodes")
        .select("title, summary, payload, confidence, status")
        .eq("space_id", data.spaceId)
        .eq("user_id", userId)
        .limit(30),
      supabase
        .from("knowledge_space_interviews")
        .select("question, answer, topic")
        .eq("space_id", data.spaceId)
        .eq("user_id", userId)
        .limit(30),
    ]);
    const knownContext = ((nodes || []) as any[])
      .map((node) => {
        const payload = node.payload && typeof node.payload === "object"
          ? JSON.stringify(node.payload).slice(0, 160)
          : "";
        return [node.title, node.summary, payload, node.confidence != null ? `confidence: ${node.confidence}` : ""]
          .filter(Boolean)
          .join(" — ");
      })
      .join("\n")
      .slice(0, 1800);
    const priorContext = ((priorInterviews || []) as any[])
      .map((row) => `Q: ${String(row.question || "").slice(0, 240)}\nA: ${String(row.answer || "(unanswered)").slice(0, 240)}`)
      .join("\n")
      .slice(0, 1400);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
    const {
      LOVABLE_AI_CHAT_COMPLETIONS_URL,
      lovableAiHeaders,
      extractJsonObject,
    } = await import("@/lib/lovable-ai");

    // Load server-only model governance only inside the handler so this
    // client-safe RPC module does not pull server code into the browser bundle.
    const { resolveEngineModels } = await import("@/lib/ai-engines.server");

    // Resolve models through the existing governance layer. A failed model
    // must not prevent the other engine perspectives from returning.
    const engines = [...ENGINE_KEYS] as EngineKey[];
    const models = await resolveEngineModels(engines);
    const language = String(space.lang || "ar");
    const languageInstruction: Record<string, string> = {
      ar: "Write the question in clear Arabic.",
      en: "Write the question in clear English.",
      ku: "پرسیارەکە بە کوردیی سۆرانیی ڕوون بنووسە.",
    };
    const contextBlock = [
      `Knowledge space: ${String(space.name || "").slice(0, 300)}`,
      `Language: ${language}`,
      `Metrics: ${JSON.stringify(space.metrics || {}).slice(0, 700)}`,
      `Knowledge DNA: ${JSON.stringify(space.space_dna || {}).slice(0, 700)}`,
      `Brand identity: ${JSON.stringify(space.brand_identity || {}).slice(0, 700)}`,
      `Known learning: ${knownContext || "(no learned nodes yet)"}`,
      `Previous interview: ${priorContext || "(no prior interview)"}`,
    ].join("\n");

    const results = await Promise.all(engines.map(async (engine) => {
      const definition = ENGINE_CATALOG[engine];
      const model = String(models[engine]?.model || definition.defaultModel);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const reasoning = /^openai\//.test(model) || /gemini-2\.5-pro|gemini-3/.test(model)
          ? { reasoning_effort: "low" }
          : {};
        const response = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: lovableAiHeaders(apiKey),
          signal: controller.signal,
          body: JSON.stringify({
            model,
            max_tokens: 800,
            temperature: 0.35,
            ...reasoning,
            messages: [
              {
                role: "system",
                content: `You are evaluating missing knowledge for a private knowledge space. Perspective: ${ENGINE_PERSONA[engine]}.
Return strict JSON only: {"questions":["one question"]}.
Generate exactly ONE precise, high-value interview question that closes a real knowledge gap. Avoid questions already answered by the supplied context. Ask about an operational rule, decision rationale, process, identity, quality standard, or missing evidence. The question must be answerable by the space owner in 1–3 sentences. ${languageInstruction[language] || languageInstruction.ar}
Do not return commentary, markdown, or a second question.`,
              },
              {
                role: "user",
                content: `${contextBlock}\n\nGenerate one adaptive question from your assigned perspective.`,
              },
            ],
          }),
        });
        if (!response.ok) {
          return { key: engine, name: definition.name, proxy: definition.proxy, status: "error" as const, questionsCount: 0 };
        }
        const payload: any = await response.json();
        const raw = String(payload?.choices?.[0]?.message?.content || "");
        const parsed = extractJsonObject<{ questions?: unknown }>(raw);
        const questions = Array.isArray(parsed?.questions)
          ? Array.from(new Set(parsed.questions.map((q: unknown) => String(q || "").trim()).filter((q: string) => q.length >= 8)))
              .slice(0, 1)
          : [];
        if (!questions.length) {
          return { key: engine, name: definition.name, proxy: definition.proxy, status: "empty" as const, questionsCount: 0 };
        }

        const { error: insertError } = await supabase
          .from("knowledge_space_interviews")
          .insert(questions.map((question) => ({
            space_id: data.spaceId,
            user_id: userId,
            question: question.slice(0, 1000),
            topic: `engine:${engine}`,
          })));
        if (insertError) {
          return { key: engine, name: definition.name, proxy: definition.proxy, status: "error" as const, questionsCount: 0 };
        }
        return { key: engine, name: definition.name, proxy: definition.proxy, status: "answered" as const, questionsCount: questions.length };
      } catch (error: any) {
        return {
          key: engine,
          name: definition.name,
          proxy: definition.proxy,
          status: error?.name === "AbortError" ? "timeout" as const : "error" as const,
          questionsCount: 0,
        };
      } finally {
        clearTimeout(timeout);
      }
    }));

    return {
      questions: results.reduce((total, result) => total + result.questionsCount, 0),
      engines: results,
    };
  });

// ===== Dashboard / supervision ============================================
export const getSpaceDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { spaceId: string }) => z.object({ spaceId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: space } = await supabase
      .from("knowledge_spaces").select("*").eq("id", data.spaceId).eq("user_id", userId).maybeSingle();
    if (!space) throw new Error("not_found");
    const { refreshSpaceMetrics, learningGapReport } = await import("@/lib/maaroof/teaching.server");
    const metrics = await refreshSpaceMetrics(data.spaceId);
    const report = await learningGapReport(userId);
    return {
      space,
      metrics,
      proposals: report.proposals.filter((p: any) => p.space_id === data.spaceId),
    };
  });

// ===== Agent access rules =================================================
export const setSpaceAgentAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { spaceId: string; agentId?: string | null; agentRole?: string | null; inherit: boolean; accessLevel?: string }) =>
    z.object({
      spaceId: uuid,
      agentId: uuid.nullable().optional(),
      agentRole: z.string().max(60).nullable().optional(),
      inherit: z.boolean(),
      accessLevel: z.enum(["read", "full"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertOwnedSpace(supabase, data.spaceId, userId);
    const { error } = await supabase.from("knowledge_space_agents").insert({
      space_id: data.spaceId,
      agent_id: data.agentId ?? null,
      agent_role: data.agentRole ?? null,
      inherit: data.inherit,
      access_level: data.accessLevel || "read",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
