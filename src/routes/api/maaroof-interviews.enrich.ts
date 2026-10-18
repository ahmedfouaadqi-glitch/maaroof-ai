import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { fcSearch } from "@/lib/firecrawl";
import { buildInterviewResearchQuery, normalizeInterviewResearchSources } from "@/lib/maaroof/interview-research";

const errorResponse = (error: string, status: number) => Response.json({ error }, { status });
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function authenticate(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return { error: errorResponse("auth_required", 401) } as const;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: errorResponse("server_auth_not_configured", 500) } as const;
  try {
    const admin = createClient<Database>(url, key, { auth: { persistSession: false } });
    const { data, error } = await admin.auth.getUser(authorization.slice(7));
    if (error || !data.user?.id) return { error: errorResponse("auth_required", 401) } as const;
    return { admin, userId: data.user.id } as const;
  } catch { return { error: errorResponse("authentication_failed", 500) } as const; }
}

async function canAccessInterview(admin: ReturnType<typeof createClient<Database>>, interview: any, userId: string, write: boolean): Promise<boolean> {
  if (!interview.workspace_id) return interview.user_id === userId;
  const db = admin as any;
  const { data: workspace, error: workspaceError } = await db.from("workspaces").select("id, owner_id").eq("id", interview.workspace_id).maybeSingle();
  if (workspaceError || !workspace) return false;
  if (workspace.owner_id === userId) return true;
  const { data: member, error } = await db.from("workspace_members").select("role").eq("workspace_id", interview.workspace_id).eq("user_id", userId).maybeSingle();
  return !error && !!member && (!write || member.role === "owner" || member.role === "editor");}

async function handlePost(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !isUuid(body.interview_id)) return errorResponse("invalid_interview_id", 400);
  const db = auth.admin as any;
  const { data: interview, error } = await db.from("maaroof_interviews").select("id,user_id,workspace_id,target_type,target_name,initial_goal,domains,locale,state,status,questions_snapshot,context_snapshot").eq("id", body.interview_id).maybeSingle();
  if (error) return errorResponse("interview_lookup_failed", 500);
  if (!interview || !(await canAccessInterview(auth.admin, interview, auth.userId, true))) return errorResponse("interview_not_found", 404);
  if (interview.status !== "completed") return errorResponse("interview_must_be_completed", 409);
  if (!interview.state || typeof interview.state !== "object" || !interview.state.answers || typeof interview.state.answers !== "object") return errorResponse("stored_interview_invalid", 500);
  if (!Array.isArray(interview.questions_snapshot) || !interview.context_snapshot || typeof interview.context_snapshot !== "object") return errorResponse("stored_interview_invalid", 500);
  if (interview.context_snapshot.workspace_id !== interview.workspace_id || interview.context_snapshot.target_name !== interview.target_name || interview.context_snapshot.target_type !== interview.target_type) return errorResponse("stored_interview_context_mismatch", 500);
  const locale = ["ar", "en", "ku"].includes(interview.locale) ? interview.locale : "ar";
  const query = buildInterviewResearchQuery({ targetType: interview.target_type, targetName: interview.target_name, goal: interview.initial_goal, domains: Array.isArray(interview.domains) ? interview.domains : ["general"], locale, state: interview.state });
  if (!query) return errorResponse("research_query_empty", 422);
  try {
    const providerPayload = await fcSearch(query, { limit: 6, lang: locale }, { userId: auth.userId, toolKey: "interview_enrichment" });
    const sources = normalizeInterviewResearchSources(providerPayload, 6);
    const collectedAt = new Date().toISOString();
    const rows = sources.map((source) => ({ interview_id: interview.id, user_id: auth.userId, workspace_id: interview.workspace_id, query, title: source.title, source_url: source.url, domain: source.domain, description: source.description, snippet: source.snippet, locale, collected_at: collectedAt }));
    if (rows.length) {
      const { error: saveError } = await db.from("maaroof_interview_evidence").upsert(rows, { onConflict: "interview_id,source_url" });
      if (saveError) return errorResponse("research_evidence_save_failed", 500);
    }
    const { data: saved, error: readError } = await db.from("maaroof_interview_evidence").select("id,title,source_url,domain,description,snippet,query,locale,collected_at").eq("interview_id", interview.id).order("collected_at", { ascending: false }).limit(8);
    if (readError) return errorResponse("research_evidence_read_failed", 500);
    return Response.json({ interview_id: interview.id, query, sources: saved || [], collected_at: collectedAt });
  } catch (error) {
    const message = error && typeof error === "object" && "name" in error && error.name === "FirecrawlLimitError" ? "research_quota_reached" : "external_research_failed";
    return errorResponse(message, message === "research_quota_reached" ? 429 : 502);
  }
}

export const Route = createFileRoute("/api/maaroof-interviews/enrich")({
  server: { handlers: { POST: async ({ request }) => handlePost(request) } },
});
