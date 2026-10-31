import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fcSearch } from "@/lib/firecrawl";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";
import { resolveToolModel } from "@/lib/ai-engines.server";
import { describeMarket, type GeoScope } from "@/lib/geo-scope.server";
import { calculateSocialVisibilityMetrics } from "@/lib/maaroof/social-visibility-metrics";
import { normalizeOfficialWebsite } from "@/lib/maaroof/official-website";
import { settleTokenRefund } from "@/lib/maaroof/token-refund";

const COST = 1;
const PLATFORMS = [
  { key: "x", domain: "twitter.com OR x.com", label: "X / Twitter" },
  { key: "linkedin", domain: "linkedin.com", label: "LinkedIn" },
  { key: "reddit", domain: "reddit.com", label: "Reddit" },
  { key: "youtube", domain: "youtube.com", label: "YouTube" },
  { key: "facebook", domain: "facebook.com", label: "Facebook" },
  { key: "instagram", domain: "instagram.com", label: "Instagram" },
] as const;

function safeText(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

export const Route = createFileRoute("/api/social-analysis")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = Date.now();
        const lovableKey = process.env.LOVABLE_API_KEY;
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!lovableKey || !SUPABASE_URL || !SERVICE) {
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
        const admin = createClient(SUPABASE_URL, SERVICE);
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return Response.json({ error: "auth_required" }, { status: 401 });
        const { data: userData } = await admin.auth.getUser(auth.slice(7));
        const userId = userData?.user?.id;
        if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });

        const body = await request.json().catch(() => null) as any;
        if (!body || typeof body !== "object") return Response.json({ error: "invalid_json" }, { status: 400 });
        const brand = safeText(body.brand, 200);
        const keywords = safeText(body.keywords, 400);
        const lang = body.lang === "ar" || body.lang === "ku" || body.lang === "en" ? body.lang : "ar";
        if (brand.length < 2) return Response.json({ error: "brand_required" }, { status: 400 });
        if (body.lang != null && !["ar", "en", "ku"].includes(body.lang)) {
          return Response.json({ error: "unsupported_audience_language" }, { status: 400 });
        }

        const { workspaceGuard } = await import("@/lib/workspace-guard.server");
        const denied = await workspaceGuard(admin, userId, body);
        if (denied) return denied;
        const workspaceId = typeof body.workspace_id === "string" && body.workspace_id.trim() ? body.workspace_id.trim() : null;
        let workspace: any = null;
        if (workspaceId) {
          const { data, error } = await admin.from("workspaces")
            .select("id, owner_id, brand_url, entity_truth_card")
            .eq("id", workspaceId).eq("owner_id", userId).maybeSingle();
          if (error || !data) return Response.json({ error: "workspace_not_found" }, { status: 404 });
          workspace = data;
        }
        const rawWebsite = safeText(body.official_website || workspace?.brand_url, 500);
        const officialWebsite = normalizeOfficialWebsite(rawWebsite);
        if (!officialWebsite) {
          return Response.json({ error: rawWebsite ? "invalid_official_website" : "official_website_required" }, { status: 400 });
        }

        const scope = (body.scope || { scope: "world" }) as GeoScope;
        const market = describeMarket(scope);
        const officialHost = new URL(officialWebsite).hostname.toLowerCase().replace(/^www[.]/, "");
        const runId = crypto.randomUUID();
        const model = await resolveToolModel("google/gemini-2.5-flash");
        const charge = await chargeTokens({
          userId, toolKey: "social_analysis", runId,
          meta: { provider: "lovable_ai", model, endpoint: "/api/social-analysis", workspace_id: workspaceId },
        });
        if (!charge.ok) return Response.json(chargeFailureBody(charge.reason as any, charge.left), { status: 402 });

        const platforms: any[] = [];
        for (const platform of PLATFORMS) {
          const domains = platform.domain.split(" OR ").map((domain) => `site:${domain}`).join(" OR ");
          const marketTerm = market.region === "Global" ? "" : market.region;
          const query = `(${domains}) "${brand.replace(/"/g, "")}" ${keywords} ${marketTerm}`.trim();
          try {
            const search: any = await fcSearch(query, { limit: 5, lang }, { userId, toolKey: "social_analysis" });
            const items = search?.data?.web || search?.web || search?.data || [];
            const list = (Array.isArray(items) ? items : []).slice(0, 5);
            const results = list.map((item: any) => ({
              title: safeText(item?.title || item?.metadata?.title, 140),
              url: safeText(item?.url, 1000),
              snippet: safeText(item?.description || item?.markdown, 280),
            })).filter((item: any) => item.url.toLowerCase().startsWith("https://") || item.url.toLowerCase().startsWith("http://"));
            platforms.push({
              key: platform.key, label: platform.label, status: "measured",
              results_returned: results.length, result_limit: 5,
              retrieval_source: safeText(search?.fetch_source || "unknown", 40),
              results,
            });
          } catch {
            platforms.push({
              key: platform.key, label: platform.label, status: "error",
              results_returned: null, result_limit: 5, retrieval_source: "unavailable",
              results: [], error_code: "search_failed",
            });
          }
        }

        const socialMetrics = calculateSocialVisibilityMetrics(platforms);
        const completedPlatforms = socialMetrics.completed_queries;
        const failedPlatforms = socialMetrics.failed_queries;
        // Refund the tool charge only when every platform query failed. Successful
        // empty queries are still completed work; Firecrawl provider credits are
        // recorded separately by the existing adapter.
        const billingSettlement = await settleTokenRefund(
          Number(charge.tokens) || 0,
          completedPlatforms === 0 ? Number(charge.tokens) || 0 : 0,
          async (refundTokens) => admin.rpc("charge_tokens", {
            _user_id: userId,
            _tool_key: "social_analysis",
            _tokens: -refundTokens,
            _usd: 0,
            _run_id: runId,
            _meta: { refund: true, reason: "all_platform_searches_failed", endpoint: "/api/social-analysis" },
          }),
        );
        const allResults = platforms.flatMap((item) => item.results);
        const uniqueUrls = [...new Set(allResults.map((item: any) => item.url).filter(Boolean))];
        const totalResultsReturned = socialMetrics.total_results_returned;
        const evidence = platforms.flatMap((platform) =>
          platform.results.slice(0, 3).map((item: any) => `[${platform.label}] ${item.title} — ${item.snippet} — ${item.url}`)
        ).join("\n");

        const langName = lang === "ar" ? "Arabic" : lang === "ku" ? "Kurdish Sorani" : "English";
        let parsed: any = {};
        let analysisStatus: "completed" | "failed" | "not_run" = "not_run";
        let analysisError: string | null = null;
        let analysisModel: string | null = null;
        const analysisProvider = "lovable_ai";
        if (completedPlatforms > 0 && allResults.length > 0) {
          const system = `${FACTUAL_SAFETY_PROMPT}
You are a social visibility evidence analyst. Reply in ${langName}.
Use only the supplied search-result titles, snippets and URLs as evidence. Search results are not complete platform-wide mention counts. Do not infer audience reach, engagement, impressions, or market share. Distinguish missing evidence from zero results and say when the sample is limited.
Return ONLY valid JSON:
{
  "sentiment": "positive|neutral|negative|not_assessed",
  "best_platforms": ["platform names, only when supported by retrieved results"],
  "content_gaps": ["evidence-based content gap"],
  "post_ideas": [{"platform":"...","title":"...","hook":"..."}],
  "best_posting_times": [],
  "hashtags": [],
  "summary": "state what was searched, the sample limits, and what can/cannot be concluded"
}`;
          const user = `Brand: ${brand}
Official website: ${officialWebsite}
Official host: ${officialHost}
Market: ${market.region}
Audience language: ${lang}
Keywords: ${keywords || "-"}
Completed platform searches: ${completedPlatforms}/${platforms.length}
Returned search-result records: ${totalResultsReturned}
Evidence:
${evidence}`;
          try {
            const response = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
              method: "POST",
              headers: lovableAiHeaders(lovableKey),
              body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
            });
            if (!response.ok) {
              analysisError = response.status === 429 ? "rate_limited" : response.status === 402 ? "credits_exhausted" : "analysis_failed";
              analysisStatus = "failed";
            } else {
              const json: any = await response.json();
              analysisModel = String(json?.model || model);
              const usage = json?.usage || {};
              try {
                const { enrichLedger } = await import("@/lib/spend.server");
                await enrichLedger({
                  runId, provider: "lovable_ai", model,
                  endpoint: "/api/social-analysis",
                  inputTokens: Number(usage.prompt_tokens) || 0,
                  outputTokens: Number(usage.completion_tokens) || 0,
                  latencyMs: Date.now() - startedAt,
                });
              } catch {}
              parsed = extractJsonObject(String(json?.choices?.[0]?.message?.content || "{}")) || {};
              analysisStatus = "completed";
            }
          } catch {
            analysisError = "analysis_failed";
            analysisStatus = "failed";
          }
        }

        const sentiment = ["positive", "neutral", "negative"].includes(parsed?.sentiment)
          ? parsed.sentiment : "not_assessed";
        const result = {
          operation_id: runId,
          brand, official_website: officialWebsite,
          market: market.region, audience_language: lang,
          platforms, queries_planned: platforms.length,
          queries_completed: completedPlatforms, queries_failed: failedPlatforms,
          query_coverage: socialMetrics.query_coverage,
          total_results_returned: totalResultsReturned,
          unique_result_urls: socialMetrics.unique_result_urls,
          sentiment,
          sentiment_basis: analysisStatus === "completed" ? "AI analysis of returned snippets; not consumer sentiment telemetry" : "not_assessed",
          share_of_voice: socialMetrics.share_of_voice,
          share_of_voice_basis: socialMetrics.share_of_voice_basis,
          billing_settlement: billingSettlement,
          analysis_status: analysisStatus,
          analysis_provider: analysisStatus === "completed" ? analysisProvider : null,
          analysis_model: analysisStatus === "completed" ? analysisModel : null,
          ...(analysisError ? { analysis_error: analysisError } : {}),
          best_platforms: Array.isArray(parsed?.best_platforms) ? parsed.best_platforms.slice(0, 6) : [],
          content_gaps: Array.isArray(parsed?.content_gaps) ? parsed.content_gaps.slice(0, 8) : [],
          post_ideas: Array.isArray(parsed?.post_ideas) ? parsed.post_ideas.slice(0, 8) : [],
          best_posting_times: Array.isArray(parsed?.best_posting_times) ? parsed.best_posting_times.slice(0, 6) : [],
          hashtags: Array.isArray(parsed?.hashtags) ? parsed.hashtags.slice(0, 12) : [],
          summary: safeText(parsed?.summary, 1200),
        };

        if (workspaceId && workspace) {
          const card = workspace.entity_truth_card && typeof workspace.entity_truth_card === "object" ? workspace.entity_truth_card : {};
          const nextCard = {
            ...card,
            entity_name: card.entity_name || brand,
            last_social_analysis: {
              operation_id: runId, measured_at: new Date().toISOString(),
              market: market.region, audience_language: lang,
              queries_completed: completedPlatforms, queries_failed: failedPlatforms,
              total_results_returned: totalResultsReturned, analysis_status: analysisStatus,
            },
          };
          const { error } = await admin.from("workspaces").update({
            brand_url: officialWebsite, entity_truth_card: nextCard,
          }).eq("id", workspaceId).eq("owner_id", userId);
          if (error) console.warn("[social-analysis] workspace update failed", error.message);
        }

        const { data: usageProfile } = await admin.from("profiles").select("monthly_analyses_used").eq("id", userId).maybeSingle();
        // Failed-all searches are refunded and must not consume a monthly analysis.
        if (usageProfile && completedPlatforms > 0) {
          await admin.from("profiles").update({
            monthly_analyses_used: (Number((usageProfile as any).monthly_analyses_used) || 0) + COST,
          }).eq("id", userId);
        }

        const { recordBrandOperation } = await import("@/lib/brand-operations.server");
        await recordBrandOperation(admin, {
          id: runId, userId, workspaceId,
          operationType: "social_analysis",
          brandName: brand,
          status: completedPlatforms === 0 ? "failed" : completedPlatforms === platforms.length && analysisStatus === "completed" ? "completed" : "partial",
          durationMs: Date.now() - startedAt,
          chargedUnits: billingSettlement.charged_tokens,
          requestMeta: { official_website: officialWebsite, market: market.region, audience_language: lang, keywords, platforms: PLATFORMS.map((item) => item.key) },
          resultMeta: {
            billing_settlement: billingSettlement,
            query_coverage: result.query_coverage,
            total_results_returned: totalResultsReturned,
            unique_result_urls: uniqueUrls.length,
            share_of_voice: socialMetrics.share_of_voice,
            share_of_voice_basis: socialMetrics.share_of_voice_basis,
            analysis_status: analysisStatus,
            analysis_provider: analysisStatus === "completed" ? analysisProvider : null,
            analysis_model: analysisStatus === "completed" ? analysisModel : null,
            platform_results: platforms.map((item) => ({ key: item.key, status: item.status, results_returned: item.results_returned, retrieval_source: item.retrieval_source })),
            evidence_urls: uniqueUrls.slice(0, 30),
            platform_evidence: platforms.map((item) => ({ key: item.key, status: item.status, results: item.results.slice(0, 3) })),
          },
          errorMessage: completedPlatforms === 0 ? "all_platform_searches_failed" : analysisError,
        });

        try {
          await admin.from("activity_log").insert({
            user_id: userId, action: "social_analysis",
            metadata: { brand, operation_id: runId, workspace_id: workspaceId, total_results_returned: totalResultsReturned, queries_completed: completedPlatforms, queries_failed: failedPlatforms },
          });
        } catch {}

        return Response.json(result, { status: completedPlatforms === 0 ? 502 : 200 });
      },
    },
  },
});
