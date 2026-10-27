import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fcSearch } from "@/lib/firecrawl";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";
import { resolveToolModel } from "@/lib/ai-engines.server";
import { asText } from "@/lib/input-coerce";

const AXES = ["SEO", "GEO", "AEO", "SGE", "GSEO", "SGEO"] as const;
function text(v: unknown, max = 4000): string {
  return asText(v, max).trim();
}
function list(v: unknown, max = 12): string[] {
  if (Array.isArray(v)) return v.map((x) => text(x, 250)).filter(Boolean).slice(0, max);
  return text(v, 3000).split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean).slice(0, max);
}
function normalizeScore(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}
function nullableScore(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
}
function normalizeRows(v: unknown, limit = 100): any[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, limit).map((x: any) => ({
    keyword: text(x?.keyword, 250),
    type: text(x?.type, 80),
    market: text(x?.market, 100),
    language: text(x?.language, 80),
    intent: text(x?.intent, 100),
    source: text(x?.source, 500),
    rationale: text(x?.rationale, 500),
    old_match: text(x?.old_match, 250),
    similarity: normalizeScore(x?.similarity),
    share_of_voice: nullableScore(x?.share_of_voice),
    density: nullableScore(x?.density),
    authority: normalizeScore(x?.authority),
    negative: Boolean(x?.negative),
    priority: ["high", "medium", "low"].includes(String(x?.priority)) ? String(x.priority) : "medium",
  })).filter((x) => x.keyword);
}

export const Route = createFileRoute("/api/keyword-intelligence")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!apiKey || !supabaseUrl || !serviceKey) return Response.json({ error: "server_not_configured" }, { status: 500 });
        const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        const auth = request.headers.get("authorization") || "";
        if (!auth.startsWith("Bearer ")) return Response.json({ error: "auth_required" }, { status: 401 });
        const { data: userData } = await admin.auth.getUser(auth.slice(7));
        const userId = userData.user?.id;
        if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });

        const body = await request.json().catch(() => ({} as any));
        const brand = text(body.brand || body.brand_name, 200);
        const website = text(body.website || body.source_url, 500);
        const market = text(body.market || body.country, 120);
        const language = text(body.language || body.lang || "ar", 30);
        const oldKeywords = list(body.old_keywords || body.existing_keywords, 200);
        const competitors = list(body.competitors, 10);
        const socialKeywords = list(body.social_keywords, 80);
        const productContext = text(body.product_context || body.description, 1500);
        if (!brand) return Response.json({ error: "brand_required" }, { status: 400 });

        const runId = crypto.randomUUID();
        const started = Date.now();
        const model = await resolveToolModel("google/gemini-2.5-pro");
        const charged = await chargeTokens({ userId, toolKey: "keyword_intelligence", runId, meta: { provider: "lovable_ai", model, endpoint: "/api/keyword-intelligence" } });
        if (!charged.ok) return Response.json(chargeFailureBody(charged.reason as any, charged.left), { status: 402 });

        // Gather a small, bounded set of public evidence. Failed searches remain visible as gaps.
        const queries = [
          { key: "brand", q: `"${brand}" ${market}` },
          ...competitors.slice(0, 4).map((c: string, i: number) => ({ key: `competitor_${i + 1}`, q: `"${c}" ${market}` })),
          { key: "keyword_opportunities", q: `(${brand}) products categories styles alternatives ${market}` },
        ];
        const evidence: any[] = [];
        for (const item of queries) {
          try {
            const result: any = await fcSearch(item.q, { limit: 5, lang: language });
            const raw = result?.data?.web || result?.web || result?.data || [];
            evidence.push({
              query_type: item.key,
              query: item.q,
              results: (Array.isArray(raw) ? raw : []).slice(0, 5).map((r: any) => ({
                title: text(r?.title, 180),
                url: text(r?.url, 500),
                snippet: text(r?.description || r?.snippet, 350),
              })),
              status: "searched",
            });
          } catch {
            evidence.push({ query_type: item.key, query: item.q, results: [], status: "unavailable" });
          }
        }

        const system = `${FACTUAL_SAFETY_PROMPT}
You are MAAROOF Ai's Keyword Intelligence specialist. Reply in language ${language}.
Produce a simple, decision-ready keyword report as strict JSON. Do not use jargon in user-facing explanations.
Compare old keywords with newly proposed keywords, competitor terms, and social-platform terms.
Never claim a search volume, actual page density, domain authority, or share of voice was measured unless the supplied evidence contains data that directly supports it. For absent metrics, use null and explain in a short Arabic-friendly note; for proposed strategic scores, label them as estimates.
Score the six dimensions SEO, GEO, AEO, SGE, GSEO, SGEO individually from 0-100 as "readiness/opportunity scores", not actual Google rankings. Provide a clear recommended action for each.
For share_of_voice, calculate only when comparative mention/impression counts exist; otherwise null. For density, use the measured keyword occurrence ratio only when page text exists; otherwise null. For authority, use a 0-100 "topical authority opportunity" estimate, not third-party domain authority.
Estimate time-to-impact as a range in weeks with assumptions and confidence; never promise ranking dates.
Return exactly these keys:
{
 "summary": string,
 "old_new_comparison": [{"keyword":string,"type":"old|new","old_match":string,"similarity":0-100,"market":string,"language":string,"intent":string,"share_of_voice":number|null,"density":number|null,"authority":0-100,"priority":"high|medium|low","rationale":string,"source":string}],
 "competitor_keywords": same array shape,
 "social_keywords": same array shape,
 "brand_vs_competitors": [{"competitor":string,"overlap":string[],"strengths":string[],"weaknesses":string[],"gaps":string[],"source":string}],
 "axis_scores": [{"axis":"SEO|GEO|AEO|SGE|GSEO|SGEO","score":0-100,"basis":string,"actions":string[]}],
 "time_to_impact": [{"phase":string,"weeks_min":number,"weeks_max":number,"work":string,"confidence":"low|medium|high"}],
 "negative_keywords": [{"keyword":string,"applies_to":"brand|competitor|social","reason":string}],
 "sources": [{"title":string,"url":string,"used_for":string}],
 "notes": string[]
}
New keyword suggestions must not be copied only from old keywords; include relevant long-tail and natural-language query variants. Avoid unsupported factual claims.`;
        const user = `Brand: ${brand}
Website: ${website || "(not provided)"}
Market: ${market || "not specified"}
Language: ${language}
Product context: ${productContext || "(not provided)"}
Old keywords (baseline): ${JSON.stringify(oldKeywords)}
Competitors: ${JSON.stringify(competitors)}
User-supplied social keywords: ${JSON.stringify(socialKeywords)}
Public search evidence: ${JSON.stringify(evidence)}
Build a useful first report. Use sources only from the evidence above. Include proposed new keywords and compare each to the old list.`;

        let parsed: any = {};
        try {
          const response = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: lovableAiHeaders(apiKey),
            body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
          });
          if (response.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
          if (response.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
          if (!response.ok) return Response.json({ error: "ai_error" }, { status: 502 });
          const payload: any = await response.json();
          const usage: any = payload?.usage || {};
          try {
            const { enrichLedger } = await import("@/lib/spend.server");
            await enrichLedger({ runId, provider: "lovable_ai", model, endpoint: "/api/keyword-intelligence", inputTokens: Number(usage.prompt_tokens) || 0, outputTokens: Number(usage.completion_tokens) || 0, latencyMs: Date.now() - started });
          } catch {}
          parsed = extractJsonObject(String(payload?.choices?.[0]?.message?.content || "{}")) || {};
        } catch {
          return Response.json({ error: "ai_request_failed" }, { status: 502 });
        }

        const axes = AXES.map((axis) => {
          const found = Array.isArray(parsed.axis_scores) ? parsed.axis_scores.find((x: any) => String(x.axis).toUpperCase() === axis) : null;
          return { axis, score: normalizeScore(found?.score), basis: text(found?.basis, 500), actions: Array.isArray(found?.actions) ? found.actions.map((x: any) => text(x, 300)).slice(0, 8) : [] };
        });
        const result = {
          title: `MAAROOF Ai — Keyword Intelligence — ${brand}`,
          brand,
          market,
          language,
          summary: text(parsed.summary, 2000),
          old_new_comparison: normalizeRows(parsed.old_new_comparison, 200),
          competitor_keywords: normalizeRows(parsed.competitor_keywords, 200),
          social_keywords: normalizeRows(parsed.social_keywords, 200),
          brand_vs_competitors: Array.isArray(parsed.brand_vs_competitors) ? parsed.brand_vs_competitors.slice(0, 20) : [],
          axis_scores: axes,
          time_to_impact: Array.isArray(parsed.time_to_impact) ? parsed.time_to_impact.slice(0, 12) : [],
          negative_keywords: Array.isArray(parsed.negative_keywords) ? parsed.negative_keywords.slice(0, 100) : [],
          sources: Array.isArray(parsed.sources) ? parsed.sources.slice(0, 50) : [],
          evidence,
          notes: Array.isArray(parsed.notes) ? parsed.notes.map((x: any) => text(x, 400)).slice(0, 20) : [],
          report_version: "keyword-intelligence-v1",
          generated_at: new Date().toISOString(),
        };
        await admin.from("activity_log").insert({ user_id: userId, action: "keyword_intelligence", metadata: { brand, market, source_count: evidence.length, axis_count: axes.length } }).catch(() => {});
        return Response.json(result);
      },
    },
  },
});
