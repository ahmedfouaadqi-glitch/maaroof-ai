// Workspace background jobs: GET list / events, POST cancel. Owner-only.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { isStaleJob, isTerminalJobStatus, parseAfter } from "@/lib/maaroof/jobs";

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
        if (!id) {
          const { data } = await db.from("maaroof_jobs").select("id, goal, mode, status, error, request_payload, created_at, updated_at")
            .eq("user_id", a.userId).order("created_at", { ascending: false }).limit(10);
          return Response.json({ jobs: data || [] });
        }
        if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "bad_id" }, { status: 400 });
        const { data: job } = await db.from("maaroof_jobs").select("*").eq("id", id).eq("user_id", a.userId).maybeSingle();
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
          const msg = notStarted ? "تعذّر بدء المهمة. اضغط «إعادة المحاولة»." : auditStuck ? "توقف الفحص دون تقدّم؛ لم يُخصم شيء. اضغط «إعادة المحاولة»." : agentStuck ? "توقف المنفّذ دون تقدّم؛ لم يُخصم إلا ما اكتمل. اضغط «استئناف» لإكمال الباقي دون إعادة خصم." : "انتهت مهلة المهمة دون تقدّم.";
          await db.from("maaroof_jobs").update({ status: "failed", error: msg, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
          job.status = "failed"; job.error = msg;
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
