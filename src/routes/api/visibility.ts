import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { describeMarket, type GeoScope } from "@/lib/geo-scope.server";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";

type Body = { brand?: string; keywords?: string; lang?: "en" | "ar" | "ku"; scope?: GeoScope };

const LANG_INSTRUCTION: Record<string, string> = {
  ar: "اكتب جميع القيم النصية داخل JSON باللغة العربية الفصحى.",
  en: "Write all string values inside the JSON in clear English.",
  ku: "هەموو بەهای دەقی ناو JSON ـەکە بە کوردی سۆرانی بنووسە.",
};

const buildSystem = (m: ReturnType<typeof describeMarket>) => `${FACTUAL_SAFETY_PROMPT}

You are a STRICT, evidence-based AI Visibility analyst for ${m.market}.
Your job: estimate how likely each major AI engine (ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek, Kimi) is to mention or cite this brand when answering queries from ${m.audience} — and explain HOW each engine evaluates trust/citation differently.

LOCALIZATION CONTEXT for this run: ${m.contextHint}

Be conservative. If signals are weak or unknown, return low scores and say so. NEVER fabricate facts, numbers, awards, or partnerships. When you have no evidence, say "no public signals detected" instead of inventing facts.

Each AI platform uses a DIFFERENT citation mechanism — name it explicitly:
- ChatGPT (OpenAI): hybrid — pretrained corpus + Bing-powered web tool. Favors well-structured pages, Wikipedia presence, news mentions, reputable backlinks, OpenGraph metadata. citation_method = "training_corpus + web_search".
- Gemini (Google): tightly tied to Google Search index + Knowledge Graph. Favors strong SEO, Google Business Profile, reviews, schema.org markup, recency. citation_method = "google_search_index + knowledge_graph".
- Claude (Anthropic): conservative; favors well-written long-form content, primary sources, .org/.gov domains, factual density. Web access only via tools. citation_method = "training_corpus + curated_web".
- Perplexity: live web search + inline citations. Favors freshness, clear sourcing, news coverage, listicles, comparison pages, sites that allow crawlers. citation_method = "live_web_search + ranked_citations".
- Copilot (Microsoft): Bing index + LinkedIn graph + Microsoft 365 graph. Favors LinkedIn presence, Bing-indexed pages, B2B content. citation_method = "bing_index + linkedin_graph".
- Grok (xAI): real-time X (Twitter) signal + general web. Favors brand presence on X, recent buzz, viral mentions, news. citation_method = "x_realtime + web_search".
- Mistral (Le Chat): web search via Brave/SerpAPI partners, training corpus. Favors EU-friendly sources, multilingual content, structured pages. citation_method = "training_corpus + brave_search".
- DeepSeek: efficient reasoning model with web tool. Favors technical docs, GitHub/Stack Overflow content, structured factual pages, multilingual sources (Chinese + English strong). citation_method = "training_corpus + web_search".

Return ONLY valid JSON in this exact shape:
{
  "visibility_percent": <0-100, unified weighted score>,
  "confidence": "high" | "medium" | "low",
  "sentiment": "positive" | "neutral" | "negative",
  "appearance_summary": "1-2 sentence summary in REPORT language",
  "strengths": ["concrete observation", "..."],
  "weaknesses": ["concrete missing element", "..."],
  "competitors": ["likely competitor names mentioned together with this brand", "..."],
  "recommendations": ["specific actionable improvement, prioritized", "..."],
  "platforms": [
    {
      "name": "ChatGPT",
      "score": <0-100>,
      "citation_likelihood": "high" | "medium" | "low",
      "citation_method": "short label naming the mechanism (e.g. 'training_corpus + web_search')",
      "evidence_basis": "what THIS engine relies on for THIS brand (e.g. 'no Wikipedia article; few news mentions; weak backlinks')",
      "authority_factors": ["short factor 1 affecting trust on this engine", "factor 2", "factor 3"],
      "trust_signal": "short label e.g. 'Limited training data presence'",
      "freshness_weight": "high" | "medium" | "low",
      "why": "1-2 sentences in REPORT language explaining HOW this engine sees the brand and WHY this score",
      "action": "single most impactful next step for THIS engine in REPORT language",
      "priority": "high" | "medium" | "low"
    },
    { "name": "Gemini", ... },
    { "name": "Claude", ... },
    { "name": "Perplexity", ... },
    { "name": "Copilot", ... },
    { "name": "Grok", ... },
    { "name": "Mistral", ... },
    { "name": "DeepSeek", ... }
  ]
}
visibility_percent MUST be the weighted average of the 8 platform scores (rounded). All text fields MUST be in REPORT language.`;

function clamp(n: unknown) {
  const value = Number.parseInt(String(n ?? 0), 10);
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function toArray(value: unknown, max = 6) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, max)
    .map((item) => item.slice(0, 220));
}

function normalizePlatforms(value: unknown): Array<any> {
  const NAMES = ["ChatGPT", "Gemini", "Claude", "Perplexity", "Copilot", "Grok", "Mistral", "DeepSeek", "Kimi"];
  const arr = Array.isArray(value) ? value : [];
  const byName = new Map<string, any>();
  for (const item of arr) {
    if (item && typeof item === "object") {
      const name = String((item as any).name || "").trim();
      if (name) byName.set(name, item);
    }
  }
  const enumOrDefault = (v: any, vals: string[], d: string) => (vals.includes(v) ? v : d);
  return NAMES.map((name) => {
    const p: any = byName.get(name) || {};
    const factors = Array.isArray(p.authority_factors)
      ? p.authority_factors.slice(0, 4).map((x: any) => String(x ?? "").slice(0, 90)).filter(Boolean)
      : [];
    return {
      name,
      score: clamp(p.score),
      citation_likelihood: enumOrDefault(p.citation_likelihood, ["high", "medium", "low"], "low"),
      citation_method: String(p.citation_method || "").trim().slice(0, 100),
      evidence_basis: String(p.evidence_basis || "").trim().slice(0, 240),
      authority_factors: factors,
      trust_signal: String(p.trust_signal || "").trim().slice(0, 120),
      freshness_weight: enumOrDefault(p.freshness_weight, ["high", "medium", "low"], "medium"),
      why: String(p.why || "").trim().slice(0, 360),
      action: String(p.action || "").trim().slice(0, 220),
      priority: enumOrDefault(p.priority, ["high", "medium", "low"], "medium"),
    };
  });
}

function normalizeResult(parsed: any, fallbackText = "") {
  const sentiment = ["positive", "neutral", "negative"].includes(parsed?.sentiment)
    ? parsed.sentiment
    : "neutral";

  const platforms = normalizePlatforms(parsed?.platforms);
  const platformAvg = platforms.length
    ? Math.round(platforms.reduce((s, p) => s + (p.score || 0), 0) / platforms.length)
    : clamp(parsed?.visibility_percent);
  const visibility_percent = clamp(parsed?.visibility_percent) || platformAvg;

  const confidence = ["high", "medium", "low"].includes(parsed?.confidence) ? parsed.confidence : "medium";

  return {
    visibility_percent,
    confidence,
    sentiment,
    appearance_summary: String(parsed?.appearance_summary || fallbackText || "").trim().slice(0, 500),
    strengths: toArray(parsed?.strengths, 6),
    weaknesses: toArray(parsed?.weaknesses, 6),
    competitors: toArray(parsed?.competitors, 6),
    recommendations: toArray(parsed?.recommendations, 8),
    platforms,
  };
}

export const Route = createFileRoute("/api/visibility")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const brand = (body.brand || "").trim();
          const keywords = (body.keywords || "").trim();
          const lang = body.lang === "ar" || body.lang === "ku" ? body.lang : "en";

          if (brand.length < 2) {
            return Response.json({ error: "brand_required" }, { status: 400 });
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!apiKey || !SUPABASE_URL || !SERVICE) {
            return Response.json({ error: "server_not_configured" }, { status: 500 });
          }

          const admin = createClient(SUPABASE_URL, SERVICE);
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) {
            return Response.json({ error: "auth_required" }, { status: 401 });
          }

          const token = auth.slice(7);
          const { data: authData } = await admin.auth.getUser(token);
          const userId = authData.user?.id;
          if (!userId) {
            return Response.json({ error: "auth_required" }, { status: 401 });
          }

          const _runId = crypto.randomUUID();
          const _t0 = Date.now();
          const _chg = await chargeTokens({ userId, toolKey: "visibility", runId: _runId, meta: { provider: "lovable_ai", model: "google/gemini-2.5-flash-lite", endpoint: "/api/visibility" } });
          if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });

          const { data: roleRow } = await admin
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle();

          if (!roleRow) {
            // Allow active plan subscribers (counts against monthly_analyses)
            const { data: prof } = await admin.from("profiles").select("is_subscribed, subscription_tier, subscription_expires_at, monthly_analyses_used, quota_overrides").eq("id", userId).maybeSingle();
            const planActive = !!prof?.is_subscribed && (!prof.subscription_expires_at || new Date(prof.subscription_expires_at) >= new Date());
            if (planActive) {
              const { data: plan } = await admin.from("subscription_plans").select("monthly_analyses").eq("name", prof!.subscription_tier).maybeSingle();
              const override = Number((prof as any)?.quota_overrides?.monthly_analyses || 0);
              const limit = Math.max(plan?.monthly_analyses || 200, override);
              if ((prof!.monthly_analyses_used || 0) >= limit) return Response.json({ error: "limit", limit }, { status: 402 });
              await admin.from("profiles").update({ monthly_analyses_used: (prof!.monthly_analyses_used || 0) + 1 }).eq("id", userId);
            } else {
              const { data: sub } = await admin
                .from("user_agent_subscriptions")
                .select("*, agent_addons(*)")
                .eq("user_id", userId)
                .eq("status", "active")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (!sub) return Response.json({ error: "no_active_subscription" }, { status: 402 });
              const addon = (sub as any).agent_addons;
              if (!addon) return Response.json({ error: "no_addon" }, { status: 402 });
              if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
                return Response.json({ error: "subscription_expired" }, { status: 402 });
              }

              const today = new Date().toISOString().slice(0, 10);
              const dailyUsed = sub.last_run_date === today ? sub.tasks_used_today : 0;
              if (sub.tasks_used + 1 > addon.monthly_tasks) {
                return Response.json({ error: "monthly_cap_reached" }, { status: 402 });
              }
              if (dailyUsed + 1 > addon.daily_task_cap) {
                return Response.json({ error: "daily_cap_reached" }, { status: 402 });
              }

              const { error: usageErr } = await admin
                .from("user_agent_subscriptions")
                .update({
                  tasks_used: sub.tasks_used + 1,
                  tasks_used_today: dailyUsed + 1,
                  last_run_date: today,
                })
                .eq("id", sub.id);

              if (usageErr) {
                console.error("[api/visibility] usage update failed:", usageErr.message);
                return Response.json({ error: "usage_update_failed" }, { status: 500 });
              }
            }
          }

          const market = describeMarket(body.scope);
          const SYSTEM = buildSystem(market);
          const prompt = `REPORT_LANGUAGE: ${lang}\nBrand: ${brand}\nKeywords: ${keywords || "(unspecified)"}\nMarket: ${market.region}\n\nReturn the JSON now. All text fields MUST be in language code "${lang}".`;
          const resp = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: lovableAiHeaders(apiKey),
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: `${SYSTEM}\n\n${LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.en}` },
                { role: "user", content: prompt },
              ]
            }),
          });

          if (resp.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
          if (resp.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
          if (!resp.ok) {
            const rawError = await resp.text();
            console.error("[api/visibility] AI gateway error:", resp.status, rawError);
            return Response.json({ error: `ai_${resp.status}` }, { status: 500 });
          }

          const data = await resp.json();
          const content = String(data?.choices?.[0]?.message?.content || "{}");

          const parsed = extractJsonObject(content);

          const result = normalizeResult(parsed || {}, content);

          await admin.from("profiles").update({
            brand_name: brand,
            brand_keywords: keywords || null,
          }).eq("id", userId);

          const taskPayload = {
            user_id: userId,
            task_type: "ai_visibility",
            input: brand,
            status: "done",
            result: { ...result, raw: content, lang, keywords },
          };

          const { data: taskRow, error: taskErr } = await admin
            .from("agent_tasks")
            .insert(taskPayload)
            .select("id")
            .single();

          if (taskErr) {
            console.error("[api/visibility] task insert failed:", taskErr.message);
          }

          return Response.json({ ok: true, taskId: taskRow?.id ?? null, result });
        } catch (error) {
          console.error("[api/visibility] fatal error:", error);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
