// Prompt 22 — "Teach Once, Work Forever"™ learning engine (server helpers).
//
// EVOLUTION, NOT DUPLICATION (documented decision):
//   The platform already owns every downstream layer this capability needs —
//   `knowledge_nodes`/`knowledge_edges` (9-layer graph, confidence/quality/
//   freshness), `maaroof_memory` (episodic), `platform_dna` + `hermes_founder_dna`
//   (patterns), `evidence_items` + `reality_records` + `trust_profiles`
//   (evidence/verification/trust), `maaroof_agents` (sub-agents), `hermes_tasks`
//   (supervision) and `tool_pricing_catalog` (costs).
//   What did NOT exist is the *container*: a Knowledge Space with its own files,
//   prompts, DNA, brand identity, allowed agents and independent permissions,
//   plus the import → understand → verify → approve → institutionalize pipeline.
//   This module adds only that missing layer and feeds the existing engines.
//   Nothing here removes or replaces any prior capability.

import { createClient } from "@supabase/supabase-js";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders, FACTUAL_SAFETY_PROMPT, extractJsonObject } from "@/lib/lovable-ai";
import { upsertKnowledgeNode, linkKnowledge, type KnowledgeLayer } from "@/lib/maaroof/knowledge.server";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db as any;
}

export const TEACH_TOOL_KEY = "teach_space";
export const TEACH_BUCKET = "knowledge-spaces";

/** Learning pipeline, in constitutional order. */
export const LEARNING_PIPELINE = [
  "import",
  "classification",
  "understanding",
  "knowledge_extraction",
  "evidence_detection",
  "duplicate_detection",
  "conflict_detection",
  "relationship_discovery",
  "graph_linking",
  "verification",
  "reality_validation",
  "approval",
  "institutional_learning",
] as const;
export type LearningStage = (typeof LEARNING_PIPELINE)[number];

/** What Maaroof is allowed to learn about a person / an organization. */
export const UNDERSTANDING_DIMENSIONS = [
  "professional_skills", "business_knowledge", "writing_style", "communication_style",
  "prompt_engineering_style", "architecture_philosophy", "leadership_style", "decision_style",
  "marketing_strategy", "seo_strategy", "geo_strategy", "aso_strategy", "brand_identity",
  "business_rules", "personal_preferences", "operational_philosophy", "problem_solving_style",
  "creative_style", "technical_style", "documentation_style", "quality_standards",
  "approval_rules", "thinking_methodology", "custom_frameworks", "institutional_methodologies",
] as const;
export type UnderstandingDimension = (typeof UNDERSTANDING_DIMENSIONS)[number];

/** Trust classification for every learned concept. */
export const KNOWLEDGE_CLASSES = [
  "verified_knowledge", "claim", "opinion", "preference", "policy",
  "evidence", "historical_record", "business_rule", "prompt_knowledge",
  "institutional_knowledge",
] as const;
export type KnowledgeClass = (typeof KNOWLEDGE_CLASSES)[number];

const CLASS_RELIABILITY: Record<string, number> = {
  verified_knowledge: 90, evidence: 85, historical_record: 75, policy: 80,
  business_rule: 80, institutional_knowledge: 70, prompt_knowledge: 65,
  preference: 60, claim: 45, opinion: 35,
};

/** Classes that must not become institutional knowledge without the owner's OK. */
const NEEDS_APPROVAL: KnowledgeClass[] = ["policy", "business_rule", "institutional_knowledge", "claim"];

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

export type ExtractedConcept = {
  title: string;
  summary: string;
  dimension: UnderstandingDimension | string;
  knowledge_class: KnowledgeClass | string;
  confidence: number;
  tags?: string[];
  detail?: string;
};

export type ExtractionResult = {
  doc_type: string;
  language: string;
  summary: string;
  concepts: ExtractedConcept[];
  prompts: Array<{ title: string; body: string; intent?: string; structure?: any; prompt_dna?: any; quality?: number }>;
  brand: Record<string, any> | null;
  dna: Record<string, any> | null;
  gaps: string[];
  interview_questions: string[];
};

const EMPTY_EXTRACTION: ExtractionResult = {
  doc_type: "unknown", language: "ar", summary: "", concepts: [], prompts: [],
  brand: null, dna: null, gaps: [], interview_questions: [],
};

// ---------------------------------------------------------------------------
// Model call
// ---------------------------------------------------------------------------

async function chat(apiKey: string, messages: any[], model = "google/gemini-2.5-flash"): Promise<string> {
  const res = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: lovableAiHeaders(apiKey),
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI gateway ${res.status}: ${body.slice(0, 400)}`);
  }
  const json: any = await res.json();
  return String(json?.choices?.[0]?.message?.content ?? "");
}

const UNDERSTAND_SYSTEM = `You are MAAROOF's institutional learning engine ("Teach Once, Work Forever").
You do not store documents — you UNDERSTAND them and turn them into reusable professional knowledge.
${FACTUAL_SAFETY_PROMPT}

Return STRICT JSON only:
{
  "doc_type": "<playbook|policy|sop|brand_guidelines|prompt_library|writing_sample|research|marketing|technical|api_doc|architecture|case_study|portfolio|cv|contract|other>",
  "language": "ar|en|ku|other",
  "summary": "<3-6 sentences describing what this asset teaches>",
  "concepts": [
    { "title": "...", "summary": "...", "detail": "...",
      "dimension": "<one of the understanding dimensions>",
      "knowledge_class": "<verified_knowledge|claim|opinion|preference|policy|evidence|historical_record|business_rule|prompt_knowledge|institutional_knowledge>",
      "confidence": 0-100, "tags": ["..."] }
  ],
  "prompts": [ { "title": "...", "body": "...", "intent": "...",
      "structure": { "role": "...", "context": "...", "task": "...", "constraints": "...", "output": "..." },
      "prompt_dna": { "reasoning": "...", "patterns": ["..."], "optimizations": ["..."], "reusable_logic": "..." },
      "quality": 0-100 } ],
  "brand": { "mission": "", "vision": "", "identity": "", "voice": "", "audience": "", "products": [], "services": [], "marketing_style": "", "rules": [], "restrictions": [], "values": [] },
  "dna": { "writing_style": "", "communication_style": "", "decision_style": "", "thinking_methodology": "", "quality_standards": "", "frameworks": [] },
  "gaps": ["knowledge that is clearly missing"],
  "interview_questions": ["short adaptive questions to close the gaps"]
}
Rules:
- Extract 3-14 concepts. Never invent facts that are not in the asset.
- Only fill "brand" when the asset really carries brand knowledge, otherwise null.
- Only fill "dna" when the asset reveals how the person writes/decides/thinks, otherwise null.
- When the asset is a prompt collection, analyse each prompt's structure and reasoning — do not just copy it.`;

/** Understand one asset's text (already extracted) into structured knowledge. */
export async function understandText(opts: {
  apiKey: string;
  title: string;
  text: string;
  spaceName?: string;
  brandContext?: Record<string, any> | null;
  lang?: string;
}): Promise<ExtractionResult> {
  const text = String(opts.text || "").slice(0, 60_000);
  if (!text.trim()) return { ...EMPTY_EXTRACTION };
  const raw = await chat(opts.apiKey, [
    { role: "system", content: UNDERSTAND_SYSTEM },
    {
      role: "user",
      content:
        `Knowledge space: ${opts.spaceName || "-"}\n` +
        (opts.brandContext && Object.keys(opts.brandContext).length
          ? `Known brand context: ${JSON.stringify(opts.brandContext).slice(0, 1500)}\n`
          : "") +
        `Asset title: ${opts.title}\nPreferred output language: ${opts.lang || "ar"}\n\n--- ASSET TEXT ---\n${text}`,
    },
  ]);
  const parsed = extractJsonObject<ExtractionResult>(raw);
  if (!parsed) return { ...EMPTY_EXTRACTION };
  return {
    ...EMPTY_EXTRACTION,
    ...parsed,
    concepts: Array.isArray(parsed.concepts) ? parsed.concepts.slice(0, 20) : [],
    prompts: Array.isArray(parsed.prompts) ? parsed.prompts.slice(0, 30) : [],
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 12) : [],
    interview_questions: Array.isArray(parsed.interview_questions) ? parsed.interview_questions.slice(0, 8) : [],
  };
}

/** Multimodal fallback: pull raw text out of a binary asset (PDF / image / audio). */
export async function extractTextFromBinary(opts: {
  apiKey: string;
  base64: string;
  mime: string;
  filename: string;
}): Promise<string> {
  const isImage = opts.mime.startsWith("image/");
  const isAudio = opts.mime.startsWith("audio/");
  const model = isAudio ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
  const block = isImage
    ? { type: "image_url", image_url: { url: `data:${opts.mime};base64,${opts.base64}` } }
    : isAudio
      ? { type: "input_audio", input_audio: { data: opts.base64, format: opts.mime.split("/")[1]?.replace("mpeg", "mp3") || "mp3" } }
      : { type: "file", file: { filename: opts.filename, file_data: `data:${opts.mime};base64,${opts.base64}` } };
  const raw = await chat(
    opts.apiKey,
    [
      { role: "system", content: "Transcribe the supplied asset into clean plain text. Preserve headings, lists and tables as markdown. Output text only — no commentary." },
      { role: "user", content: [{ type: "text", text: `File: ${opts.filename}` }, block] as any },
    ],
    model,
  );
  return raw;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

function dimensionLayer(dimension: string): KnowledgeLayer {
  if (dimension === "brand_identity" || dimension === "marketing_strategy") return "workspace";
  if (dimension === "prompt_engineering_style") return "tool";
  if (dimension === "institutional_methodologies") return "platform";
  return "user";
}

/** Cheap lexical fingerprint used for duplicate / conflict detection. */
function fingerprint(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 24)
    .join(" ");
}

function similarity(a: string, b: string): number {
  const A = new Set(fingerprint(a).split(" "));
  const B = new Set(fingerprint(b).split(" "));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.max(A.size, B.size);
}

export type IngestOutcome = {
  ok: boolean;
  assetId: string;
  status: string;
  stage: LearningStage;
  nodes: number;
  prompts: number;
  duplicates: number;
  conflicts: number;
  needs_approval: boolean;
  confidence: number;
  evidence_score: number;
  reality_score: number;
  verification_score: number;
  gaps: string[];
  interview_questions: string[];
  error?: string;
};

/**
 * Run the full learning pipeline for one asset. Resumable: the current stage is
 * persisted on the asset row so a retry continues instead of restarting.
 */
export async function ingestAsset(opts: {
  apiKey: string;
  assetId: string;
  userId: string;
}): Promise<IngestOutcome> {
  const base: IngestOutcome = {
    ok: false, assetId: opts.assetId, status: "failed", stage: "import", nodes: 0, prompts: 0,
    duplicates: 0, conflicts: 0, needs_approval: false, confidence: 0,
    evidence_score: 0, reality_score: 0, verification_score: 0, gaps: [], interview_questions: [],
  };

  const { data: asset } = await db()
    .from("knowledge_space_assets").select("*").eq("id", opts.assetId).maybeSingle();
  if (!asset || asset.user_id !== opts.userId) return { ...base, error: "asset_not_found" };

  const { data: space } = await db()
    .from("knowledge_spaces").select("*").eq("id", asset.space_id).maybeSingle();
  if (!space) return { ...base, error: "space_not_found" };

  const stages: any[] = [];
  const mark = async (stage: LearningStage, note = "") => {
    stages.push({ stage, at: new Date().toISOString(), note });
    await db().from("knowledge_space_assets")
      .update({ stage, status: "processing", stages }).eq("id", asset.id);
  };

  try {
    await mark("import");

    // ---- text acquisition -------------------------------------------------
    let text: string = String(asset.raw_text || "");
    if (!text.trim() && asset.file_path) {
      const dl = await db().storage.from(TEACH_BUCKET).download(asset.file_path);
      if (dl.error) throw new Error(`download: ${dl.error.message}`);
      const buf = new Uint8Array(await dl.data.arrayBuffer());
      const mime = String(asset.mime_type || "application/octet-stream");
      const textual = /^(text\/|application\/(json|xml|x-ndjson))/.test(mime);
      if (textual) {
        text = new TextDecoder().decode(buf);
      } else {
        let b64 = "";
        const CH = 0x8000;
        for (let i = 0; i < buf.length; i += CH) b64 += String.fromCharCode(...buf.subarray(i, i + CH));
        b64 = btoa(b64);
        text = await extractTextFromBinary({ apiKey: opts.apiKey, base64: b64, mime, filename: asset.title });
      }
    }
    if (!text.trim() && asset.source_url) {
      const { fetchFirecrawl } = await import("@/lib/maaroof/teaching-web.server");
      text = await fetchFirecrawl(asset.source_url);
    }
    if (!text.trim()) throw new Error("no_extractable_text");

    await mark("classification");
    const extraction = await understandText({
      apiKey: opts.apiKey,
      title: asset.title,
      text,
      spaceName: space.name,
      brandContext: space.brand_identity,
      lang: space.lang,
    });
    await mark("understanding", extraction.doc_type);
    await mark("knowledge_extraction", `${extraction.concepts.length} concept(s)`);

    // ---- evidence detection ----------------------------------------------
    const { recordEvidence } = await import("@/lib/maaroof/evidence.server");
    const evidenceIds: string[] = [];
    for (const c of extraction.concepts.filter((x) => ["verified_knowledge", "evidence", "historical_record"].includes(String(x.knowledge_class)))) {
      const id = await recordEvidence({
        userId: opts.userId,
        workspaceId: space.workspace_id,
        title: c.title,
        claim: c.summary,
        sourceKind: asset.source_type === "url" ? "external_source" : "user_document",
        sourceRef: asset.source_url || asset.file_path || asset.title,
        evidenceType: String(c.knowledge_class) === "evidence" ? "documented" : "reported",
        category: "operational",
        sourceReliability: clamp(Number(c.confidence) || 50),
        businessValue: 60,
        language: space.lang,
      } as any);
      if (id) evidenceIds.push(id);
    }
    await mark("evidence_detection", `${evidenceIds.length} evidence item(s)`);

    // ---- duplicate + conflict detection ----------------------------------
    const { data: existing } = await db()
      .from("knowledge_nodes")
      .select("id, title, summary, node_key, payload")
      .eq("space_id", space.id)
      .limit(400);
    const prior = ((existing as any[]) || []);
    let duplicates = 0;
    const conflicts: any[] = [];
    const fresh: ExtractedConcept[] = [];
    for (const c of extraction.concepts) {
      const near = prior.find((p) => similarity(`${p.title} ${p.summary || ""}`, `${c.title} ${c.summary}`) > 0.75);
      if (near) {
        duplicates++;
        const priorClass = String((near.payload as any)?.knowledge_class || "");
        if (priorClass && priorClass !== String(c.knowledge_class)) {
          conflicts.push({ node_id: near.id, title: near.title, was: priorClass, now: c.knowledge_class });
        }
        // A duplicate still reinforces the node (confidence blending in upsert).
        fresh.push(c);
        continue;
      }
      fresh.push(c);
    }
    await mark("duplicate_detection", `${duplicates} duplicate(s)`);
    await mark("conflict_detection", `${conflicts.length} conflict(s)`);
    await mark("relationship_discovery");

    // ---- graph linking ---------------------------------------------------
    const needsApproval = fresh.some((c) => NEEDS_APPROVAL.includes(String(c.knowledge_class) as KnowledgeClass));
    const createdIds: string[] = [];
    for (const c of fresh) {
      const reliability = CLASS_RELIABILITY[String(c.knowledge_class)] ?? 50;
      const approved = !NEEDS_APPROVAL.includes(String(c.knowledge_class) as KnowledgeClass);
      const id = await upsertKnowledgeNode({
        layer: dimensionLayer(String(c.dimension)),
        key: `space:${space.id}:${fingerprint(c.title).slice(0, 60) || Math.random().toString(36).slice(2)}`,
        title: c.title,
        summary: c.summary,
        payload: {
          detail: c.detail || null,
          dimension: c.dimension,
          knowledge_class: c.knowledge_class,
          tags: c.tags || [],
          space_id: space.id,
          asset_id: asset.id,
          approved,
        },
        sources: [{ kind: asset.source_type, ref: asset.source_url || asset.file_path || asset.title, title: asset.title }],
        scope: "user",
        userId: opts.userId,
        workspaceId: space.workspace_id,
        confidence: clamp(Number(c.confidence) || 50),
        reliability,
        importance: 60,
        status: "validated",
      });
      if (id) {
        createdIds.push(id);
        await db().from("knowledge_nodes").update({ space_id: space.id, approved }).eq("id", id);
      }
    }
    // Concepts extracted from one asset are related by construction.
    for (let i = 1; i < createdIds.length; i++) await linkKnowledge(createdIds[0], createdIds[i], "co_learned", 1);
    await mark("graph_linking", `${createdIds.length} node(s)`);

    // ---- prompts (Prompt DNA) -------------------------------------------
    let promptCount = 0;
    for (const p of extraction.prompts) {
      if (!p?.body) continue;
      const { error } = await db().from("knowledge_space_prompts").insert({
        space_id: space.id, user_id: opts.userId, asset_id: asset.id,
        title: p.title || asset.title, body: String(p.body).slice(0, 12_000),
        intent: p.intent || null, structure: p.structure || {}, prompt_dna: p.prompt_dna || {},
        tags: [], quality: clamp(Number(p.quality) || 50), approved: false,
      });
      if (!error) promptCount++;
    }

    // ---- verification + reality -----------------------------------------
    const { verifyReality } = await import("@/lib/maaroof/verification.server");
    let verification: any = null;
    try {
      verification = await verifyReality({ subject: asset.title, language: space.lang });
    } catch {}
    await mark("verification", verification?.verdict || "-");

    const avgConfidence = fresh.length
      ? clamp(fresh.reduce((s, c) => s + (Number(c.confidence) || 50), 0) / fresh.length)
      : 0;
    const evidenceScore = clamp(evidenceIds.length * 18 + (extraction.doc_type !== "unknown" ? 15 : 0));
    const verificationScore = clamp(Number(verification?.score) || (evidenceScore * 0.6 + avgConfidence * 0.4));
    const realityScore = clamp(avgConfidence * 0.4 + evidenceScore * 0.3 + verificationScore * 0.3 - conflicts.length * 5);
    await mark("reality_validation", `reality ${realityScore}%`);

    // ---- trust event ----------------------------------------------------
    try {
      const { recordTrustEvent } = await import("@/lib/maaroof/trust.server");
      await recordTrustEvent({
        entityType: "tool",
        entityKey: TEACH_TOOL_KEY,
        userId: opts.userId,
        outcome: realityScore >= 55 ? "success" : "partial",
        score: realityScore,
        meta: { space_id: space.id, asset_id: asset.id, doc_type: extraction.doc_type },
      } as any);
    } catch {}

    // ---- approval + institutional learning ------------------------------
    await mark(needsApproval ? "approval" : "institutional_learning");

    // Interview questions for the gaps this asset revealed.
    for (const q of extraction.interview_questions) {
      await db().from("knowledge_space_interviews").insert({
        space_id: space.id, user_id: opts.userId, question: q, topic: extraction.doc_type,
      });
    }

    // Merge the space DNA / brand identity (accumulate, never overwrite).
    const nextDna = mergeDna(space.space_dna || {}, extraction.dna || {});
    const nextBrand = mergeDna(space.brand_identity || {}, extraction.brand || {});

    await db().from("knowledge_space_assets").update({
      status: needsApproval ? "needs_approval" : "learned",
      stage: needsApproval ? "approval" : "institutional_learning",
      stages,
      classification: { doc_type: extraction.doc_type, language: extraction.language, summary: extraction.summary },
      extracted: { concepts: fresh, gaps: extraction.gaps, prompts: promptCount },
      raw_text: text.slice(0, 200_000),
      confidence: avgConfidence,
      evidence_score: evidenceScore,
      reality_score: realityScore,
      verification_score: verificationScore,
      conflicts,
      needs_approval: needsApproval,
      approved: !needsApproval,
      approved_at: needsApproval ? null : new Date().toISOString(),
      nodes_created: createdIds.length,
      error: null,
    }).eq("id", asset.id);

    await refreshSpaceMetrics(space.id, { dna: nextDna, brand: nextBrand, gaps: extraction.gaps });

    return {
      ok: true, assetId: asset.id,
      status: needsApproval ? "needs_approval" : "learned",
      stage: needsApproval ? "approval" : "institutional_learning",
      nodes: createdIds.length, prompts: promptCount, duplicates, conflicts: conflicts.length,
      needs_approval: needsApproval, confidence: avgConfidence,
      evidence_score: evidenceScore, reality_score: realityScore, verification_score: verificationScore,
      gaps: extraction.gaps, interview_questions: extraction.interview_questions,
    };
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 500);
    await db().from("knowledge_space_assets")
      .update({ status: "failed", error: msg, stages }).eq("id", opts.assetId);
    return { ...base, error: msg };
  }
}

/** Accumulative DNA merge: new signal appends, existing signal is kept. */
export function mergeDna(prev: Record<string, any>, next: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...(prev || {}) };
  for (const [k, v] of Object.entries(next || {})) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) {
      const merged = new Set([...(Array.isArray(out[k]) ? out[k] : []), ...v.map((x) => String(x))]);
      out[k] = Array.from(merged).slice(0, 40);
    } else if (typeof v === "object") {
      out[k] = mergeDna(out[k] || {}, v as Record<string, any>);
    } else if (!out[k]) {
      out[k] = v;
    } else if (String(out[k]) !== String(v)) {
      const hist = Array.isArray(out[`${k}_history`]) ? out[`${k}_history`] : [];
      out[`${k}_history`] = Array.from(new Set([...hist, String(out[k])])).slice(-5);
      out[k] = v;
    }
  }
  return out;
}

/** Recompute the learning dashboard metrics for a space. */
export async function refreshSpaceMetrics(
  spaceId: string,
  patch?: { dna?: Record<string, any>; brand?: Record<string, any>; gaps?: string[] },
): Promise<Record<string, any>> {
  const [{ data: assets }, { data: nodes }, { data: prompts }] = await Promise.all([
    db().from("knowledge_space_assets").select("status, confidence, evidence_score, reality_score, verification_score, classification, created_at").eq("space_id", spaceId),
    db().from("knowledge_nodes").select("id, layer, confidence, quality, approved, payload").eq("space_id", spaceId),
    db().from("knowledge_space_prompts").select("id, quality").eq("space_id", spaceId),
  ]);
  const A = ((assets as any[]) || []);
  const N = ((nodes as any[]) || []);
  const P = ((prompts as any[]) || []);
  const avg = (xs: number[]) => (xs.length ? clamp(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
  const learned = A.filter((a) => a.status === "learned" || a.approved);
  const byDimension: Record<string, number> = {};
  for (const n of N) {
    const d = String((n.payload as any)?.dimension || "other");
    byDimension[d] = (byDimension[d] || 0) + 1;
  }
  const metrics = {
    documents_processed: A.length,
    documents_learned: learned.length,
    documents_pending: A.filter((a) => a.status === "needs_approval").length,
    documents_failed: A.filter((a) => a.status === "failed").length,
    knowledge_nodes: N.length,
    approved_nodes: N.filter((n) => n.approved !== false).length,
    prompts: P.length,
    prompt_quality: avg(P.map((p) => Number(p.quality) || 0)),
    confidence: avg(A.map((a) => Number(a.confidence) || 0)),
    evidence: avg(A.map((a) => Number(a.evidence_score) || 0)),
    reality: avg(A.map((a) => Number(a.reality_score) || 0)),
    verification: avg(A.map((a) => Number(a.verification_score) || 0)),
    node_quality: avg(N.map((n) => Number(n.quality) || 0)),
    by_dimension: byDimension,
    gaps: (patch?.gaps || []).slice(0, 12),
    updated_at: new Date().toISOString(),
  };
  const update: Record<string, any> = {
    metrics,
    assets_count: A.length,
    nodes_count: N.length,
    confidence: metrics.confidence,
  };
  if (patch?.dna) update.space_dna = patch.dna;
  if (patch?.brand) update.brand_identity = patch.brand;
  await db().from("knowledge_spaces").update(update).eq("id", spaceId);
  return metrics;
}

// ---------------------------------------------------------------------------
// Sub-agent inheritance
// ---------------------------------------------------------------------------

/**
 * Approved-knowledge inheritance block for an agent.
 * Only spaces the agent is allowed to reach, only approved nodes, and never
 * across accounts — the caller's user id scopes every read.
 */
export async function inheritedKnowledgeBlock(opts: {
  userId: string;
  workspaceId?: string | null;
  agentId?: string | null;
  agentRole?: string | null;
  limit?: number;
}): Promise<string> {
  try {
    let sq = db().from("knowledge_spaces").select("id, name, space_dna, brand_identity, inheritance").eq("user_id", opts.userId).eq("status", "active");
    const { data: spaces } = await sq;
    let list = ((spaces as any[]) || []).filter((s) => (s.inheritance || {}).enabled !== false);
    if (!list.length) return "";

    // Per-agent allow-list (when any rule exists for the agent/role).
    const ids = list.map((s) => s.id);
    const { data: grants } = await db()
      .from("knowledge_space_agents").select("space_id, agent_id, agent_role, inherit").in("space_id", ids);
    const rules = ((grants as any[]) || []);
    if (rules.length) {
      const allowed = new Set(
        rules
          .filter((r) => r.inherit !== false && (
            (opts.agentId && r.agent_id === opts.agentId) ||
            (opts.agentRole && r.agent_role === opts.agentRole)
          ))
          .map((r) => r.space_id),
      );
      const restricted = new Set(rules.map((r) => r.space_id));
      list = list.filter((s) => (restricted.has(s.id) ? allowed.has(s.id) : true));
    }
    if (!list.length) return "";

    const { data: nodes } = await db()
      .from("knowledge_nodes")
      .select("title, summary, layer, payload, confidence, quality")
      .in("space_id", list.map((s) => s.id))
      .eq("approved", true)
      .neq("status", "archived")
      .order("quality", { ascending: false })
      .limit(opts.limit ?? 14);

    const lines = ((nodes as any[]) || []).map(
      (n) => `- [${(n.payload as any)?.dimension || n.layer}] ${n.title}: ${String(n.summary || "").slice(0, 180)} (ثقة ${n.confidence}%)`,
    );
    const dna = list.map((s) => ({ space: s.name, dna: s.space_dna, brand: s.brand_identity }));
    if (!lines.length && !dna.length) return "";
    return (
      `\n\n[Teach Once, Work Forever — معرفة موروثة معتمدة]\n` +
      `${lines.join("\n")}\n` +
      `DNA: ${JSON.stringify(dna).slice(0, 1800)}`
    );
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Hermes supervision
// ---------------------------------------------------------------------------

/** Learning-quality report Hermes uses to propose (never auto-apply) improvements. */
export async function learningGapReport(userId?: string | null) {
  try {
    let q = db().from("knowledge_spaces").select("id, name, user_id, metrics, nodes_count, assets_count, confidence, updated_at");
    if (userId) q = q.eq("user_id", userId);
    const { data } = await q.limit(200);
    const rows = ((data as any[]) || []);
    const proposals: Array<{ space_id: string; space: string; issue: string; suggestion: string; severity: string }> = [];
    for (const s of rows) {
      const m = (s.metrics || {}) as any;
      if ((m.documents_processed || 0) < 3) {
        proposals.push({ space_id: s.id, space: s.name, issue: "قاعدة معرفة صغيرة", suggestion: "ارفع 3 مستندات على الأقل (دليل العلامة، أسلوب الكتابة، قواعد العمل).", severity: "medium" });
      }
      if ((m.documents_pending || 0) > 0) {
        proposals.push({ space_id: s.id, space: s.name, issue: `${m.documents_pending} أصل ينتظر الموافقة`, suggestion: "راجع واعتمد المعرفة المعلّقة ليستفيد منها الوكلاء.", severity: "high" });
      }
      if ((m.evidence || 0) < 40) {
        proposals.push({ space_id: s.id, space: s.name, issue: "أدلة ضعيفة", suggestion: "أضف مستندات موثّقة (تقارير، عقود، دراسات حالة) لتقوية الأدلة.", severity: "medium" });
      }
      const stale = s.updated_at && (Date.now() - Date.parse(s.updated_at)) / 86_400_000 > 90;
      if (stale) {
        proposals.push({ space_id: s.id, space: s.name, issue: "معرفة قديمة", suggestion: "حدّث المساحة بمستندات حديثة — تجاوزت 90 يوماً بدون تحديث.", severity: "low" });
      }
      for (const g of (m.gaps || []).slice(0, 3)) {
        proposals.push({ space_id: s.id, space: s.name, issue: `فجوة: ${g}`, suggestion: "أجب على أسئلة وضع المقابلة لسدّ الفجوة.", severity: "low" });
      }
    }
    return { spaces: rows.length, proposals: proposals.slice(0, 40) };
  } catch {
    return { spaces: 0, proposals: [] };
  }
}
