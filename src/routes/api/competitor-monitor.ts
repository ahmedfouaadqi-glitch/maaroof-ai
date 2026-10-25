import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fcSearch } from "@/lib/firecrawl";
import { planSourceRoute } from "@/lib/maaroof/source-intelligence";
import { recordEvidence } from "@/lib/maaroof/evidence.server";
import { chargeTokens, chargeFailureBody, resolveToolCost } from "@/lib/tokens.server";
import { resolveMonitorPolicy, checkMonitorPolicy } from "@/lib/monitor-policy";

const COST = 2;

const SEARCH_COUNT_LIMIT = 8;
const BASELINE_METHOD = "search_result_count_proxy_v1";

async function buildBaseline(brand: string, competitors: string[], lang: string, userId?: string, workspaceId?: string | null) {
  const targets = [brand, ...competitors].slice(0, 6);
  const out: Record<string, {
    mentions: number; top: string[]; metric_kind: string; sample_size: number;
    retrieved_at: string; query: string; language: string; limitation: string; status: string;
  }> = {};
  for (const t of targets) {
    const retrievedAt = new Date().toISOString();
    const query = `"${t}"`;
    try {
      const routePlan = planSourceRoute({
        goal: query,
        capability: "web_search",
        language: lang,
        market: null,
        available: { webSearch: true, directRead: true, alexandria: false },
        budget: { maxRequests: 1, maxEstimatedCredits: 10 },
      });
      if (routePlan.primary === "none" || routePlan.searchSources.length === 0) {
        out[t] = {
          mentions: 0, top: [], metric_kind: BASELINE_METHOD, sample_size: 0,
          retrieved_at: retrievedAt, query, language: String(lang), status: "unavailable",
          limitation: "لم يُنفذ البحث لأن خطة المصدر لم تسمح بطلب ضمن الميزانية المتاحة.",
        };
        continue;
      }
      const sr: any = await fcSearch(query, { limit: SEARCH_COUNT_LIMIT, lang, sources: routePlan.searchSources }, { userId, toolKey: "competitor_monitor" });
      const raw = sr?.data?.web ?? sr?.web ?? sr?.data ?? [];
      const list = Array.isArray(raw) ? raw : [];
      const top = list.slice(0, 5).map((r: any) => String(r?.url || "")).filter((url: string) => /^https?:\/\//i.test(url));
      out[t] = {
        mentions: list.length,
        top,
        metric_kind: BASELINE_METHOD,
        sample_size: list.length,
        retrieved_at: retrievedAt,
        query,
        language: String(lang),
        status: list.length ? "success" : "empty",
        limitation: "عدد نتائج البحث مؤشر تقريبي متغير؛ لا يثبت حصة السوق أو الوعي أو الظهور الفعلي في إجابات النماذج.",
      };
      if (userId && list.length) {
        await Promise.allSettled(list.slice(0, 8).map((result: any) => {
          const url = String(result?.url || "");
          if (!/^https?:\/\//i.test(url)) return Promise.resolve(null);
          return recordEvidence({
            userId,
            workspaceId: workspaceId || null,
            title: String(result?.title || t).slice(0, 300),
            claim: "A public search result was returned for a branded query; the result count is only a search proxy.",
            sourceKind: "external",
            sourceRef: url,
            evidenceType: "external",
            category: "market",
            collectionMethod: BASELINE_METHOD,
            provider: "public_web",
            capability: "competitor_monitor",
            retrievedAt,
            locale: String(lang),
            measurementUnit: "search_result",
            sampleSize: list.length,
            realityKind: "observation",
            status: "success",
            limitation: "Search-result counts vary with index, query, language and time; they are not market share or direct AI-answer visibility.",
            sourceReliability: 55,
            relevanceScore: 70,
            businessImportance: 55,
            language: String(lang),
          });
        }));
      }
    } catch {
      out[t] = {
        mentions: 0, top: [], metric_kind: BASELINE_METHOD, sample_size: 0,
        retrieved_at: retrievedAt, query, language: String(lang), status: "unavailable",
        limitation: "تعذر البحث عن هذا الاسم؛ لم يُحتسب الصفر كدليل على غياب العلامة.",
      };
    }
  }
  return out;
}

export const Route = createFileRoute("/api/competitor-monitor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!SUPABASE_URL || !SERVICE) return Response.json({ error: "internal_error" }, { status: 500 });
        const admin = createClient(SUPABASE_URL, SERVICE);

        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return Response.json({ error: "auth_required" }, { status: 401 });
        const { data: userData } = await admin.auth.getUser(auth.slice(7));
        const userId = userData?.user?.id;
        if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });
        const body = await request.json();

        const { action, id, brand, competitors = [], frequency_hours = 24, lang = "ar", scope } = body;
        const workspaceId = typeof body.workspace_id === "string" ? body.workspace_id.trim() : null;
        if (workspaceId) {
          if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return Response.json({ error: "invalid_workspace" }, { status: 400 });
          const { data: ownedWorkspace } = await admin.from("workspaces").select("id").eq("id", workspaceId).eq("owner_id", userId).maybeSingle();
          if (!ownedWorkspace) return Response.json({ error: "workspace_not_found" }, { status: 404 });
        }
        const withWorkspace = (query: any) => workspaceId
          ? query.eq("workspace_id", workspaceId)
          : query.is("workspace_id", null);

        // Only billable actions consume quota (list/delete/policy are free).
        const charge = async () => {
          const _chg = await chargeTokens({ userId, toolKey: "competitor_monitor", runId: crypto.randomUUID(), meta: { provider: "lovable_ai", model: "google/gemini-2.5-flash-lite", endpoint: "/api/competitor-monitor", action } });
          return _chg.ok ? null : Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });
        };
        const loadPolicy = async () => {
          const [{ data: gs }, { data: pr }] = await Promise.all([
            admin.from("app_settings").select("value").eq("key", "monitor_policy").maybeSingle(),
            admin.from("profiles").select("quota_overrides").eq("id", userId).maybeSingle(),
          ]);
          return resolveMonitorPolicy((gs as any)?.value, (pr as any)?.quota_overrides?.monitor);
        };

        if (action === "policy") {
          const policy = await loadPolicy();
          const { count } = await withWorkspace(admin.from("competitor_watch").select("id", { count: "exact", head: true }).eq("user_id", userId));
          const cost = await resolveToolCost(userId, "competitor_monitor");
          return Response.json({ policy, active: count || 0, cost_tokens: cost.tokens });
        }

        if (action === "list") {
          const { data } = await withWorkspace(admin.from("competitor_watch").select("*").eq("user_id", userId)).order("created_at", { ascending: false });
          return Response.json({ items: data || [] });
        }

        if (action === "delete") {
          if (!id) return Response.json({ error: "id_required" }, { status: 400 });
          await withWorkspace(admin.from("competitor_watch").delete().eq("id", id).eq("user_id", userId));
          return Response.json({ ok: true });
        }

        if (action === "create") {
          if (!brand || !Array.isArray(competitors) || competitors.length === 0) {
            return Response.json({ error: "brand_and_competitors_required" }, { status: 400 });
          }
          const policy = await loadPolicy();
          const { count: active } = await withWorkspace(admin.from("competitor_watch").select("id", { count: "exact", head: true }).eq("user_id", userId));
          const pc = checkMonitorPolicy(policy, active || 0, competitors.length, Number(frequency_hours) || 24);
          if (!pc.ok) return Response.json({ error: pc.reason, policy }, { status: 403 });
          const { data: prof } = await admin.from("profiles").select("monthly_analyses_used,is_subscribed,quota_overrides").eq("id", userId).maybeSingle();
          const used = Number((prof as any)?.monthly_analyses_used || 0);
          const overrideLimit = Number((prof as any)?.quota_overrides?.monthly_analyses || 0);
          const limit = (prof as any)?.is_subscribed ? Math.max(100, overrideLimit) : Math.max(5, overrideLimit);
          if (!(prof as any)?.is_subscribed && limit - used < COST) {
            return Response.json({ error: "subscription_required" }, { status: 402 });
          }
          { const f = await charge(); if (f) return f; }
          const baseline = await buildBaseline(brand, competitors, lang, userId, workspaceId || null);
          const { data: row, error } = await admin.from("competitor_watch").insert({
            user_id: userId, workspace_id: workspaceId, brand, competitors, frequency_hours, scope, baseline, last_run_at: new Date().toISOString(),
          }).select().single();
          if (error) return Response.json({ error: error.message }, { status: 500 });
          await admin.from("profiles").update({ monthly_analyses_used: used + COST }).eq("id", userId);
          return Response.json({ item: row });
        }

        if (action === "recheck") {
          if (!id) return Response.json({ error: "id_required" }, { status: 400 });
          const { data: w } = await withWorkspace(admin.from("competitor_watch").select("*").eq("id", id).eq("user_id", userId)).maybeSingle();
          if (!w) return Response.json({ error: "not_found" }, { status: 404 });
          { const f = await charge(); if (f) return f; }
          const fresh = await buildBaseline((w as any).brand, (w as any).competitors as string[], lang, userId, workspaceId || null);
          const baseline = (w as any).baseline || {};
          const newAlerts: any[] = [];
          for (const k of Object.keys(fresh)) {
            const prev = Number(baseline[k]?.mentions || 0);
            const now = Number(fresh[k]?.mentions || 0);
            // Do not interpret unavailable/empty-source fallbacks as a market change.
            if (["unavailable", "empty"].includes(String(baseline[k]?.status || "")) || ["unavailable", "empty"].includes(String(fresh[k]?.status || ""))) continue;
            const diff = now - prev;
            if (Math.abs(diff) >= 2 || (prev > 0 && Math.abs(diff / prev) >= 0.2)) {
              newAlerts.push({ at: new Date().toISOString(), target: k, prev, now, delta: diff });
            }
          }
          const alerts = [...newAlerts, ...((w as any).alerts || [])].slice(0, 50);
          await withWorkspace(admin.from("competitor_watch").update({ baseline: fresh, last_run_at: new Date().toISOString(), alerts }).eq("id", id).eq("user_id", userId));

          // Insert per-alert notifications for the user
          if (newAlerts.length > 0) {
            const rows = newAlerts.map((a) => ({
              user_id: userId,
              workspace_id: workspaceId,
              watch_id: id,
              severity: Math.abs(a.delta) >= 5 ? "high" : "info",
              target: a.target,
              message: `تغيّر عدد نتائج البحث المرصودة لِـ${a.target}: ${a.prev} → ${a.now} (${a.delta > 0 ? "+" : ""}${a.delta})`,
              payload: a,
            }));
            await admin.from("competitor_alerts").insert(rows);
          }
          return Response.json({ alerts: newAlerts, baseline: fresh });
        }

        return Response.json({ error: "unknown_action" }, { status: 400 });
      },
    },
  },
});
