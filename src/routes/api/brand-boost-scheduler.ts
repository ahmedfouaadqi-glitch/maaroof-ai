import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createInternalAuthHeader } from "@/lib/internal-auth.server";
import { nextBrandBoostRunAt, previousCalendarMonth, shouldSendMonthlyBrandReport } from "@/lib/brand-boost-automation";
import { sendBrandMonthlyReport } from "@/lib/brand-boost-mail.server";

function safeEqual(a: string, b: string): boolean {
  const aa = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = aa.length ^ bb.length;
  const n = Math.max(aa.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

async function runDueJobs(admin: any, origin: string, now: Date) {
  const isoNow = now.toISOString();
  const { data: jobs, error } = await admin.from("brand_boost_jobs")
    .select("id, user_id, workspace_id, brand_name, brand_keywords, platforms, frequency, next_run_at, config")
    .eq("active", true).eq("approved", true).not("next_run_at", "is", null)
    .lte("next_run_at", isoNow).order("next_run_at", { ascending: true }).limit(5);
  if (error) throw new Error("brand_boost_jobs_read_failed: " + error.message);

  const results: Array<{ job_id: string; status: string; detail?: string }> = [];
  for (const job of jobs || []) {
    const nextRunAt = nextBrandBoostRunAt(String(job.frequency || "weekly"), now).toISOString();
    let claimQuery = admin.from("brand_boost_jobs")
      .update({ next_run_at: nextRunAt })
      .eq("id", job.id).eq("user_id", job.user_id).eq("active", true).eq("approved", true)
      .eq("next_run_at", job.next_run_at);
    const { data: claimed, error: claimError } = await claimQuery.select("id").maybeSingle();
    if (claimError) {
      results.push({ job_id: job.id, status: "claim_failed", detail: claimError.message });
      continue;
    }
    if (!claimed) {
      results.push({ job_id: job.id, status: "already_claimed" });
      continue;
    }

    const internalHeader = await createInternalAuthHeader(job.user_id, "/api/brand-boost", "POST");
    if (!internalHeader) {
      await admin.from("brand_boost_runs").insert({
        job_id: job.id, user_id: job.user_id, workspace_id: job.workspace_id || null,
        status: "failed", report: { error: "internal_auth_unavailable", scheduled: true },
      });
      results.push({ job_id: job.id, status: "failed", detail: "internal_auth_unavailable" });
      continue;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 100_000);
      let response: Response;
      try {
        response = await fetch(new URL("/api/brand-boost", origin), {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-maaroof-internal-auth": internalHeader },
          body: JSON.stringify({
            brand_name: job.brand_name,
            brand_keywords: job.brand_keywords || "",
            website_url: String((job.config as any)?.website_url || ""),
            platforms: Array.isArray(job.platforms) ? job.platforms : [],
            lang: String((job.config as any)?.lang || "ar"),
            scope: (job.config as any)?.scope || undefined,
            workspace_id: job.workspace_id || null,
            scheduled: true,
            brand_boost_job_id: job.id,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      const raw = await response.text();
      let report: any = {};
      try { report = raw ? JSON.parse(raw) : {}; } catch { report = { error: raw.slice(0, 300) }; }
      const status = response.ok ? "done" : "failed";
      const { error: runError } = await admin.from("brand_boost_runs").insert({
        job_id: job.id,
        user_id: job.user_id,
        workspace_id: job.workspace_id || null,
        status,
        report: { ...report, scheduled: true, http_status: response.status, scheduler_run_at: isoNow },
      });
      await admin.from("brand_boost_jobs").update({ last_run_at: isoNow })
        .eq("id", job.id).eq("user_id", job.user_id);
      if (runError) {
        results.push({ job_id: job.id, status: "result_persist_failed", detail: runError.message });
      } else {
        results.push({ job_id: job.id, status: status === "done" ? "completed" : "failed", detail: report.error || undefined });
      }
    } catch (error: any) {
      const message = String(error?.name === "AbortError" ? "brand_boost_timeout" : error?.message || "brand_boost_dispatch_failed").slice(0, 300);
      await admin.from("brand_boost_runs").insert({
        job_id: job.id, user_id: job.user_id, workspace_id: job.workspace_id || null,
        status: "failed", report: { error: message, scheduled: true, scheduler_run_at: isoNow },
      });
      await admin.from("brand_boost_jobs").update({ last_run_at: isoNow })
        .eq("id", job.id).eq("user_id", job.user_id);
      results.push({ job_id: job.id, status: "failed", detail: message });
    }
  }
  return results;
}

async function sendMonthlyReports(admin: any, now: Date) {
  if (!shouldSendMonthlyBrandReport(now)) return { considered: 0, sent: 0, failed: 0, skipped: 0 };
  const period = previousCalendarMonth(now);
  const { data: settings, error } = await admin.from("brand_boost_report_settings")
    .select("id, user_id, workspace_id, email_to")
    .eq("enabled", true).limit(100);
  if (error) throw new Error("report_settings_read_failed: " + error.message);

  const result = { considered: (settings || []).length, sent: 0, failed: 0, skipped: 0 };
  for (const setting of settings || []) {
    const scopeKey = setting.workspace_id || "account";
    const deliveryKey = "brandboost-monthly:" + setting.user_id + ":" + scopeKey + ":" + period.month;
    const { data: existing, error: existingError } = await admin.from("brand_boost_report_deliveries")
      .select("id, status, updated_at, attempts")
      .eq("delivery_key", deliveryKey).maybeSingle();
    if (existingError) { result.failed++; continue; }
    if (existing?.status === "sent") { result.skipped++; continue; }
    if (existing?.status === "processing" && Date.now() - new Date(existing.updated_at).getTime() < 20 * 60 * 1000) {
      result.skipped++; continue;
    }

    let deliveryId = existing?.id;
    if (!existing) {
      const { data: inserted, error: insertError } = await admin.from("brand_boost_report_deliveries").insert({
        delivery_key: deliveryKey, user_id: setting.user_id, workspace_id: setting.workspace_id || null,
        report_month: period.month, email_to: setting.email_to, status: "pending",
      }).select("id").maybeSingle();
      if (insertError && insertError.code !== "23505") { result.failed++; continue; }
      deliveryId = inserted?.id;
      if (!deliveryId) {
        const { data: raced } = await admin.from("brand_boost_report_deliveries").select("id").eq("delivery_key", deliveryKey).maybeSingle();
        deliveryId = raced?.id;
      }
    }
    if (!deliveryId) { result.failed++; continue; }

    const expectedStatus = existing?.status || "pending";
    let claim = admin.from("brand_boost_report_deliveries").update({
      status: "processing", error_message: null, email_to: setting.email_to,
      attempts: Number(existing?.attempts || 0) + 1, started_at: now.toISOString(), updated_at: now.toISOString(),
    }).eq("id", deliveryId).eq("status", expectedStatus);
    if (existing?.updated_at) claim = claim.eq("updated_at", existing.updated_at);
    const { data: claimed } = await claim.select("id").maybeSingle();
    if (!claimed) { result.skipped++; continue; }

    try {
      let opsQuery = admin.from("brand_operations")
        .select("operation_type, status, charged_units, brand_name, result_meta")
        .eq("user_id", setting.user_id).gte("created_at", period.start).lt("created_at", period.end);
      opsQuery = setting.workspace_id ? opsQuery.eq("workspace_id", setting.workspace_id) : opsQuery.is("workspace_id", null);
      const { data: ops, error: opsError } = await opsQuery.limit(2000);
      if (opsError) throw new Error("report_operations_read_failed");
      let hitsQuery = admin.from("crawler_hits")
        .select("bot_name, verification_status").eq("user_id", setting.user_id)
        .gte("hit_at", period.start).lt("hit_at", period.end);
      hitsQuery = setting.workspace_id ? hitsQuery.eq("workspace_id", setting.workspace_id) : hitsQuery.is("workspace_id", null);
      const { data: hits, error: hitsError } = await hitsQuery.limit(10000);
      if (hitsError) throw new Error("report_crawler_hits_read_failed");

      const operations = ops || [];
      const crawlerHits = hits || [];
      const brandName = String(operations.find((x: any) => x.brand_name)?.brand_name || "Brand Boost");
      const breakdown = new Map<string, { total: number; verified: number }>();
      for (const hit of crawlerHits) {
        const name = String(hit.bot_name || "Unknown");
        const item = breakdown.get(name) || { total: 0, verified: 0 };
        item.total++;
        if (hit.verification_status === "verified") item.verified++;
        breakdown.set(name, item);
      }
      const mailReport = {
        brandName, month: period.month, operationCount: operations.length,
        completedCount: operations.filter((x: any) => x.status === "completed").length,
        failedCount: operations.filter((x: any) => x.status === "failed" || x.status === "partial").length,
        chargedUnits: operations.reduce((sum: number, x: any) => sum + Number(x.charged_units || 0), 0),
        crawlerHits: crawlerHits.length,
        verifiedCrawlerHits: crawlerHits.filter((x: any) => x.verification_status === "verified").length,
        crawlerBreakdown: Array.from(breakdown, ([name, counts]) => ({ name, ...counts })).sort((a, b) => b.total - a.total),
      };
      const sent = await sendBrandMonthlyReport(mailReport, setting.email_to, deliveryKey);
      await admin.from("brand_boost_report_deliveries").update({
        status: "sent", provider_message_id: sent.id, error_message: null,
        sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", deliveryId).eq("status", "processing");
      result.sent++;
    } catch (error: any) {
      await admin.from("brand_boost_report_deliveries").update({
        status: "failed", error_message: String(error?.message || "monthly_report_failed").slice(0, 300),
        updated_at: new Date().toISOString(),
      }).eq("id", deliveryId).eq("status", "processing");
      result.failed++;
    }
  }
  return result;
}

export const Route = createFileRoute("/api/brand-boost-scheduler")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.BRAND_BOOST_SCHEDULER_SECRET || "";
        const provided = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (!expected || !provided || !safeEqual(provided, expected)) {
          return Response.json({ error: "scheduler_auth_required" }, { status: 401 });
        }
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) return Response.json({ error: "server_not_configured" }, { status: 500 });
        const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        const now = new Date();
        try {
          const jobs = await runDueJobs(admin, new URL(request.url).origin, now);
          const reports = await sendMonthlyReports(admin, now);
          return Response.json({ ok: true, tick_at: now.toISOString(), processed_jobs: jobs.length, jobs, monthly_reports: reports });
        } catch (error: any) {
          console.error("[brand-boost-scheduler] tick failed", error);
          return Response.json({ error: "scheduler_tick_failed", detail: String(error?.message || "").slice(0, 200) }, { status: 500 });
        }
      },
    },
  },
});
