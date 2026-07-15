// Living Memory (Part 2 evolution).
// Backward compatible: old kinds (fact/preference/task_result/summary) still work.
// New: workspace scoping, intelligence metadata (confidence/freshness/reliability/
// source/usage_count/decision_impact/learning_score), knowledge-graph edges in
// `links jsonb`, and blended recall ranking.
import { createClient } from "@supabase/supabase-js";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return _db as any;
}

export type MemoryKind =
  | "fact"
  | "preference"
  | "task_result"
  | "summary"
  | "knowledge"
  | "decision"
  | "learning"
  // Part 2 memory layers — accepted but treated like generic long memory:
  | "working"
  | "short"
  | "long"
  | "semantic"
  | "workspace"
  | "brand"
  | "capability"
  | "platform";

type MemoryRow = {
  id: string;
  content: string;
  kind: string;
  importance: number | null;
  capability: string | null;
  workspace_id: string | null;
  confidence: number | null;
  freshness_at: string | null;
  reliability: number | null;
  usage_count: number | null;
  decision_impact: number | null;
  learning_score: number | null;
  last_accessed_at: string | null;
};

/**
 * Blended recall score — combines several dimensions instead of using
 * timestamp / importance only. Weights match the plan in .lovable/plan.md.
 */
function scoreMemory(r: MemoryRow, opts: { capability?: string; workspaceId?: string | null }): number {
  const now = Date.now();
  const freshMs = r.freshness_at ? new Date(r.freshness_at).getTime() : (r.last_accessed_at ? new Date(r.last_accessed_at).getTime() : now);
  const ageDays = Math.max(0, (now - freshMs) / (1000 * 60 * 60 * 24));
  const freshness = Math.max(0, 1 - Math.min(1, ageDays / 60)); // decays over ~60 days
  const importance = (r.importance ?? 2) / 5;
  const reliability = r.reliability ?? 0.6;
  const confidence = r.confidence ?? 0.6;
  const decisionImpact = r.decision_impact ?? 0;
  const learning = r.learning_score ?? 0;
  let base =
    importance * 0.35 +
    freshness * 0.2 +
    reliability * 0.15 +
    confidence * 0.15 +
    decisionImpact * 0.1 +
    learning * 0.05;
  if (opts.capability && r.capability === opts.capability) base += 0.15;
  if (opts.workspaceId && r.workspace_id === opts.workspaceId) base += 0.2;
  return base;
}

/**
 * Recall memories for a user. Prefers same-workspace and matching-capability rows.
 */
export async function recall(
  userId: string,
  _goal: string,
  limit = 10,
  opts: { capability?: string; workspaceId?: string | null } = {},
): Promise<string[]> {
  // Pull a wider candidate set, then rank in JS with the blended score.
  const { data } = await db()
    .from("maaroof_memory")
    .select(
      "id, content, kind, importance, capability, workspace_id, confidence, freshness_at, reliability, usage_count, decision_impact, learning_score, last_accessed_at",
    )
    .eq("user_id", userId)
    .order("importance", { ascending: false })
    .order("last_accessed_at", { ascending: false })
    .limit(Math.max(limit * 4, 40));

  const rows = ((data as any[]) || []) as MemoryRow[];
  rows.sort((a, b) => scoreMemory(b, opts) - scoreMemory(a, opts));
  const top = rows.slice(0, limit);

  if (top.length) {
    const ids = top.map((r) => r.id);
    // Touch last_accessed_at + bump usage_count using a service-role update.
    await db().from("maaroof_memory").update({ last_accessed_at: new Date().toISOString() }).in("id", ids);
    // Increment usage_count in a non-blocking best-effort way.
    try {
      await Promise.all(
        top.map((r) =>
          db()
            .from("maaroof_memory")
            .update({ usage_count: (r.usage_count ?? 0) + 1 })
            .eq("id", r.id),
        ),
      );
    } catch {}
  }
  return top.map((r) => `[${r.kind}${r.capability ? `:${r.capability}` : ""}] ${r.content}`);
}

export async function remember(opts: {
  userId: string;
  runId?: string;
  kind: MemoryKind;
  content: string;
  importance?: number;
  capability?: string;
  workspaceId?: string | null;
  links?: any[];
  sourceRunId?: string;
  confidence?: number;
  reliability?: number;
  source?: string;
  decisionImpact?: number;
  learningScore?: number;
}) {
  await db().from("maaroof_memory").insert({
    user_id: opts.userId,
    run_id: opts.runId || null,
    workspace_id: opts.workspaceId || null,
    kind: opts.kind,
    content: opts.content.slice(0, 2000),
    importance: Math.max(1, Math.min(5, opts.importance || 2)),
    capability: opts.capability || null,
    links: opts.links || [],
    source_run_id: opts.sourceRunId || opts.runId || null,
    confidence: clamp01(opts.confidence),
    reliability: clamp01(opts.reliability),
    source: opts.source || null,
    decision_impact: clamp01(opts.decisionImpact),
    learning_score: clamp01(opts.learningScore),
    freshness_at: new Date().toISOString(),
  });
  // LRU cap @ 1000 per user (unchanged).
  const { count } = await db().from("maaroof_memory").select("id", { count: "exact", head: true }).eq("user_id", opts.userId);
  if ((count || 0) > 1000) {
    const { data: old } = await db()
      .from("maaroof_memory")
      .select("id")
      .eq("user_id", opts.userId)
      .order("importance", { ascending: true })
      .order("last_accessed_at", { ascending: true })
      .limit(((count || 0) - 1000));
    const ids = ((old as any[]) || []).map((r) => r.id);
    if (ids.length) await db().from("maaroof_memory").delete().in("id", ids);
  }
}

/**
 * Knowledge-graph edge stored inside `maaroof_memory.links` (jsonb array).
 * No new table — evolves the existing column. Idempotent: won't add duplicates.
 */
export async function linkMemories(fromId: string, toId: string, relation: string): Promise<void> {
  const { data } = await db().from("maaroof_memory").select("links").eq("id", fromId).maybeSingle();
  const links: any[] = Array.isArray((data as any)?.links) ? (data as any).links : [];
  if (links.some((l) => l && l.to === toId && l.relation === relation)) return;
  links.push({ to: toId, relation, at: new Date().toISOString() });
  await db().from("maaroof_memory").update({ links }).eq("id", fromId);
}

function clamp01(v?: number): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Math.max(0, Math.min(1, Number(v)));
}
