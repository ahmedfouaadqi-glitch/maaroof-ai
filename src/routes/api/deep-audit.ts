// Deep account audit: GET = estimate (no charge), POST = start background job after explicit approval.
// Reuses maaroof_jobs/maaroof_job_events + runAfterResponse. Charges once, only for targets that produced content.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { auditTargets, scoreTarget, aggregateAxes, billableUnits, weightedScore, workspaceAuditLinks, type AuditTarget } from "@/lib/maaroof/deep-audit";
import { isAccountKind } from "@/lib/account-kinds";

const TOOL_KEY = "analyze.deep_audit"; // falls back to the parent tool price when not priced separately
const TARGET_TIMEOUT_MS = 40_000; // per link, covers the full provider fallback chain (15s per attempt)
const UUID = /^[0-9a-f-]{36}$/i;

async function auth(request: Request) {
  const h = request.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await admin.auth.getUser(h.slice(7));
  return data.user?.id ? { admin: admin as any, userId: data.user.id } : null;
}

async function loadProfile(db: any, userId: string) {
  const { data } = await db.from("profiles").select("brand_name, account_kind, entity_links, tokens_balance").eq("id", userId).maybeSingle();
  return data || {};
}

async function loadWorkspace(db: any, userId: string, workspaceId: string) {
  return db.from("workspaces")
    .select("id, name, brand_url, brand_summary, entity_truth_card, profile")
    .eq("id", workspaceId).eq("owner_id", userId).maybeSingle();
}

function scopedJobs(query: any, workspaceId: string | null) {
  return workspaceId ? query.eq("workspace_id", workspaceId) : query.is("workspace_id", null);
}

function scopeError(error: any) {
  return String(error?.message || "").toLowerCase().includes("workspace_id") ? "workspace_scope_unavailable" : "audit_history_unavailable";
}

async function runAudit(db: any, userId: string, jobId: string, targets: AuditTarget[], brand: string, kind: string | null, startSeq = 0) {
  let seq = startSeq;
  let cursor = 0;
  let cancelled = false;
  const CONCURRENCY = 3;
  const emit = (event_type: string, payload: any) =>
    db.from("maaroof_job_events").insert({ job_id: jobId, user_id: userId, seq: ++seq, event_type, payload });
  const results: { url: string; kind: string; platform: string | null; ok: boolean; findings: ReturnType<typeof scoreTarget> }[] = [];

  async function auditOne(index: number) {
    const { data: j } = await db.from("maaroof_jobs").select("status").eq("id", jobId).eq("user_id", userId).maybeSingle();
    if (j?.status === "cancelled") { cancelled = true; return; }

    const t = targets[index];
    await emit("audit_progress", { index: index + 1, total: targets.length, url: t.url, phase: "reading" });
    await db.from("maaroof_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId).eq("user_id", userId);

    let ev: any = null;
    let source: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const { fcScrape } = await import("@/lib/firecrawl");
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("target_timeout")), TARGET_TIMEOUT_MS);
      });
      const r: any = await Promise.race([fcScrape(t.url, { deep: t.kind === "official" }, { userId, toolKey: TOOL_KEY }), timeout]);
      const d = r?.data ?? r;
      source = r?.fetch_source ?? null;
      ev = { markdown: d?.markdown, html: d?.html, title: d?.metadata?.title, description: d?.metadata?.description, statusCode: d?.metadata?.statusCode };
    } catch {
      ev = null;
    } finally {
      if (timer) clearTimeout(timer);
    }

    const findings = scoreTarget(t, ev, brand);
    const ok = findings.some((f) => f.score != null);
    results.push({ url: t.url, kind: t.kind, platform: t.platform, ok, findings });
    const { sourceLabel } = await import("@/lib/fetch-order");
    await emit("audit_target", {
      index: index + 1, total: targets.length, url: t.url, kind: t.kind, platform: t.platform,
      ok, findings, source, source_label: sourceLabel(ok ? (source as any) : null),
    });
    await db.from("maaroof_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId).eq("user_id", userId);
  }

  async function worker() {
    while (!cancelled) {
      const index = cursor++;
      if (index >= targets.length) return;
      await auditOne(index);
    }
  }

  try {
    // Bounded concurrency keeps larger multi-link audits practical without flooding crawl providers.
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker()));
    if (cancelled) return;
    const axes = aggregateAxes(results.map((r) => r.findings));
    const overall = weightedScore(axes, isAccountKind(kind) ? kind : null);
    const units = billableUnits(results);
    let charged = 0;
    if (units > 0) {
      const { chargeTokens } = await import("@/lib/tokens.server");
      const c = await chargeTokens({ userId, toolKey: TOOL_KEY, runId: "deep_audit:" + jobId, units, meta: { endpoint: "/api/deep-audit", targets: targets.length, succeeded: units } });
      charged = c.ok ? c.tokens : 0;
    }
    await emit("audit_result", { axes, overall, succeeded: units, total: targets.length, charged, targets: results });
    if (cancelled) return;
    const now = new Date().toISOString();
    await db.from("maaroof_jobs").update({ status: units > 0 ? "completed" : "failed", error: units > 0 ? null : "تعذّرت قراءة أي رابط؛ لم يُخصم شيء.", finished_at: now, updated_at: now }).eq("id", jobId).eq("user_id", userId);
  } catch (e: any) {
    const now = new Date().toISOString();
    await db.from("maaroof_jobs").update({ status: "failed", error: "تعذّر إكمال الفحص؛ لم يُخصم شيء.", finished_at: now, updated_at: now }).eq("id", jobId).eq("user_id", userId);
  }
}

export const Route = createFileRoute("/api/deep-audit")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await auth(request);
        if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const url = new URL(request.url);
        const rawWorkspaceId = (url.searchParams.get("workspace_id") || "").trim();
        const workspaceId = rawWorkspaceId || null;
        if (workspaceId && !UUID.test(workspaceId)) return Response.json({ error: "invalid_workspace" }, { status: 400 });

        const p = await loadProfile(a.admin, a.userId);
        let workspace: any = null;
        if (workspaceId) {
          const loaded = await loadWorkspace(a.admin, a.userId, workspaceId);
          if (loaded.error) return Response.json({ error: scopeError(loaded.error) }, { status: 503 });
          if (!loaded.data) return Response.json({ error: "workspace_not_found" }, { status: 404 });
          workspace = loaded.data;
        }
        const card = workspace?.entity_truth_card && typeof workspace.entity_truth_card === "object" ? workspace.entity_truth_card : {};
        const targets = auditTargets(workspace ? workspaceAuditLinks(workspace) : p.entity_links);
        const brand = String(workspace ? (card.entity_name || workspace.name || "") : (p.brand_name || ""));
        const workspaceProfile = workspace?.profile && typeof workspace.profile === "object" ? workspace.profile : {};
        const kind = workspace
          ? (isAccountKind(card.account_kind) ? card.account_kind : isAccountKind(workspaceProfile.account_kind) ? workspaceProfile.account_kind : null)
          : (isAccountKind(p.account_kind) ? p.account_kind : null);
        const { resolveToolCost } = await import("@/lib/tokens.server");
        const cost = await resolveToolCost(a.userId, TOOL_KEY);

        const { data: last, error: lastError } = await scopedJobs(
          a.admin.from("maaroof_jobs").select("id, status, error, created_at, updated_at")
            .eq("user_id", a.userId).eq("mode", "deep_audit"), workspaceId,
        ).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (lastError) return Response.json({ error: scopeError(lastError) }, { status: 503 });

        const { data: done, error: doneError } = await scopedJobs(
          a.admin.from("maaroof_jobs").select("id, created_at")
            .eq("user_id", a.userId).eq("mode", "deep_audit").eq("status", "completed"), workspaceId,
        ).order("created_at", { ascending: false }).limit(3);
        if (doneError) return Response.json({ error: scopeError(doneError) }, { status: 503 });

        let previous: { id: string; overall: number | null; created_at: string } | null = null;
        const prevJob = (done || []).find((j: any) => j.id !== last?.id) || null;
        if (prevJob) {
          const { data: ev, error: eventError } = await a.admin.from("maaroof_job_events").select("payload")
            .eq("job_id", prevJob.id).eq("user_id", a.userId).eq("event_type", "audit_result").limit(1).maybeSingle();
          if (eventError) return Response.json({ error: "audit_history_unavailable" }, { status: 503 });
          previous = { id: prevJob.id, created_at: prevJob.created_at, overall: ev?.payload?.overall ?? null };
        }
        return Response.json({
          targets, perTarget: cost.tokens, estimate: cost.tokens * targets.length,
          priced: cost.source !== "unpriced", balance: Number(p.tokens_balance) || 0,
          last: last || null, previous, workspace_id: workspaceId,
          workspace_name: workspace?.name || null, brand, kind,
        });
      },
      POST: async ({ request }) => {
        const a = await auth(request);
        if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const body = await request.json().catch(() => ({} as any));
        if (body?.approved !== true) return Response.json({ error: "approval_required" }, { status: 400 });
        const rawWorkspaceId = typeof body?.workspace_id === "string" ? body.workspace_id.trim() : "";
        const workspaceId = rawWorkspaceId || null;
        if (workspaceId && !UUID.test(workspaceId)) return Response.json({ error: "invalid_workspace" }, { status: 400 });
        const db = a.admin;
        const p = await loadProfile(db, a.userId);
        let workspace: any = null;
        if (workspaceId) {
          const loaded = await loadWorkspace(db, a.userId, workspaceId);
          if (loaded.error) return Response.json({ error: scopeError(loaded.error) }, { status: 503 });
          if (!loaded.data) return Response.json({ error: "workspace_not_found" }, { status: 404 });
          workspace = loaded.data;
        }
        const card = workspace?.entity_truth_card && typeof workspace.entity_truth_card === "object" ? workspace.entity_truth_card : {};
        const targets = auditTargets(workspace ? workspaceAuditLinks(workspace) : p.entity_links);
        if (!targets.length) return Response.json({ error: "no_links" }, { status: 400 });

        const { data: active, error: activeError } = await scopedJobs(
          db.from("maaroof_jobs").select("id, status, updated_at")
            .eq("user_id", a.userId).eq("mode", "deep_audit").in("status", ["queued", "running"]), workspaceId,
        ).limit(1).maybeSingle();
        if (activeError) return Response.json({ error: scopeError(activeError) }, { status: 503 });
        if (active) {
          const { isStaleAuditJob } = await import("@/lib/maaroof/jobs");
          if (!isStaleAuditJob(active)) return Response.json({ job_id: active.id, reused: true });
          const now = new Date().toISOString();
          await db.from("maaroof_jobs").update({ status: "failed", error: "توقف الفحص دون تقدّم؛ لم يُخصم شيء.", finished_at: now, updated_at: now })
            .eq("id", active.id).eq("user_id", a.userId);
        }
        const { data: job, error } = await db.from("maaroof_jobs").insert({
          user_id: a.userId, workspace_id: workspaceId,
          goal: workspace ? `الفحص العميق لحساب: ${workspace.name}` : "الفحص العميق للحساب",
          mode: "deep_audit", status: "running",
          request_payload: { workspace_id: workspaceId, targets: targets.map((t) => t.url) },
        }).select("id").single();
        if (error || !job) return Response.json({ error: error && String(error.message || "").includes("workspace_id") ? "workspace_scope_unavailable" : "job_create_failed" }, { status: 500 });
        const { error: startErr } = await db.from("maaroof_job_events").insert({
          job_id: job.id, user_id: a.userId, seq: 1, event_type: "audit_start",
          payload: { workspace_id: workspaceId, total: targets.length, targets: targets.map((t) => t.url) },
        });
        if (startErr) console.error("[deep-audit] start event failed", startErr);
        await runAudit(db, a.userId, job.id, targets,
          String(workspace ? (card.entity_name || workspace.name || "") : (p.brand_name || "")),
          workspace ? (isAccountKind(card.account_kind) ? card.account_kind : isAccountKind((workspace.profile || {}).account_kind) ? (workspace.profile || {}).account_kind : null) : (isAccountKind(p.account_kind) ? p.account_kind : null), 1);
        return Response.json({ job_id: job.id });
      },
    },
  },
});
