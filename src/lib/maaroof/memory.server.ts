import { createClient } from "@supabase/supabase-js";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return _db as any;
}

export type MemoryKind = "fact" | "preference" | "task_result" | "summary";

export async function recall(userId: string, _goal: string, limit = 10): Promise<string[]> {
  const { data } = await db()
    .from("maaroof_memory")
    .select("id, content, kind, importance")
    .eq("user_id", userId)
    .order("importance", { ascending: false })
    .order("last_accessed_at", { ascending: false })
    .limit(limit);
  const rows = (data as any[]) || [];
  if (rows.length) {
    const ids = rows.map((r) => r.id);
    await db().from("maaroof_memory").update({ last_accessed_at: new Date().toISOString() }).in("id", ids);
  }
  return rows.map((r) => `[${r.kind}] ${r.content}`);
}

export async function remember(opts: { userId: string; runId?: string; kind: MemoryKind; content: string; importance?: number }) {
  await db().from("maaroof_memory").insert({
    user_id: opts.userId,
    run_id: opts.runId || null,
    kind: opts.kind,
    content: opts.content.slice(0, 2000),
    importance: Math.max(1, Math.min(5, opts.importance || 2)),
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
