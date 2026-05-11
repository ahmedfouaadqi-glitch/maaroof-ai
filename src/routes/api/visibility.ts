import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Body = { brand?: string; keywords?: string; lang?: "en" | "ar" | "ku" };

const LANG_INSTRUCTION: Record<string, string> = {
  ar: "اكتب جميع القيم النصية داخل JSON باللغة العربية الفصحى.",
  en: "Write all string values inside the JSON in clear English.",
  ku: "هەموو بەهای دەقی ناو JSON ـەکە بە کوردی سۆرانی بنووسە.",
};

const SYSTEM = `You are a STRICT, evidence-based AI Visibility analyst for the Iraqi market.
Your job: estimate how likely each major AI engine (ChatGPT, Gemini, Claude, Perplexity, Copilot) is to mention or cite this brand when answering Iraqi user queries — and explain HOW each engine evaluates trust/citation differently.

Be conservative. If signals are weak or unknown, return low scores and say so. NEVER fabricate facts, numbers, awards, or partnerships.

Each AI platform has different priorities:
- ChatGPT (OpenAI): broad web + training data; favors well-structured pages, Wikipedia presence, news mentions, reputable backlinks.
- Gemini (Google): tightly tied to Google Search index; favors strong SEO, Google Business Profile, reviews, schema.org markup, recency.
- Claude (Anthropic): conservative; favors well-written long-form content, primary sources, .org/.gov domains, factual density.
- Perplexity: live web search + citations; favors freshness, clear sourcing, news coverage, listicles, comparison pages.
- Copilot (Microsoft): Bing index + LinkedIn; favors LinkedIn presence, Bing-indexed pages, B2B content, Microsoft ecosystem mentions.

Return ONLY valid JSON in this exact shape:
{
  "visibility_percent": <0-100, unified weighted score>,
  "sentiment": "positive" | "neutral" | "negative",
  "appearance_summary": "1-2 sentence summary in REPORT language",
  "strengths": ["concrete observation", "..."],
  "weaknesses": ["concrete missing element", "..."],
  "competitors": ["likely competitor names mentioned together with this brand", "..."],
  "recommendations": ["specific actionable improvement", "..."],
  "platforms": [
    {
      "name": "ChatGPT",
      "score": <0-100>,
      "citation_likelihood": "high" | "medium" | "low",
      "trust_signal": "short label e.g. 'Limited training data presence'",
      "why": "1-2 sentences in REPORT language explaining HOW this engine sees the brand and WHY this score",
      "action": "single most impactful next step for this engine in REPORT language"
    },
    { "name": "Gemini", ... },
    { "name": "Claude", ... },
    { "name": "Perplexity", ... },
    { "name": "Copilot", ... }
  ]
}
visibility_percent MUST be the weighted average of the 5 platform scores. All text fields MUST be in REPORT language.`;

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
  const NAMES = ["ChatGPT", "Gemini", "Claude", "Perplexity", "Copilot"];
  const arr = Array.isArray(value) ? value : [];
  const byName = new Map<string, any>();
  for (const item of arr) {
    if (item && typeof item === "object") {
      const name = String((item as any).name || "").trim();
      if (name) byName.set(name, item);
    }
  }
  return NAMES.map((name) => {
    const p: any = byName.get(name) || {};
    const lik = ["high", "medium", "low"].includes(p.citation_likelihood) ? p.citation_likelihood : "low";
    return {
      name,
      score: clamp(p.score),
      citation_likelihood: lik,
      trust_signal: String(p.trust_signal || "").trim().slice(0, 120),
      why: String(p.why || "").trim().slice(0, 360),
      action: String(p.action || "").trim().slice(0, 220),
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

  return {
    visibility_percent,
    sentiment,
    appearance_summary: String(parsed?.appearance_summary || fallbackText || "").trim().slice(0, 500),
    strengths: toArray(parsed?.strengths, 5),
    weaknesses: toArray(parsed?.weaknesses, 5),
    competitors: toArray(parsed?.competitors, 5),
    recommendations: toArray(parsed?.recommendations, 6),
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

          const { data: roleRow } = await admin
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle();

          if (!roleRow) {
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

          const prompt = `REPORT_LANGUAGE: ${lang}\nBrand: ${brand}\nKeywords: ${keywords || "(unspecified)"}\nMarket: Iraq\n\nReturn the JSON now. All text fields MUST be in language code "${lang}".`;
          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: `${SYSTEM}\n\n${LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.en}` },
                { role: "user", content: prompt },
              ],
              response_format: { type: "json_object" },
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

          let parsed: any = null;
          try {
            parsed = JSON.parse(content);
          } catch {
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
              try {
                parsed = JSON.parse(match[0]);
              } catch {
                parsed = null;
              }
            }
          }

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
          return Response.json({ error: error instanceof Error ? error.message : "unknown_error" }, { status: 500 });
        }
      },
    },
  },
});