import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function authenticatedUser(request: Request, admin: ReturnType<typeof createClient>) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const { data } = await admin.auth.getUser(auth.slice(7));
  return data.user?.id || null;
}

export const Route = createFileRoute("/api/maaroof-jobs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const admin = createAdminClient();
        if (!admin) return Response.json({ error: "server_not_configured" }, { status: 500 });
        const userId = await authenticatedUser(request, admin);
        if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });

        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) {
          const { data, error } = await admin.from("maaroof_background_jobs")
            .select("id,goal,language,mode,status,current_stage,request_payload,result,error,created_at,updated_at,started_at,finished_at")
            .eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
          if (error) return Response.json({ error: "job_history_unavailable" }, { status: 500 });
          return Response.json({ jobs: data || [] });
        }

        const { data: job, error } = await admin.from("maaroof_background_jobs")
          .select("id,goal,language,mode,status,current_stage,request_payload,result,error,created_at,updated_at,started_at,finished_at")
          .eq("id", id).eq("user_id", userId).maybeSingle();
        if (error) return Response.json({ error: "job_lookup_failed" }, { status: 500 });
        if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });

        const rawAfter = Number(url.searchParams.get("after") || 0);
        const after = Number.isFinite(rawAfter) && rawAfter >= 0 ? Math.floor(rawAfter) : 0;
        const { data: events, error: eventsError } = await admin.from("maaroof_background_job_events")
          .select("seq,event_type,payload,created_at").eq("job_id", id).eq("user_id", userId)
          .gt("seq", after).order("seq", { ascending: true }).limit(250);
        if (eventsError) return Response.json({ error: "job_events_unavailable" }, { status: 500 });
        return Response.json({ job, events: events || [] });
      },
      POST: async ({ request }) => {
        const admin = createAdminClient();
        if (!admin) return Response.json({ error: "server_not_configured" }, { status: 500 });
        const userId = await authenticatedUser(request, admin);
        if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });
        const body = await request.json().catch(() => ({} as any));
        const id = typeof body?.job_id === "string" ? body.job_id : "";
        if (!id) return Response.json({ error: "job_id_required" }, { status: 400 });
        const { data: job } = await admin.from("maaroof_background_jobs").select("id,status")
          .eq("id", id).eq("user_id", userId).maybeSingle();
        if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
        if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
          return Response.json({ job_id: id, status: job.status });
        }
        const now = new Date().toISOString();
        const { data: cancelled, error } = await admin.from("maaroof_background_jobs").update({
          status: "cancelled", auth_token_ciphertext: null, error: "cancelled_by_user", finished_at: now, updated_at: now,
        }).eq("id", id).eq("user_id", userId).in("status", ["queued", "running"])
          .select("id,status").maybeSingle();
        if (error) return Response.json({ error: "job_cancel_failed" }, { status: 500 });

        // Only queued/running jobs are cancellable from the UI. Dispatching jobs have
        // not yet been charged/finalized, so cancelling them here could race with billing.
        if (!cancelled) {
          const { data: latest, error: latestError } = await admin.from("maaroof_background_jobs")
            .select("id,status").eq("id", id).eq("user_id", userId).maybeSingle();
          if (latestError) return Response.json({ error: "job_lookup_failed" }, { status: 500 });
          if (!latest) return Response.json({ error: "job_not_found" }, { status: 404 });
          return Response.json({ job_id: id, status: latest.status });
        }

        await admin.from("maaroof_background_job_events").insert({
          job_id: id, user_id: userId, event_type: "cancelled", payload: { status: "cancelled" },
        });
        return Response.json({ job_id: id, status: "cancelled" });
      },
    },
  },
});
