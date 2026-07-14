// Living Memory (evolved).
// New (constitution v1): supports `knowledge` (durable facts) and
// `decision` (Expert Council decisions) kinds, and can recall by
// `capability` (from src/lib/tool-catalog.ts). No new table — we ALTERed
// maaroof_memory with links/source_run_id/capability columns.
import { createClient } from "@supabase/supabase-js";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return _db as any;
}

export type MemoryKind = "fact" | "preference" | "task_result" | "summary" | "knowledge" | "decision";

/**
 * Recall memories for a user. If `capability` is provided we bias toward
 * memories tagged with that capability (they surface first), then fall
 * back to importance-weighted LRU as before.
 */
export async function recall(
  userId: string,
  _goal: string,
  limit = 10,
  opts: { capability?: string } = {},
): Promise<string[]> {
  const cap = opts.capability;
  const rows: any[] = [];

  if (cap) {
    const { data } = await db()
      .from("maaroof_memory")
      .select("id, content, kind, importance, capability")
      .eq("user_id", userId)
      .eq("capability", cap)
      .order("importance", { ascending: false })
      .order("last_accessed_at", { ascending: false })
      .limit(limit);
    for (const r of (data as any[]) || []) rows.push(r);
  }
  if (rows.length < limit) {
    const { data } = await db()
      .from("maaroof_memory")
      .select("id, content, kind, importance, capability")
      .eq("user_id", userId)
      .order("importance", { ascending: false })
      .order("last_accessed_at", { ascending: false })
      .limit(limit - rows.length);
    const seen = new Set(rows.map((r) => r.id));
    for (const r of (data as any[]) || []) if (!seen.has(r.id)) rows.push(r);
  }

  if (rows.length) {
    const ids = rows.map((r) => r.id);
    await db().from("maaroof_memory").update({ last_accessed_at: new Date().toISOString() }).in("id", ids);
  }
  return rows.slice(0, limit).map((r) => `[${r.kind}${r.capability ? `:${r.capability}` : ""}] ${r.content}`);
}

export async function remember(opts: {
  userId: string;
  runId?: string;
  kind: MemoryKind;
  content: string;
  importance?: number;
  capability?: string;
  links?: any[];
  sourceRunId?: string;
}) {
  await db().from("maaroof_memory").insert({
    user_id: opts.userId,
    run_id: opts.runId || null,
    kind: opts.kind,
    content: opts.content.slice(0, 2000),
    importance: Math.max(1, Math.min(5, opts.importance || 2)),
    capability: opts.capability || null,
    links: opts.links || [],
    source_run_id: opts.sourceRunId || opts.runId || null,
  });
  // LRU cap @ 1000 per user
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
