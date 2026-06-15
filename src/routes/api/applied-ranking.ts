import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { describeMarket, type GeoScope } from "@/lib/geo-scope.server";
import { fcScrape, fcSearch } from "@/lib/firecrawl";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";

type Body = {
  brand_name: string;
  brand_keywords?: string;
  website?: string;
  app_url?: string;
  app_name?: string;
  sector?: string;
  notes?: string;
  lang?: "en" | "ar" | "ku";
  scope?: GeoScope;
};

const PLATFORMS = ["ChatGPT", "Gemini", "Claude", "Perplexity", "Copilot", "Grok", "Mistral", "DeepSeek", "Kimi"];

const LANG_INSTR: Record<string, string> = {
  ar: "اكتب جميع القيم النصية داخل JSON باللغة العربية الفصحى.",
  en: "Write all string values inside the JSON in clear English.",
  ku: "هەموو بەهای دەقی ناو JSON ـەکە بە کوردی سۆرانی بنووسە.",
};

const buildSystem = (m: ReturnType<typeof describeMarket>) => `${FACTUAL_SAFETY_PROMPT}

You are a STRICT, evidence-based "Applied Ranking" analyst for ${m.market}.
Your job: rate a brand's REAL-WORLD applied presence across THREE pillars and explain how each of the 9 AI engines (ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek, Kimi) sees it for ${m.audience}.

LOCALIZATION CONTEXT: ${m.contextHint}

THREE PILLARS (score each 0-100, conservative):
1. WEBSITE — domain authority, technical SEO, schema.org, OpenGraph, content depth, freshness, multilingual coverage, https, mobile responsiveness, reviews/ratings markup, indexability for AI crawlers.
2. MOBILE APP — store presence (Google Play / App Store), icon & screenshots quality, description/keywords, ratings count & average, last update recency, install base signals, deep links / web manifest, store listing localization for ${m.region}.
3. BRAND — name recognition, social handles consistency, Wikipedia/Wikidata, news mentions, founder visibility, partner ecosystem, GMB/local listings, reviews tone, owned vs earned media balance, X/LinkedIn/Instagram footprint.

OVERALL = round(website*0.4 + app*0.3 + brand*0.3).

For EACH AI engine, give a score 0-100 reflecting how likely THAT engine is to surface/cite this brand when answering applied queries from ${m.audience}, and the SINGLE most impactful action.

Use ONLY: (a) facts the user provided, (b) snippets in supplied SOURCES, (c) website scrape excerpt. If a pillar has no evidence, score it low and write "no public signals detected" — DO NOT invent stats, awards, partners, dates, prices, or contacts.

Return ONLY valid JSON:
{
  "overall": <0-100>,
  "confidence": "high" | "medium" | "low",
  "pillars": {
    "website":  { "score": <0-100>, "summary": "1-2 sentences", "strengths": ["..."], "gaps": ["..."], "actions": ["concrete next step", "..."] },
    "mobile_app": { "score": <0-100>, "summary": "1-2 sentences", "strengths": ["..."], "gaps": ["..."], "actions": ["..."] },
    "brand":    { "score": <0-100>, "summary": "1-2 sentences", "strengths": ["..."], "gaps": ["..."], "actions": ["..."] }
  },
  "platforms": [
    { "name": "ChatGPT", "score": <0-100>, "verdict": "high"|"medium"|"low", "why": "1-2 sentences referencing the pillars", "next_step": "single most impactful action for THIS engine" },
    ... 9 entries total in the order: ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek, Kimi
  ],
  "priority_actions": ["top 3-6 cross-engine actions sorted by impact"],
  "evidence_used": ["short bullet referring to which source/snippet supported each pillar; if none, say 'no evidence'"]
}
All text fields MUST be in REPORT language.`;

function clamp(n: unknown) {
  const v = Number.parseInt(String(n ?? 0), 10);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function arr(v: unknown, max = 8) {
  if (!Array.isArray(v)) return [] as string[];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, max).map((x) => x.slice(0, 240));
}

function normalizePillar(p: any) {
  return {
    score: clamp(p?.score),
    summary: String(p?.summary || "").trim().slice(0, 400),
    strengths: arr(p?.strengths, 6),
    gaps: arr(p?.gaps, 6),
    actions: arr(p?.actions, 6),
  };
}

function normalizePlatforms(value: unknown) {
  const arrIn = Array.isArray(value) ? value : [];
  const byName = new Map<string, any>();
  for (const it of arrIn) {
    if (it && typeof it === "object") {
      const n = String((it as any).name || "").trim();
      if (n) byName.set(n, it);
    }
  }
  return PLATFORMS.map((name) => {
    const p: any = byName.get(name) || {};
    const verdict = ["high", "medium", "low"].includes(p?.verdict) ? p.verdict : "low";
    return {
      name,
      score: clamp(p?.score),
      verdict,
      why: String(p?.why || "").trim().slice(0, 360),
      next_step: String(p?.next_step || "").trim().slice(0, 240),
    };
  });
}

export const Route = createFileRoute("/api/applied-ranking")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const brand = (body.brand_name || "").trim();
          if (brand.length < 2) return Response.json({ error: "brand_required" }, { status: 400 });

          const lang = body.lang === "ar" || body.lang === "ku" ? body.lang : "en";
          const apiKey = process.env.LOVABLE_API_KEY;
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!apiKey || !SUPABASE_URL || !SERVICE) {
            return Response.json({ error: "server_not_configured" }, { status: 500 });
          }

          const admin = createClient(SUPABASE_URL, SERVICE);
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) return Response.json({ error: "auth_required" }, { status: 401 });
          const { data: authData } = await admin.auth.getUser(auth.slice(7));
          const userId = authData.user?.id;
          if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });
          const _runId = crypto.randomUUID();
          const _t0 = Date.now();
          const _chg = await chargeTokens({ userId, toolKey: "applied_ranking", runId: _runId, meta: { provider: "lovable_ai", model: "google/gemini-2.5-flash", endpoint: "/api/applied-ranking" } });
          if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });

          // Quota: counts against monthly_analyses (premium tool, costs 2 by default but 1 per call here)
          const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
          if (!prof) return Response.json({ error: "auth_required" }, { status: 401 });
          let allowed = false;
          let limit = 0;
          if ((prof as any).is_subscribed) {
            if ((prof as any).subscription_expires_at && new Date((prof as any).subscription_expires_at) < new Date()) {
              await admin.from("profiles").update({ is_subscribed: false }).eq("id", userId);
            } else {
              const { data: plan } = await admin.from("subscription_plans")
                .select("monthly_analyses").eq("name", (prof as any).subscription_tier).maybeSingle();
              limit = Math.max(plan?.monthly_analyses || 200, Number((prof as any)?.quota_overrides?.monthly_analyses || 0));
              allowed = ((prof as any).monthly_analyses_used || 0) < limit;
            }
          } else {
            const override = Number((prof as any)?.quota_overrides?.monthly_analyses || 0);
            if (override > ((prof as any).monthly_analyses_used || 0)) {
              limit = override;
              allowed = true;
            }
          }
          if (!allowed) return Response.json({ error: "limit", limit }, { status: 402 });

          const market = describeMarket(body.scope);

          // Live evidence gathering — geographic-scope aware
          let websiteScrape = "";
          let websiteMeta: any = null;
          if (body.website && /^https?:\/\//i.test(body.website)) {
            try {
              const sc: any = await fcScrape(body.website);
              const md = sc?.data?.markdown || sc?.markdown || "";
              websiteScrape = String(md).slice(0, 4000);
              websiteMeta = sc?.data?.metadata || sc?.metadata || null;
            } catch (e) { console.warn("[applied-ranking] scrape failed", (e as Error).message); }
          }

          let sources: any[] = [];
          try {
            const q = `${brand} ${body.brand_keywords || ""} ${body.sector || ""} ${market.region}`.trim().slice(0, 240);
            const sr: any = await fcSearch(q, { limit: 6, lang });
            sources = (sr?.data || sr?.web || []).slice(0, 6).map((r: any) => ({
              title: r.title, url: r.url,
              snippet: String(r.markdown || r.description || "").slice(0, 500),
            }));
          } catch (e) { console.warn("[applied-ranking] search failed", (e as Error).message); }

          let appSearch: any[] = [];
          if (body.app_url || body.app_name) {
            try {
              const aq = `${body.app_name || brand} mobile app ${body.app_url || ""} reviews ratings`.trim().slice(0, 240);
              const sr: any = await fcSearch(aq, { limit: 4, lang });
              appSearch = (sr?.data || sr?.web || []).slice(0, 4).map((r: any) => ({
                title: r.title, url: r.url,
                snippet: String(r.markdown || r.description || "").slice(0, 400),
              }));
            } catch (e) { console.warn("[applied-ranking] app search failed", (e as Error).message); }
          }

          const ctx = [
            websiteScrape ? `WEBSITE_SCRAPE (${body.website}):\nTitle: ${websiteMeta?.title || ""}\nDesc: ${websiteMeta?.description || ""}\n---\n${websiteScrape}` : "WEBSITE_SCRAPE: (none provided or scrape failed)",
            sources.length ? `BRAND_WEB_SOURCES:\n${sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url})\n${s.snippet}`).join("\n\n")}` : "BRAND_WEB_SOURCES: (no public signals detected)",
            appSearch.length ? `APP_WEB_SOURCES:\n${appSearch.map((s, i) => `[A${i + 1}] ${s.title} (${s.url})\n${s.snippet}`).join("\n\n")}` : "APP_WEB_SOURCES: (none)",
          ].join("\n\n");

          const SYSTEM = buildSystem(market);
          const userMsg = `REPORT_LANGUAGE: ${lang}
Brand: ${brand}
Keywords: ${body.brand_keywords || "-"}
Sector: ${body.sector || "-"}
Website: ${body.website || "-"}
Mobile App: ${body.app_name || "-"}  ${body.app_url || ""}
Target market / scope: ${market.region}
User notes: ${body.notes || "-"}

EVIDENCE:
${ctx}

Return the JSON now. All text fields MUST be in language code "${lang}".`;

          const resp = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: lovableAiHeaders(apiKey),
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: `${SYSTEM}\n\n${LANG_INSTR[lang]}` },
                { role: "user", content: userMsg },
              ],
            }),
          });

          if (resp.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
          if (resp.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
          if (!resp.ok) {
            console.error("[applied-ranking] gateway", resp.status, await resp.text().catch(() => ""));
            return Response.json({ error: "ai_error" }, { status: 500 });
          }

          const j: any = await resp.json();
          const content = String(j?.choices?.[0]?.message?.content || "{}");
          const parsed: any = extractJsonObject(content) || {};

          const pillars = {
            website: normalizePillar(parsed?.pillars?.website),
            mobile_app: normalizePillar(parsed?.pillars?.mobile_app),
            brand: normalizePillar(parsed?.pillars?.brand),
          };
          const platforms = normalizePlatforms(parsed?.platforms);
          const overall = clamp(parsed?.overall) ||
            Math.round(pillars.website.score * 0.4 + pillars.mobile_app.score * 0.3 + pillars.brand.score * 0.3);
          const confidence = ["high", "medium", "low"].includes(parsed?.confidence) ? parsed.confidence : "medium";

          const result = {
            overall,
            confidence,
            pillars,
            platforms,
            priority_actions: arr(parsed?.priority_actions, 6),
            evidence_used: arr(parsed?.evidence_used, 8),
            sources,
            app_sources: appSearch,
            scope: market.region,
          };

          // Charge usage
          await admin.from("profiles").update({
            monthly_analyses_used: ((prof as any).monthly_analyses_used || 0) + 1,
          }).eq("id", userId);
          await admin.from("activity_log").insert({
            user_id: userId, action: "applied_ranking",
            metadata: { brand, scope: market.region, overall },
          });

          return Response.json({ ok: true, result });
        } catch (e) {
          console.error("[api/applied-ranking] failed", e);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
