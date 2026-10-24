// Part 11 — Living Knowledge Ecosystem.
//
// Evolution, not replacement: `maaroof_memory` stays the per-run episodic
// memory and `platform_dna` stays the anonymized pattern store. This module
// adds the missing layer between them — a *structured, versioned, decaying*
// knowledge graph across nine layers, with confidence/freshness/reliability
// on every node and typed edges between them.
import { createClient } from "@supabase/supabase-js";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db as any;
}

export const KNOWLEDGE_LAYERS = [
  "platform",
  "expert",
  "workspace",
  "user",
  "agent",
  "mcp",
  "tool",
  "world",
  "future",
] as const;
export type KnowledgeLayer = (typeof KNOWLEDGE_LAYERS)[number];

export type KnowledgeNode = {
  id: string;
  layer: KnowledgeLayer;
  node_key: string;
  title: string;
  summary: string | null;
  payload: Record<string, any>;
  sources: any[];
  scope: string;
  user_id: string | null;
  workspace_id: string | null;
  version: number;
  confidence: number;
  reliability: number;
  importance: number;
  quality: number;
  usage_count: number;
  status: string;
  freshness_at: string;
  updated_at: string;
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Quality = weighted blend of confidence, reliability, freshness and use. */
export function nodeQuality(input: {
  confidence: number;
  reliability: number;
  freshness_at?: string | null;
  usage_count?: number;
  freshnessDays: number;
}): number {
  const ageDays = input.freshness_at
    ? (Date.now() - new Date(input.freshness_at).getTime()) / 86_400_000
    : 0;
  const freshness = clamp(100 - (ageDays / Math.max(1, input.freshnessDays)) * 100);
  const usage = clamp(Math.log2(1 + (input.usage_count || 0)) * 20);
  return clamp(
    input.confidence * 0.35 + input.reliability * 0.3 + freshness * 0.25 + usage * 0.1,
  );
}

export type UpsertNodeInput = {
  layer: KnowledgeLayer;
  key: string;
  title: string;
  summary?: string | null;
  payload?: Record<string, any>;
  sources?: any[];
  scope?: "platform" | "workspace" | "user";
  userId?: string | null;
  workspaceId?: string | null;
  confidence?: number;
  reliability?: number;
  importance?: number;
  status?: "draft" | "validated" | "conflict" | "archived";
};

/**
 * Insert or evolve a node. Re-writing an existing node bumps its version,
 * refreshes its freshness clock, and blends the new confidence with the old
 * one rather than overwriting it — knowledge accumulates, it does not reset.
 */
export async function upsertKnowledgeNode(input: UpsertNodeInput, freshnessDays = 30): Promise<string | null> {
  try {
    const scope = input.scope || (input.userId ? "user" : "platform");
    let q = db()
      .from("knowledge_nodes")
      .select("id, version, confidence, reliability, usage_count")
      .eq("layer", input.layer)
      .eq("node_key", input.key);
    q = input.workspaceId ? q.eq("workspace_id", input.workspaceId) : q.is("workspace_id", null);
    q = input.userId ? q.eq("user_id", input.userId) : q.is("user_id", null);
    const { data: existing } = await q.maybeSingle();

    const confidence = clamp(
      existing ? (Number((existing as any).confidence) + (input.confidence ?? 50)) / 2 : input.confidence ?? 50,
    );
    const reliability = clamp(
      existing ? (Number((existing as any).reliability) + (input.reliability ?? 50)) / 2 : input.reliability ?? 50,
    );
    const quality = nodeQuality({
      confidence,
      reliability,
      freshness_at: new Date().toISOString(),
      usage_count: Number((existing as any)?.usage_count || 0),
      freshnessDays,
    });

    const row = {
      layer: input.layer,
      node_key: input.key,
      title: input.title,
      summary: input.summary ?? null,
      payload: input.payload || {},
      sources: input.sources || [],
      scope,
      user_id: input.userId || null,
      workspace_id: input.workspaceId || null,
      version: existing ? Number((existing as any).version) + 1 : 1,
      confidence,
      reliability,
      importance: clamp(input.importance ?? 50),
      quality,
      status: input.status || "validated",
      freshness_at: new Date().toISOString(),
    };

    if (existing) {
      await db().from("knowledge_nodes").update(row).eq("id", (existing as any).id);
      return (existing as any).id as string;
    }
    const { data } = await db().from("knowledge_nodes").insert(row).select("id").single();
    return ((data as any)?.id as string) || null;
  } catch {
    return null;
  }
}

export async function linkKnowledge(fromId: string, toId: string, relation: string, weight = 1): Promise<void> {
  if (!fromId || !toId || fromId === toId) return;
  try {
    await db()
      .from("knowledge_edges")
      .upsert({ from_node: fromId, to_node: toId, relation, weight }, { onConflict: "from_node,to_node,relation" });
  } catch {}
}

/** Recall the most useful nodes for a run, scoped to the caller. */
export async function recallKnowledge(opts: {
  userId?: string | null;
  workspaceId?: string | null;
  layers?: KnowledgeLayer[];
  minConfidence?: number;
  limit?: number;
}): Promise<KnowledgeNode[]> {
  try {
    let q = db()
      .from("knowledge_nodes")
      .select("*")
      .gte("confidence", opts.minConfidence ?? 40)
      .neq("status", "archived")
      .order("quality", { ascending: false })
      .limit(opts.limit ?? 8);
    if (opts.layers?.length) q = q.in("layer", opts.layers);
    const filters = ["scope.eq.platform"];
    if (opts.userId) filters.push(`user_id.eq.${opts.userId}`);
    if (opts.workspaceId) filters.push(`workspace_id.eq.${opts.workspaceId}`);
    q = q.or(filters.join(","));
    const { data } = await q;
    const rows = ((data as any[]) || []) as KnowledgeNode[];
    if (rows.length) {
      // Usage is a signal, not bookkeeping: recalled knowledge gains quality.
      for (const r of rows) {
        void db()
          .from("knowledge_nodes")
          .update({ usage_count: (r.usage_count || 0) + 1 })
          .eq("id", r.id);
      }
    }
    return rows;
  } catch {
    return [];
  }
}

/** Compact recall block for the planner system prompt. */
export function knowledgePromptBlock(nodes: KnowledgeNode[]): string {
  if (!nodes.length) return "";
  const lines = nodes.slice(0, 8).map(
    (n) => `- [${n.layer}] ${n.title}: ${(n.summary || "").slice(0, 180)} (ثقة ${n.confidence}%، جودة ${n.quality}%)`,
  );
  return `\n\n[Living knowledge]\n${lines.join("\n")}`;
}

/** Mirror learned expert profiles into the "expert" knowledge layer. */
export async function syncExpertKnowledge(freshnessDays = 30): Promise<number> {
  try {
    const { data } = await db()
      .from("expert_profiles")
      .select("expert_key, dna, understanding_score, confidence, version, status")
      .eq("status", "learned");
    let n = 0;
    for (const p of ((data as any[]) || [])) {
      const dna = p.dna || {};
      const id = await upsertKnowledgeNode(
        {
          layer: "expert",
          key: p.expert_key,
          title: dna.identity || p.expert_key,
          summary: dna.mission || null,
          payload: {
            when_to_use: dna.when_to_use || [],
            when_not_to_use: dna.when_not_to_use || [],
            limitations: dna.limitations || [],
            preferred_models: dna.preferred_models || [],
            version: p.version,
          },
          scope: "platform",
          confidence: Number(p.confidence || 50),
          reliability: Number(p.understanding_score || 50),
          importance: 70,
        },
        freshnessDays,
      );
      if (id) n++;
    }
    return n;
  } catch {
    return 0;
  }
}

export type KnowledgeHealthRow = {
  layer: string;
  nodes: number;
  avg_confidence: number;
  avg_reliability: number;
  avg_quality: number;
  conflicts: number;
  stale: number;
  total_usage: number;
  last_updated_at: string | null;
};
