import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fcSearch } from "@/lib/firecrawl";
import { estimateSearchCredits, planSourceRoute } from "@/lib/maaroof/source-intelligence";
import { recordEvidence } from "@/lib/maaroof/evidence.server";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";
import { resolveToolModel } from "@/lib/ai-engines.server";

const COST = 1;
const PLATFORMS = [
  { key: "x", domain: "twitter.com OR x.com", label: "X / Twitter" },
  { key: "linkedin", domain: "linkedin.com", label: "LinkedIn" },
  { key: "reddit", domain: "reddit.com", label: "Reddit" },
  { key: "youtube", domain: "youtube.com", label: "YouTube" },
  { key: "facebook", domain: "facebook.com", label: "Facebook" },
  { key: "instagram", domain: "instagram.com", label: "Instagram" },
];

export const Route = createFileRoute("/api/social-analysis")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const lovableKey = process.env.LOVABLE_API_KEY;
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!lovableKey || !SUPABASE_URL || !SERVICE) return Response.json({ error: "internal_error" }, { status: 500 });
        const admin = createClient(SUPABASE_URL, SERVICE);

        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return Response.json({ error: "auth_required" }, { status: 401 });
        const { data: userData } = await admin.auth.getUser(auth.slice(7));
        const userId = userData?.user?.id;
        if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });
        const body = await request.json();
        const workspaceId = typeof body.workspace_id === "string" ? body.workspace_id.trim() : null;
        let workspace: any = null;
        if (workspaceId) {
          if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return Response.json({ error: "invalid_workspace" }, { status: 400 });
          const { data, error } = await admin.from("workspaces")
            .select("id,owner_id,name,brand_url,brand_summary,keywords,country,city,entity_truth_card,onboarding")
            .eq("id", workspaceId).eq("owner_id", userId).maybeSingle();
          if (error || !data) return Response.json({ error: "workspace_not_found" }, { status: 404 });
          workspace = data;
        }
        const card = workspace?.entity_truth_card && typeof workspace.entity_truth_card === "object" ? workspace.entity_truth_card : {};
        const askedBrand = String(body.brand || "").trim();
        const brand = askedBrand || String(workspace?.name || card.brand_name || card.name || "").trim();
        const keywords = String(body.keywords || workspace?.keywords || card.brand_keywords || card.keywords || workspace?.brand_summary || "").trim();
        const lang = body.lang === "en" || body.lang === "ku" ? body.lang : "ar";
        if (!brand) return Response.json({ error: "brand_required" }, { status: 400 });
        const workspaceLocation = [workspace?.city, workspace?.country].filter(Boolean).join(", ");
        const _runId = crypto.randomUUID();
          const _t0 = Date.now();
          // Governed model selection (Part 12 registry) with the legacy default as fallback.
          const _MODEL = await resolveToolModel("google/gemini-2.5-flash");
          const _chg = await chargeTokens({ userId, toolKey: "social_analysis", runId: _runId, meta: { provider: "lovable_ai", model: _MODEL, endpoint: "/api/social-analysis" } });
        if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });

        const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
        if (!prof) return Response.json({ error: "auth_required" }, { status: 401 });
        const overrideLimit = Number((prof as any)?.quota_overrides?.monthly_analyses || 0);
        const used = Number((prof as any).monthly_analyses_used || 0);
        const limit = (prof as any).is_subscribed ? Math.max(100, overrideLimit) : Math.max(5, overrideLimit);
        if (!(prof as any).is_subscribed && limit - used < COST) {
          /* balance-only: charge already succeeded */ void limit;
        }

        const sourceBudget = { maxRequests: 6, maxEstimatedCredits: 42, requests: 0, estimatedCredits: 0, limited: false };
        const platforms: any[] = [];
        for (const p of PLATFORMS) {
          const q = (`(${p.domain.split(" OR ").map((d) => `site:${d}`).join(" OR ")}) "${brand}" ${keywords} ${workspaceLocation}`).trim();
          const plan = planSourceRoute({
            goal: q, capability: "web_search", language: lang, market: workspaceLocation || null,
            requestedSources: ["web"], available: { webSearch: true, directRead: true, alexandria: false },
            budget: {
              maxRequests: sourceBudget.maxRequests,
              maxEstimatedCredits: sourceBudget.maxEstimatedCredits,
              usedRequests: sourceBudget.requests,
              usedEstimatedCredits: sourceBudget.estimatedCredits,
            },
          });
          const planned = estimateSearchCredits({ resultCount: 5, sources: ["web"], includePageContent: true });
          if (plan.primary === "none" || sourceBudget.requests + 1 > sourceBudget.maxRequests ||
              sourceBudget.estimatedCredits + planned.estimatedCredits > sourceBudget.maxEstimatedCredits) {
            sourceBudget.limited = true;
            platforms.push({ key: p.key, label: p.label, mentions: 0, top: [], status: "not_checked", error: false });
            continue;
          }
          sourceBudget.requests += 1;
          sourceBudget.estimatedCredits += planned.estimatedCredits;
          try {
            const sr: any = await fcSearch(q, { limit: 5, lang, sources: plan.searchSources }, { userId, toolKey: "social_analysis" });
            const raw = sr?.data ?? sr;
            const rows = Array.isArray(raw?.web) ? raw.web : Array.isArray(sr?.web) ? sr.web
              : Array.isArray(raw) ? raw : Array.isArray(sr?.results) ? sr.results : [];
            const list = rows.slice(0, 5).filter((row: any) => /^https?:\/\//i.test(String(row?.url || "")));
            const actual = estimateSearchCredits({ resultCount: list.length, sources: ["web"], includePageContent: true });
            sourceBudget.estimatedCredits = Math.max(0, sourceBudget.estimatedCredits - planned.estimatedCredits + actual.estimatedCredits);
            platforms.push({
              key: p.key,
              label: p.label,
              mentions: list.length,
              status: list.length ? "checked_with_results" : "checked_no_results",
              top: list.map((r: any) => ({
                title: String(r?.title || "").slice(0, 140),
                url: String(r?.url || ""),
                snippet: String(r?.description || r?.markdown || "").slice(0, 200),
              })),
            });
          } catch {
            platforms.push({ key: p.key, label: p.label, mentions: 0, top: [], status: "unavailable", error: true });
          }
        }
        const sourceEvidence = platforms.flatMap((platform) => platform.top.slice(0, 3).map((row: any) => ({
          platform: platform.key, title: row.title, url: row.url, snippet: row.snippet,
        })));
        await Promise.allSettled(sourceEvidence.map((source) => recordEvidence({
          userId,
          workspaceId,
          title: source.title || source.url,
          claim: `A public search result was observed for the ${source.platform} social-platform query.`,
          sourceKind: "external",
          sourceRef: source.url,
          evidenceType: "external",
          category: "behavioral",
          collectionMethod: "social_analysis_source_router",
          provider: "public_web",
          capability: "social_analysis",
          retrievedAt: new Date().toISOString(),
          locale: lang,
          market: workspaceLocation || null,
          measurementUnit: "search_result",
          sampleSize: 1,
          realityKind: "observation",
          status: "success",
          limitation: "Search results are index-dependent proxies. They do not establish all platform posts or true social share of voice.",
          sourceReliability: 55,
          relevanceScore: 65,
          businessImportance: 55,
          language: lang,
        })));

        const totalMentions = platforms.reduce((a, b) => a + b.mentions, 0);
        const evidence = platforms.flatMap((p) => p.top.slice(0, 2).map((t: any) => `[${p.label}] ${t.title} — ${t.url}`)).join("\n");

        const langName = lang === "ar" ? "Arabic" : lang === "ku" ? "Kurdish Sorani" : "English";
        const sys = `${FACTUAL_SAFETY_PROMPT}\nYou are a social-media visibility analyst. Reply in ${langName}.
Given evidence of brand mentions across social platforms, return ONLY valid JSON:
{
  "sentiment": "positive|neutral|negative",
  "share_of_voice": <0-100>,
  "best_platforms": ["platform names"],
  "content_gaps": ["gap1","gap2"],
  "post_ideas": [{"platform":"...","title":"...","hook":"..."}],
  "best_posting_times": ["e.g. weekday evenings"],
  "hashtags": ["#tag1"],
  "summary": "1-2 sentences"
}`;
        const user = `Brand: ${brand}\nKeywords: ${keywords || "-"}\nTotal mentions found: ${totalMentions}\nEvidence:\n${evidence || "(none)"}`;

        let parsed: any = {};
        try {
          const r = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: lovableAiHeaders(lovableKey),
            body: JSON.stringify({ model: _MODEL, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
          });
          if (r.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
          if (r.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
          const j: any = await r.json();
          try {
            const _u: any = (j as any)?.usage || {};
            const { enrichLedger: _el } = await import("@/lib/spend.server");
            await _el({ runId: _runId, provider: "lovable_ai", model: _MODEL, endpoint: "/api/social-analysis", inputTokens: Number(_u.prompt_tokens)||0, outputTokens: Number(_u.completion_tokens)||0, latencyMs: Date.now() - _t0 });
          } catch {}
          parsed = extractJsonObject(String(j?.choices?.[0]?.message?.content || "{}")) || {};
        } catch {}

        await admin.from("profiles").update({ monthly_analyses_used: used + COST }).eq("id", userId);
        await admin.from("activity_log").insert({ user_id: userId, action: "social_analysis", metadata: { brand, cost: COST } });

        return Response.json({
          brand, platforms, total_mentions: totalMentions, ...parsed,
          source_plan: {
            method_version: "social-public-search-proxy-v1",
            request_count: sourceBudget.requests,
            request_cap: sourceBudget.maxRequests,
            estimated_credits: sourceBudget.estimatedCredits,
            estimated_credit_cap: sourceBudget.maxEstimatedCredits,
            budget_limited: sourceBudget.limited,
            sample_size: sourceEvidence.length,
            retrieved_at: new Date().toISOString(),
            reality_kind: "external_observation",
            limitations: [
              "Social result counts are estimates from public search indexes, not a full count of all platform posts.",
              "An unavailable platform query is not treated as evidence that the brand has no presence.",
              ...(sourceBudget.limited ? ["Some platform checks were skipped due to the request or credit budget."] : []),
            ],
          },
        });
      },
    },
  },
});
