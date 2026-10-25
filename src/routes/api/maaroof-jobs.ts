// Workspace background jobs: GET list / events, POST cancel. Owner-only.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { isMissingWorkspaceIdColumn, isStaleJob, isTerminalJobStatus, parseAfter, shouldFallbackFromWorkspaceScope } from "@/lib/maaroof/jobs";

async function auth(request: Request) {
  const h = request.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await admin.auth.getUser(h.slice(7));
  return data.user?.id ? { admin, userId: data.user.id } : null;
}

export const Route = createFileRoute("/api/maaroof-jobs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await auth(request);
        if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const db = a.admin as any;
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        const allWorkspaces = url.searchParams.get("all_workspaces") === "1";
        const workspaceRaw = url.searchParams.get("workspace_id");
        let workspaceId: string | null = null;
        if (workspaceRaw) {
          if (!/^[0-9a-f-]{36}$/i.test(workspaceRaw)) return Response.json({ error: "invalid_workspace" }, { status: 400 });
          const { data: owned } = await db.from("workspaces").select("id").eq("id", workspaceRaw).eq("owner_id", a.userId).maybeSingle();
          if (!owned) return Response.json({ error: "workspace_not_found" }, { status: 404 });
          workspaceId = owned.id;
        }
        if (!id) {
          const columns = "id, goal, mode, status, error, request_payload, workspace_id, created_at, updated_at";
          const legacyColumns = "id, goal, mode, status, error, request_payload, created_at, updated_at";
          let q = db.from("maaroof_jobs").select(columns).eq("user_id", a.userId);
          if (!allWorkspaces) q = workspaceId ? q.eq("workspace_id", workspaceId) : q.is("workspace_id", null);
          let { data: jobs, error: scopedError } = await q.order("created_at", { ascending: false }).limit(1000);
          let scopeFallback = false;
          if (scopedError && isMissingWorkspaceIdColumn(scopedError)) {
            // Legacy production databases may not yet have workspace_id. Preserve task history
            // by querying this user's rows without selecting/filtering the absent column.
            console.warn("[maaroof-jobs] workspace_id is absent; using legacy owner-wide history", scopedError.message);
            const fallback = await db.from("maaroof_jobs").select(legacyColumns).eq("user_id", a.userId).order("created_at", { ascending: false }).limit(1000);
            if (fallback.error) {
              console.error("[maaroof-jobs] legacy owner-wide list failed", fallback.error.message);
              return Response.json({ jobs: [], degraded: true, error: "jobs_unavailable" }, { status: 503 });
            }
            return Response.json({ jobs: fallback.data || [], scope_fallback: true, workspace_scope_unavailable: true });
          }
          if (shouldFallbackFromWorkspaceScope(scopedError)) {
            console.warn("[maaroof-jobs] scoped list failed; retrying owner-wide", scopedError.message);
            const fallback = await db.from("maaroof_jobs").select(columns).eq("user_id", a.userId).order("created_at", { ascending: false }).limit(1000);
            jobs = fallback.data;
            scopeFallback = true;
            if (fallback.error) {
              console.error("[maaroof-jobs] owner-wide list failed", fallback.error.message);
              return Response.json({ jobs: [], degraded: true, error: "jobs_unavailable" }, { status: 503 });
            }
          }
          return Response.json({ jobs: jobs || [], scope_fallback: scopeFallback });
        }
        if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "bad_id" }, { status: 400 });
        const hasWorkspaceScope = url.searchParams.has("workspace_id") && !allWorkspaces;
        let jobQuery = db.from("maaroof_jobs").select("*").eq("id", id).eq("user_id", a.userId);
        if (hasWorkspaceScope) jobQuery = workspaceId ? jobQuery.eq("workspace_id", workspaceId) : jobQuery.is("workspace_id", null);
        let { data: job, error: jobLookupError } = await jobQuery.maybeSingle();
        if (jobLookupError && hasWorkspaceScope && shouldFallbackFromWorkspaceScope(jobLookupError)) {
          console.warn("[maaroof-jobs] scoped lookup failed; retrying by user_id", jobLookupError.message);
          const fallback = await db.from("maaroof_jobs").select("*").eq("id", id).eq("user_id", a.userId).maybeSingle();
          job = fallback.data;
          jobLookupError = fallback.error;
        }
        if (jobLookupError) {
          console.error("[maaroof-jobs] job lookup failed", jobLookupError.message);
          return Response.json({ error: "job_lookup_failed" }, { status: 503 });
        }
        if (!job) return Response.json({ error: "not_found" }, { status: 404 });
        let notStarted = false;
        if (job.status === "running") {
          const { startStale } = await import("@/lib/market-names");
          const { count } = await db.from("maaroof_job_events").select("id", { count: "exact", head: true }).eq("job_id", id);
          notStarted = startStale(job, count || 0);
        }
        const { isStaleAuditJob } = await import("@/lib/maaroof/jobs");
        const auditStuck = job.mode === "deep_audit" && isStaleAuditJob(job);
        const { isStaleAgentJob } = await import("@/lib/maaroof/jobs");
        const agentStuck = job.mode !== "deep_audit" && isStaleAgentJob(job);
        if (notStarted || auditStuck || agentStuck || isStaleJob(job)) {
          const msg = notStarted ? "تعذّر بدء المهمة. اضغط «إعادة المحاولة»." : auditStuck ? "توقف الفحص دون تقدّم؛ لم يُخصم شيء. اضغط «إعادة المحاولة»." : agentStuck ? (await import("@/lib/maaroof/jobs")).AGENT_STUCK_MSG : "انتهت مهلة المهمة دون تقدّم.";
          await db.from("maaroof_jobs").update({ status: "failed", error: msg, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
          job.status = "failed"; job.error = msg;
          if (agentStuck) {
            // One free automatic resume from the last successful tool; claim it first so it never runs twice.
            const { canAutoResume } = await import("@/lib/maaroof/jobs");
            if (canAutoResume(job)) {
              const payload = { ...(job.request_payload || {}), auto_resume_job_id: "pending" };
              const { data: claimed } = await db.from("maaroof_jobs").update({ request_payload: payload }).eq("id", id).is("request_payload->>auto_resume_job_id", null).select("id");
              if (claimed?.length) {
                try {
                  const rp = job.request_payload || {};
                  const r = await fetch(new URL("/api/maaroof", request.url), { method: "POST", headers: { "Content-Type": "application/json", Authorization: request.headers.get("authorization") || "" }, body: JSON.stringify({ goal: job.goal, lang: rp.lang || "ar", interface_mode: "workspace", workspace_id: job.workspace_id || rp.workspace_id || null, execution_mode: job.mode === "execution" ? undefined : job.mode, selected_skills: rp.selected_skills, probe_engines: rp.probe_engines, live_probe: rp.live_probe, resume_job_id: id, auto_resume: true }) });
                  const j: any = await r.json().catch(() => ({}));
                  const newId = j?.job_id || j?.id;
                  if (newId) { await db.from("maaroof_jobs").update({ request_payload: { ...payload, auto_resume_job_id: newId } }).eq("id", id); (job as any).auto_resume_job_id = newId; }
                } catch {}
              }
            }
          }
        }
        const { data: events } = await db.from("maaroof_job_events").select("seq, event_type, payload, created_at")
          .eq("job_id", id).gt("seq", parseAfter(url.searchParams.get("after"))).order("seq", { ascending: true }).limit(200);
        return Response.json({ job, events: events || [] });
      },
      POST: async ({ request }) => {
        const a = await auth(request);
        if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const body = await request.json().catch(() => ({} as any));
        const id = String(body?.job_id || "");
        if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "bad_id" }, { status: 400 });
        const db = a.admin as any;
        const { data: job } = await db.from("maaroof_jobs").select("id, status").eq("id", id).eq("user_id", a.userId).maybeSingle();
        if (!job) return Response.json({ error: "not_found" }, { status: 404 });
        if (!isTerminalJobStatus(job.status)) {
          const now = new Date().toISOString();
          await db.from("maaroof_jobs").update({ status: "cancelled", finished_at: now, updated_at: now }).eq("id", id);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
