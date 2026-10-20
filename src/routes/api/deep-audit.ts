// Deep account audit: GET = estimate (no charge), POST = start background job after explicit approval.
// Reuses maaroof_jobs/maaroof_job_events + runAfterResponse. Charges once, only for targets that produced content.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { auditTargets, scoreTarget, aggregateAxes, billableUnits, weightedScore, type AuditTarget } from "@/lib/maaroof/deep-audit";
import { isAccountKind } from "@/lib/account-kinds";

const TOOL_KEY = "analyze.deep_audit"; // falls back to the parent tool price when not priced separately

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

async function runAudit(db: any, userId: string, jobId: string, targets: AuditTarget[], brand: string, kind: string | null) {
  let seq = 0;
  const emit = (event_type: string, payload: any) => db.from("maaroof_job_events").insert({ job_id: jobId, user_id: userId, seq: ++seq, event_type, payload });
  const results: { url: string; kind: string; platform: string | null; ok: boolean; findings: ReturnType<typeof scoreTarget> }[] = [];
  try {
    const { fcScrape } = await import("@/lib/firecrawl");
    for (let i = 0; i < targets.length; i++) {
      const { data: j } = await db.from("maaroof_jobs").select("status").eq("id", jobId).maybeSingle();
      if (j?.status === "cancelled") return;
      const t = targets[i];
      let ev: any = null;
      try {
        const r: any = await fcScrape(t.url, { deep: t.kind === "official" }, { userId, toolKey: TOOL_KEY });
        const d = r?.data ?? r;
        ev = { markdown: d?.markdown, html: d?.html, title: d?.metadata?.title, description: d?.metadata?.description, statusCode: d?.metadata?.statusCode };
      } catch { ev = null; }
      const findings = scoreTarget(t, ev, brand);
      const ok = findings.some((f) => f.score != null);
      results.push({ url: t.url, kind: t.kind, platform: t.platform, ok, findings });
      await emit("audit_target", { index: i + 1, total: targets.length, url: t.url, kind: t.kind, platform: t.platform, ok, findings });
      await db.from("maaroof_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);
    }
    const axes = aggregateAxes(results.map((r) => r.findings));
    const overall = weightedScore(axes, isAccountKind(kind) ? kind : null);
    const units = billableUnits(results);
    let charged = 0;
    if (units > 0) {
      const { chargeTokens } = await import("@/lib/tokens.server");
      const c = await chargeTokens({ userId, toolKey: TOOL_KEY, runId: `deep_audit:${jobId}`, units, meta: { endpoint: "/api/deep-audit", targets: targets.length, succeeded: units } });
      charged = c.ok ? c.tokens : 0;
    }
    await emit("audit_result", { axes, overall, succeeded: units, total: targets.length, charged, targets: results });
    const now = new Date().toISOString();
    await db.from("maaroof_jobs").update({ status: units > 0 ? "completed" : "failed", error: units > 0 ? null : "تعذّرت قراءة أي رابط؛ لم يُخصم شيء.", finished_at: now, updated_at: now }).eq("id", jobId);
  } catch (e: any) {
    const now = new Date().toISOString();
    await db.from("maaroof_jobs").update({ status: "failed", error: "تعذّر إكمال الفحص؛ لم يُخصم شيء.", finished_at: now, updated_at: now }).eq("id", jobId);
  }
}

export const Route = createFileRoute("/api/deep-audit")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await auth(request);
        if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const p = await loadProfile(a.admin, a.userId);
        const targets = auditTargets(p.entity_links);
        const { resolveToolCost } = await import("@/lib/tokens.server");
        const cost = await resolveToolCost(a.userId, TOOL_KEY);
        const { data: last } = await a.admin.from("maaroof_jobs").select("id, status, error, created_at, updated_at")
          .eq("user_id", a.userId).eq("mode", "deep_audit").order("created_at", { ascending: false }).limit(1).maybeSingle();
        return Response.json({ targets, perTarget: cost.tokens, estimate: cost.tokens * targets.length, priced: cost.source !== "unpriced", balance: Number(p.tokens_balance) || 0, last: last || null });
      },
      POST: async ({ request }) => {
        const a = await auth(request);
        if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const body = await request.json().catch(() => ({} as any));
        if (body?.approved !== true) return Response.json({ error: "approval_required" }, { status: 400 });
        const db = a.admin;
        const { data: active } = await db.from("maaroof_jobs").select("id").eq("user_id", a.userId).eq("mode", "deep_audit").in("status", ["queued", "running"]).limit(1).maybeSingle();
        if (active) return Response.json({ job_id: active.id, reused: true });
        const p = await loadProfile(db, a.userId);
        const targets = auditTargets(p.entity_links);
        if (!targets.length) return Response.json({ error: "no_links" }, { status: 400 });
        const { data: job, error } = await db.from("maaroof_jobs").insert({
          user_id: a.userId, goal: "الفحص العميق للحساب", mode: "deep_audit", status: "running", request_payload: { targets: targets.map((t) => t.url) },
        }).select("id").single();
        if (error || !job) return Response.json({ error: "job_create_failed" }, { status: 500 });
        const work = runAudit(db, a.userId, job.id, targets, String(p.brand_name || ""), p.account_kind || null);
        const { runAfterResponse } = await import("@/lib/request-ctx.server");
        if (!runAfterResponse(work)) await work;
        return Response.json({ job_id: job.id });
      },
    },
  },
});
