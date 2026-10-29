// Server-only, workspace-scoped cache for externally retrieved keyword evidence.
// Cache misses never prevent research; storage errors fail open, not across scopes.
import { createClient } from "@supabase/supabase-js";

type CacheScope = {
  userId: string;
  workspaceId?: string | null;
  evidenceType: string;
  evidenceKey: string;
};

function serviceDb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

function scopeKey(workspaceId?: string | null) {
  return workspaceId || "__account__";
}

/** A collision-resistant, content-independent identifier for a query or URL. */
export async function evidenceCacheKey(value: unknown): Promise<string> {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  const bytes = new TextEncoder().encode(raw ?? "null");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getKeywordEvidence<T>(scope: CacheScope): Promise<T | null> {
  try {
    const { data, error } = await serviceDb()
      .from("keyword_intelligence_evidence_cache")
      .select("payload")
      .eq("user_id", scope.userId)
      .eq("scope_key", scopeKey(scope.workspaceId))
      .eq("evidence_type", scope.evidenceType)
      .eq("evidence_key", scope.evidenceKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data || data.payload == null) return null;
    return data.payload as T;
  } catch {
    return null;
  }
}

/** Stores only caller-approved evidence (successful results by default); TTL is bounded. */
export async function putKeywordEvidence<T>(
  scope: CacheScope,
  payload: T,
  ttlHours = 24,
): Promise<void> {
  try {
    const now = Date.now();
    const ttl = Math.max(1, Math.min(168, Number(ttlHours) || 24));
    await serviceDb()
      .from("keyword_intelligence_evidence_cache")
      .upsert({
        user_id: scope.userId,
        workspace_id: scope.workspaceId || null,
        scope_key: scopeKey(scope.workspaceId),
        evidence_type: scope.evidenceType,
        evidence_key: scope.evidenceKey,
        payload,
        created_at: new Date(now).toISOString(),
        expires_at: new Date(now + ttl * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "user_id,scope_key,evidence_type,evidence_key" });
  } catch {
    // Cache is an optimization. A database hiccup must not block a live analysis.
  }
}
