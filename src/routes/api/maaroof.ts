// Maaroof streaming endpoint (SSE). POST { goal, lang?, geo_scope? }
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { detectGeoFromRequest, type GeoScope } from "@/lib/maaroof/geo.server";
import { runMaaroof } from "@/lib/maaroof/orchestrator.server";
import { isMissingWorkspaceIdColumn } from "@/lib/maaroof/jobs";

type InlineRunOptions = {
  request: Request;
  userId: string;
  goal: string;
  lang: "ar" | "en" | "ku";
  detectedGeo: any;
  geoScope?: GeoScope;
  workspaceId: string | null;
  authBearer: string;
  origin: string;
  executionMode?: "simulation" | "recommendation" | "execution";
  useSubagents?: boolean;
  liveProbe?: boolean;
  clarifications: Record<string, string>;
  reason: string;
};

/** Last-resort path when the background-job table/schema is unavailable: execute directly over SSE. */
function inlineRunResponse(options: InlineRunOptions): Response {
  const encoder = new TextEncoder();
  const abortCtl = new AbortController();
  options.request.signal.addEventListener("abort", () => abortCtl.abort(), { once: true });
  const stream = new ReadableStream({
    async start(controller) {
      const emit = async (event: string, data: any) => {
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch {}
      };
      await emit("fallback", {
        mode: "inline",
        reason: options.reason,
        message: "The background queue was unavailable; this run is executing directly and will not appear in persistent job history.",
      });
      try {
        await runMaaroof({
          userId: options.userId,
          goal: options.goal,
          language: options.lang,
          detectedGeo: options.detectedGeo,
          geoScope: options.geoScope,
          workspaceId: options.workspaceId,
          authBearer: options.authBearer,
          origin: options.origin,
          emit,
          signal: abortCtl.signal,
          executionMode: options.executionMode,
          useSubagents: options.useSubagents,
          liveProbe: options.liveProbe,
          clarifications: options.clarifications,
        });
      } catch (e: any) {
        await emit("error", { message: String(e?.message || e).slice(0, 500) });
      } finally {
        try { controller.close(); } catch {}
      }
    },
    cancel() { abortCtl.abort(); },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}

export const Route = createFileRoute("/api/maaroof")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        if (!auth.startsWith("Bearer ")) return Response.json({ error: "auth_required" }, { status: 401 });

        const url = process.env.SUPABASE_URL!;
        const srKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        if (!url || !srKey) return Response.json({ error: "server_not_configured" }, { status: 500 });
        const admin = createClient(url, srKey, { auth: { persistSession: false } });
        const { data: u } = await admin.auth.getUser(auth.slice(7));
        const userId = u.user?.id;
        if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });

        const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
        const settings = await getMaaroofSettings();
        if (settings.kill_switch) {
          return Response.json({ error: "disabled", message: { ar: "تم تعطيل معروف مؤقتاً من قبل الإدارة.", en: "Maaroof is temporarily disabled by admin.", ku: "ماعروف بۆ کاتێک ناچالاککراوە." } }, { status: 503 });
        }

        const body = await request.json().catch(() => ({} as any));
        const goal = String(body?.goal || "").trim().slice(0, settings.max_goal_chars);
        if (!goal) return Response.json({ error: "goal_required" }, { status: 400 });
        const lang = (body?.lang as "ar" | "en" | "ku") || "ar";
        const geoScope = (body?.geo_scope as GeoScope) || undefined;
        const workspaceRaw = body?.workspace_id;
        if (workspaceRaw != null && workspaceRaw !== "" && (typeof workspaceRaw !== "string" || !/^[0-9a-f-]{36}$/i.test(workspaceRaw))) return Response.json({ error: "invalid_workspace" }, { status: 400 });
        const workspaceId = typeof workspaceRaw === "string" && workspaceRaw ? workspaceRaw : null;
        const executionMode = (["simulation","recommendation","execution"] as const).includes(body?.execution_mode) ? body.execution_mode as "simulation"|"recommendation"|"execution" : undefined;

        // Verify workspace ownership if provided.
        let verifiedWorkspaceId: string | null = null;
        if (workspaceId) {
          const { data: ws } = await admin.from("workspaces").select("id").eq("id", workspaceId).eq("owner_id", userId).maybeSingle();
          if (!ws) return Response.json({ error: "workspace_not_found" }, { status: 404 });
          verifiedWorkspaceId = workspaceId;
        }

        const useSubagents = body?.use_subagents === false ? false : undefined;
        const liveProbe = body?.live_probe === false ? false : undefined;
        const clarifications: Record<string, string> = {};
        if (body?.clarifications && typeof body.clarifications === "object") {
          for (const [k, v] of Object.entries(body.clarifications).slice(0, 10)) if (typeof v === "string") clarifications[String(k).slice(0, 40)] = v.slice(0, 200);
        }
        const detectedGeo = detectGeoFromRequest(request);
        const origin = new URL(request.url).origin;

        // Plan/token gate — treats Maaroof as a regular tool.
        const { chargeTokens, chargeFailureBody, resolveToolCost } = await import("@/lib/tokens.server");
        const priceKey = executionMode === "recommendation" || executionMode === "simulation" ? `maaroof.${executionMode}` : "maaroof";
        const cost = await resolveToolCost(userId, priceKey);
        const { data: prof } = await admin.from("profiles").select("is_subscribed, tokens_balance, tokens_daily_limit, tokens_monthly_limit").eq("id", userId).maybeSingle();
        const hasMeter = Number((prof as any)?.tokens_balance) > 0 || (prof as any)?.tokens_daily_limit != null || (prof as any)?.tokens_monthly_limit != null;

        if ((cost.source as any) === "disabled_by_admin") {
          return Response.json(chargeFailureBody("tool_disabled"), { status: 403 });
        }
        // Free automatic resume: only for an owned job the watchdog stopped, and only once.
        let freeAutoResume = false;
        if (body?.auto_resume === true && typeof body?.resume_job_id === "string" && /^[0-9a-f-]{36}$/i.test(body.resume_job_id)) {
          let autoResumeQuery = (admin as any).from("maaroof_jobs").select("status, error, request_payload").eq("id", body.resume_job_id).eq("user_id", userId);
          autoResumeQuery = verifiedWorkspaceId ? autoResumeQuery.eq("workspace_id", verifiedWorkspaceId) : autoResumeQuery.is("workspace_id", null);
          let { data: pj, error: autoResumeLookupError } = await autoResumeQuery.maybeSingle();
          if (autoResumeLookupError) {
            console.warn("[maaroof] scoped auto-resume lookup failed; retrying by user_id", autoResumeLookupError.message);
            const fallback = await (admin as any).from("maaroof_jobs").select("status, error, request_payload").eq("id", body.resume_job_id).eq("user_id", userId).maybeSingle();
            pj = fallback.data;
            autoResumeLookupError = fallback.error;
          }
          if (autoResumeLookupError) return Response.json({ error: "job_lookup_failed" }, { status: 503 });
          const { canAutoResume } = await import("@/lib/maaroof/jobs");
          freeAutoResume = !!pj && canAutoResume(pj, true);
          if (!freeAutoResume) return Response.json({ error: "auto_resume_not_allowed" }, { status: 409 });
        }
        if (hasMeter && !freeAutoResume) {
          const charge = await chargeTokens({ userId, toolKey: priceKey, meta: { goal: goal.slice(0, 200), mode: executionMode || "execution" } });
          if (!charge.ok) {
            const status = charge.reason === "unpriced" ? 402 : charge.reason === "balance" || charge.reason === "daily_limit" || charge.reason === "monthly_limit" ? 402 : 403;
            return Response.json(chargeFailureBody(charge.reason, (charge as any).left), { status });
          }
        } else {
          // Free-tier trial path: enforce daily session cap from admin settings
          const today = new Date(); today.setUTCHours(0, 0, 0, 0);
          const { count } = await admin.from("maaroof_runs").select("id", { count: "exact", head: true })
            .eq("user_id", userId).gte("started_at", today.toISOString());
          const paid = !!(prof as any)?.is_subscribed;
          if (!paid && (count || 0) >= settings.trial_daily_cap) {
            return Response.json({ error: "trial_limit", message: { ar: `تجاوزت ${settings.trial_daily_cap} جلسات يومياً للتجربة. اشترك للمزيد.`, en: `Daily trial limit (${settings.trial_daily_cap}) reached. Upgrade for more.`, ku: "سنووری ڕۆژانە تەواو بووە." } }, { status: 402 });
          }
        }

        if (body?.interface_mode === "workspace") {
          const db = admin as any;
          const probeEngines = Array.isArray(body?.probe_engines) ? body.probe_engines.filter((x: unknown) => typeof x === "string").slice(0, 10) : undefined;
          let pickedSkills: string[] = Array.isArray(body?.selected_skills) ? body.selected_skills.filter((x: unknown) => typeof x === "string").slice(0, 20) : [];
          const resumeRef = typeof body?.resume_job_id === "string" && /^[0-9a-f-]{36}$/i.test(body.resume_job_id) ? body.resume_job_id : null;
          if (resumeRef) {
            let previousQuery = db.from("maaroof_jobs").select("id, request_payload").eq("id", resumeRef).eq("user_id", userId);
            previousQuery = verifiedWorkspaceId ? previousQuery.eq("workspace_id", verifiedWorkspaceId) : previousQuery.is("workspace_id", null);
            let { data: prevPayload, error: previousLookupError } = await previousQuery.maybeSingle();
            if (previousLookupError) {
              console.warn("[maaroof] scoped resume lookup failed; retrying by user_id", previousLookupError.message);
              const fallback = await db.from("maaroof_jobs").select("id, request_payload").eq("id", resumeRef).eq("user_id", userId).maybeSingle();
              prevPayload = fallback.data;
              previousLookupError = fallback.error;
            }
            if (previousLookupError) return Response.json({ error: "job_lookup_failed" }, { status: 503 });
            if (!prevPayload) return Response.json({ error: "resume_job_not_found" }, { status: 404 });
            if (!pickedSkills.length) {
              const prevSkills = (prevPayload as any)?.request_payload?.selected_skills;
              if (Array.isArray(prevSkills)) pickedSkills = prevSkills.filter((x: unknown) => typeof x === "string").slice(0, 20);
            }
          }
          const { chooseSkillsAutonomously } = await import("@/lib/maaroof/skill-inference");
          // Maaroof reads the user's own profile, knowledge and interview before choosing tools.
          let own: { brand?: string | null; profileText?: string; knowledgeText?: string[] } = {};
          try {
            if (verifiedWorkspaceId) {
              const { data: ws } = await db.from("workspaces").select("name, brand_url, brand_summary, keywords, country, entity_truth_card, profile").eq("id", verifiedWorkspaceId).eq("owner_id", userId).maybeSingle();
              let { data: kf, error: workspaceFactsError } = await db.from("knowledge_facts").select("fact").eq("user_id", userId).eq("workspace_id", verifiedWorkspaceId).order("created_at", { ascending: false }).limit(20);
              if (workspaceFactsError) {
                console.warn("[maaroof] workspace knowledge lookup failed; retrying by user_id", workspaceFactsError.message);
                const fallbackFacts = await db.from("knowledge_facts").select("fact").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
                kf = fallbackFacts.data;
                workspaceFactsError = fallbackFacts.error;
              }
              const card = (ws as any)?.entity_truth_card || {};
              own = {
                brand: card.entity_name || (ws as any)?.name || null,
                profileText: [card.sector, card.country, JSON.stringify(card.markets || []), JSON.stringify(card.key_facts || []), (ws as any)?.brand_url, (ws as any)?.brand_summary, JSON.stringify((ws as any)?.keywords || []), JSON.stringify((ws as any)?.profile || {})].filter(Boolean).join(" "),
                knowledgeText: ((kf || []) as any[]).map((f) => String(f.fact || "")),
              };
            } else {
              const { data: ep } = await db.from("profiles").select("brand_name, brand_keywords, specialty_scope, target_markets, entity_type").eq("id", userId).maybeSingle();
              let { data: kf, error: accountFactsError } = await db.from("knowledge_facts").select("fact").eq("user_id", userId).is("workspace_id", null).order("created_at", { ascending: false }).limit(20);
              if (accountFactsError) {
                console.warn("[maaroof] account knowledge scope failed; retrying by user_id", accountFactsError.message);
                const fallbackFacts = await db.from("knowledge_facts").select("fact").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
                kf = fallbackFacts.data;
                accountFactsError = fallbackFacts.error;
              }
              own = {
                brand: (ep as any)?.brand_name || null,
                profileText: [ (ep as any)?.brand_keywords, (ep as any)?.specialty_scope, (ep as any)?.entity_type, JSON.stringify((ep as any)?.target_markets || "") ].filter(Boolean).join(" "),
                knowledgeText: ((kf || []) as any[]).map((f) => String(f.fact || "")),
              };
            }
          } catch {}
          const skillChoice = chooseSkillsAutonomously(goal, pickedSkills, own);
          const selectedSkills = skillChoice.skills;
          if (skillChoice.kind === "clarify" && !String(clarifications?.tools || "").trim()) {
            // Only when the brand itself is unknown: ask before any charge instead of guessing.
            return Response.json({ needs_skill: true, options: ["presence_audit", "entity_readiness", "growth_roadmap"] });
          }
          if (probeEngines?.length) clarifications.probe_engines = probeEngines.join(",");
          const ro = body?.run_options || {};
          const runOptions = { salvageOnFailure: ro.salvage_on_failure === true, focusedPlan: ro.focused_plan === true, parallelTools: ro.parallel_tools === true };
          // Smart resume: reuse successful tool outputs of an earlier attempt owned by this user.
          let reusedResults: Record<string, any> | undefined;
          const resumeId = typeof body?.resume_job_id === "string" && /^[0-9a-f-]{36}$/i.test(body.resume_job_id) ? body.resume_job_id : null;
          if (resumeId) {
            let previousJobQuery = db.from("maaroof_jobs").select("id").eq("id", resumeId).eq("user_id", userId);
            previousJobQuery = verifiedWorkspaceId ? previousJobQuery.eq("workspace_id", verifiedWorkspaceId) : previousJobQuery.is("workspace_id", null);
            let { data: prevJob, error: previousJobLookupError } = await previousJobQuery.maybeSingle();
            if (previousJobLookupError) {
              console.warn("[maaroof] resume reuse scope failed; retrying by user_id", previousJobLookupError.message);
              const fallback = await db.from("maaroof_jobs").select("id").eq("id", resumeId).eq("user_id", userId).maybeSingle();
              prevJob = fallback.data;
              previousJobLookupError = fallback.error;
            }
            if (previousJobLookupError) return Response.json({ error: "job_lookup_failed" }, { status: 503 });
            if (prevJob) {
              const { data: evs } = await db.from("maaroof_job_events").select("payload").eq("job_id", resumeId).eq("event_type", "tool_result").order("seq").limit(200);
              const { reusableResults } = await import("@/lib/maaroof/jobs");
              reusedResults = reusableResults((evs || []).map((e: any) => e.payload));
            }
          }
          const jobPayload = {
            user_id: userId, workspace_id: verifiedWorkspaceId, goal, mode: executionMode || "execution", status: "running",
            request_payload: { run_options: runOptions, resume_job_id: resumeId, workspace_id: verifiedWorkspaceId, selected_skills: selectedSkills, skill_choice: skillChoice, probe_engines: probeEngines || [], live_probe: liveProbe !== false, lang, auto_resumed: freeAutoResume },
          };
          let { data: job, error: jobErr } = await db.from("maaroof_jobs").insert(jobPayload).select("id").single();
          if (jobErr && isMissingWorkspaceIdColumn(jobErr)) {
            // Older production schemas may not have the additive workspace_id column yet.
            // Retry once without that column, retaining owner-only access and existing task data.
            console.warn("[maaroof] workspace_id unavailable on maaroof_jobs; retrying legacy insert", jobErr.message);
            const { workspace_id: _workspaceId, ...legacyPayload } = jobPayload;
            const retry = await db.from("maaroof_jobs").insert(legacyPayload).select("id").single();
            job = retry.data;
            jobErr = retry.error;
          }
          if (jobErr || !job) {
            console.error("[maaroof] background job insert failed; executing inline", jobErr?.message || "no row returned");
            return inlineRunResponse({
              request, userId, goal, lang, detectedGeo, geoScope, workspaceId: verifiedWorkspaceId,
              authBearer: auth, origin, executionMode, useSubagents, liveProbe, clarifications,
              reason: String(jobErr?.message || "background_job_insert_failed").slice(0, 240),
            });
          }
          const jobId = job.id as string;
          const { createSeqCounter } = await import("@/lib/maaroof/jobs");
          const next = createSeqCounter();
          const ctl = new AbortController();
          let chain: Promise<unknown> = Promise.resolve();
          let finalText = "";
          const emit = async (event: string, data: any) => {
            if (event === "final" && typeof data?.text === "string") finalText = data.text;
            const seq = next();
            chain = chain.then(async () => {
              const { error } = await db.from("maaroof_job_events").insert({ job_id: jobId, user_id: userId, seq, event_type: event, payload: data ?? {} });
              if (error) console.error("[maaroof job] event save failed", jobId, event, error.message);
            }).catch((e) => console.error("[maaroof job] event save failed", jobId, e));
            if (seq % 3 === 0 || event === "tool_result" || event === "step") {
              const { data: j } = await db.from("maaroof_jobs").select("status").eq("id", jobId).maybeSingle();
              if (j?.status === "cancelled") ctl.abort();
              else await db.from("maaroof_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);
            }
            await chain;
          };
          const work = (async () => {
            let status = "completed"; let err: string | null = null;
            // Heartbeat: a long healthy tool call must not look stale.
            const hb = setInterval(() => {
              db.from("maaroof_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId).eq("status", "running")
                .then(({ error }: any) => { if (error) console.error("[maaroof job] heartbeat failed", jobId, error.message); }, (e: any) => console.error("[maaroof job] heartbeat failed", jobId, e));
            }, 10_000);
            try {
              await emit("skill_choice", skillChoice);
              await runMaaroof({
                userId, goal, language: lang, detectedGeo, geoScope, workspaceId: verifiedWorkspaceId,
                authBearer: auth, origin, emit, signal: ctl.signal, executionMode, useSubagents, liveProbe, clarifications, selectedSkills, reusedResults, runOptions,
              });
            } catch (e: any) {
              status = "failed"; err = String(e?.message || e).slice(0, 500);
              await emit("error", { message: err });
            } finally { clearInterval(hb); }
            await chain;
            const { data: j } = await db.from("maaroof_jobs").select("status").eq("id", jobId).maybeSingle();
            if (j?.status !== "cancelled") {
              const now = new Date().toISOString();
              await db.from("maaroof_jobs").update({ status, error: err, finished_at: now, updated_at: now }).eq("id", jobId);
              if (status === "completed") {
                try {
                  const { taskFact } = await import("@/lib/knowledge-facts");
                  const f = taskFact(goal, finalText);
                  if (f) await db.from("knowledge_facts").insert({ user_id: userId, workspace_id: verifiedWorkspaceId, source: "task", source_ref: jobId, ...f });
                } catch {}
              }
            }
          })();
          const safeWork = work.catch(() => {});
          if (body?.keep_alive === true) {
            // Keep the HTTP connection open for the whole run so the Worker is never frozen
            // after responding. Events still go to the database; the client polls them.
            const enc = new TextEncoder();
            const keepAlive = new ReadableStream({
              async start(controller) {
                const send = (s: string) => { try { controller.enqueue(enc.encode(s)); } catch {} };
                send(`event: job\ndata: ${JSON.stringify({ job_id: jobId })}\n\n`);
                const ping = setInterval(() => send(`: ping\n\n`), 15_000);
                try { await safeWork; } finally {
                  clearInterval(ping);
                  send(`event: done\ndata: {}\n\n`);
                  try { controller.close(); } catch {}
                }
              },
              // Client disconnect does not cancel the job; it may still finish via waitUntil.
              cancel() {},
            });
            const { runAfterResponse } = await import("@/lib/request-ctx.server");
            runAfterResponse(safeWork);
            return new Response(keepAlive, {
              headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Maaroof-Job": jobId },
            });
          }
          const { runAfterResponse } = await import("@/lib/request-ctx.server");
          // Never block the response on the job; the client polls for events.
          runAfterResponse(safeWork);
          // Confirm the job really started (first event saved) before handing back its id.
          let started = false;
          for (let i = 0; i < 10 && !started; i++) {
            const { count } = await db.from("maaroof_job_events").select("id", { count: "exact", head: true }).eq("job_id", jobId);
            started = (count || 0) > 0;
            if (!started) await new Promise((r) => setTimeout(r, 300));
          }
          if (!started) console.error("[maaroof job] no start event within 3s", jobId);
          return Response.json({ job_id: jobId, started });
        }

        const encoder = new TextEncoder();
        const abortCtl = new AbortController();
        request.signal.addEventListener("abort", () => abortCtl.abort());

        const stream = new ReadableStream({
          async start(controller) {
            const emit = async (event: string, data: any) => {
              try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch {}
            };
            try {
              await runMaaroof({
                userId, goal, language: lang, detectedGeo, geoScope, workspaceId: verifiedWorkspaceId,
                authBearer: auth, origin, emit, signal: abortCtl.signal, executionMode, useSubagents, liveProbe, clarifications,
              });
            } catch (e: any) {
              await emit("error", { message: String(e?.message || e) });
            } finally {
              try { controller.close(); } catch {}
            }
          },
          cancel() { abortCtl.abort(); },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
