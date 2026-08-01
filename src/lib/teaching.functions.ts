// Prompt 22 — "Teach Once, Work Forever"™ server functions (RPC).
// Thin wrappers only: every runtime helper lives in teaching.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// ===== Spaces ==============================================================
export const listKnowledgeSpaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("knowledge_spaces")
      .select("*")
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
    const { supabase } = context as any;
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.name) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.lang) patch.lang = data.lang;
    if (data.status) patch.status = data.status;
    if (data.inheritance) patch.inheritance = data.inheritance;
    if (data.policies) patch.policies = data.policies;
    if (data.brandIdentity) patch.brand_identity = data.brandIdentity;
    const { error } = await supabase.from("knowledge_spaces").update(patch).eq("id", data.spaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteKnowledgeSpace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { spaceId: string }) => z.object({ spaceId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("knowledge_spaces").delete().eq("id", data.spaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Assets ==============================================================
export const listSpaceAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { spaceId: string }) => z.object({ spaceId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
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
    const { userId } = context as any;
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
    const { supabase } = context as any;
    const { data: asset } = await supabase
      .from("knowledge_space_assets").select("id, space_id, file_path").eq("id", data.assetId).maybeSingle();
    if (!asset) throw new Error("not_found");
    if (asset.file_path) {
      await supabase.storage.from("knowledge-spaces").remove([asset.file_path]);
    }
    const { error } = await supabase.from("knowledge_space_assets").delete().eq("id", data.assetId);
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
        .from("knowledge_space_assets").select("id, space_id").eq("id", data.assetId).maybeSingle();
      if (!asset) throw new Error("not_found");
      spaceId = asset.space_id;
      await supabase.from("knowledge_space_assets").update({
        approved: data.approved,
        needs_approval: !data.approved,
        approved_at: data.approved ? now : null,
        status: data.approved ? "learned" : "needs_approval",
        stage: data.approved ? "institutional_learning" : "approval",
      }).eq("id", data.assetId);
      // Cascade to the nodes learned from this asset.
      const { data: nodes } = await supabase
        .from("knowledge_nodes").select("id, payload").eq("space_id", asset.space_id).eq("user_id", userId);
      for (const n of (nodes || [])) {
        if ((n.payload as any)?.asset_id === data.assetId) {
          await supabase.from("knowledge_nodes").update({ approved: data.approved }).eq("id", n.id);
        }
      }
    }
    if (data.nodeId) {
      const { data: node } = await supabase.from("knowledge_nodes").select("space_id").eq("id", data.nodeId).maybeSingle();
      spaceId = node?.space_id ?? spaceId;
      await supabase.from("knowledge_nodes").update({ approved: data.approved }).eq("id", data.nodeId);
    }
    if (data.promptId) {
      const { data: p } = await supabase.from("knowledge_space_prompts").select("space_id").eq("id", data.promptId).maybeSingle();
      spaceId = p?.space_id ?? spaceId;
      await supabase.from("knowledge_space_prompts").update({ approved: data.approved }).eq("id", data.promptId);
    }
    if (spaceId) {
      const { refreshSpaceMetrics } = await import("@/lib/maaroof/teaching.server");
      await refreshSpaceMetrics(spaceId);
    }
    return { ok: true };
  });

// ===== Interview mode ======================================================
export const generateSpaceInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { spaceId: string }) => z.object({ spaceId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: space } = await supabase
      .from("knowledge_spaces").select("id, name, lang, metrics, space_dna, brand_identity").eq("id", data.spaceId).maybeSingle();
    if (!space) throw new Error("not_found");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
    const { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders, extractJsonObject } = await import("@/lib/lovable-ai");
    const res = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: lovableAiHeaders(apiKey),
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.4,
        messages: [
          { role: "system", content: `You design short adaptive interview questions that close knowledge gaps for MAAROOF's institutional learning. Return STRICT JSON: {"questions":["..."]} — 4 to 8 questions, in the space language, each answerable in 1-3 sentences. Ask only about knowledge that is missing.` },
          { role: "user", content: `Space: ${space.name}\nLanguage: ${space.lang}\nMetrics: ${JSON.stringify(space.metrics || {}).slice(0, 1500)}\nDNA: ${JSON.stringify(space.space_dna || {}).slice(0, 1500)}\nBrand: ${JSON.stringify(space.brand_identity || {}).slice(0, 1500)}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI gateway ${res.status}`);
    const json: any = await res.json();
    const parsed = extractJsonObject<{ questions: string[] }>(json?.choices?.[0]?.message?.content);
    const questions = (parsed?.questions || []).slice(0, 8);
    for (const q of questions) {
      await supabase.from("knowledge_space_interviews").insert({
        space_id: data.spaceId, user_id: userId, question: String(q).slice(0, 1000), topic: "gap",
      });
    }
    return { questions };
  });

export const answerSpaceInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { interviewId: string; answer: string }) =>
    z.object({ interviewId: uuid, answer: z.string().min(1).max(8000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: row } = await supabase
      .from("knowledge_space_interviews").select("id, space_id, question").eq("id", data.interviewId).maybeSingle();
    if (!row) throw new Error("not_found");

    await supabase.from("knowledge_space_interviews")
      .update({ answer: data.answer, answered_at: new Date().toISOString() }).eq("id", data.interviewId);

    // The answer itself is knowledge — register it as a text asset and learn it.
    const { data: asset } = await supabase.from("knowledge_space_assets").insert({
      space_id: row.space_id, user_id: userId, kind: "interview", source_type: "text",
      title: `مقابلة: ${String(row.question).slice(0, 120)}`,
      raw_text: `س: ${row.question}\nج: ${data.answer}`,
      status: "queued", stage: "import",
    }).select("id").single();

    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey && asset?.id) {
      const { ingestAsset } = await import("@/lib/maaroof/teaching.server");
      const result = await ingestAsset({ apiKey, assetId: asset.id, userId });
      return { ok: true, result };
    }
    return { ok: true };
  });

// ===== Dashboard / supervision ============================================
export const getSpaceDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { spaceId: string }) => z.object({ spaceId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: space } = await supabase
      .from("knowledge_spaces").select("*").eq("id", data.spaceId).maybeSingle();
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
    const { supabase } = context as any;
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
