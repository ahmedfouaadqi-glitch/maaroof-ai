import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Body = { text: string; lang?: "en" | "ar" | "ku" };

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const SYS = `You are a STRICT, evidence-based GEO (Generative Engine Optimization) analysis engine for the Iraqi market.

YOUR JOB: Audit the content as if you were ChatGPT/Gemini/Claude deciding whether to cite it when answering Iraqi user queries. Be conservative, realistic, and brutally honest. Do NOT inflate scores to be polite.

SCORING RUBRIC (apply consistently — never round up to flatter the user):
- score (overall, 0-100): Weighted average — authority 35%, citation 35%, local 30%. Round to int.
- authority (0-100): Named entities present (people, orgs, places, products), real numbers/dates, expert framing, structured headings/lists, depth of explanation. Empty/vague text = 0-25. Generic listicle = 25-50. Strong factual content with entities = 60-80. Reference-grade with citations = 85-100.
- local (0-100): Iraqi context — Iraqi cities/neighborhoods, dinar prices, local brands/laws/holidays, Arabic/Kurdish phrasing, regional relevance. No Iraq signal = 0-15. Vague Arabic only = 20-40. Mentions one Iraqi entity = 50-65. Deeply localized = 80-100.
- citation (0-100): Likelihood an LLM quotes this in an answer — must have unique facts, clear claims, and an extractable answer to a real user question. Generic marketing fluff = 0-30. Mixed = 40-60. Quotable, specific, well-structured = 70-100.

PENALIZE HEAVILY: superlatives without proof ("الأفضل", "الأول"), vague claims, no entities, no numbers, ad copy, keyword stuffing, broken structure.
REWARD: specific Iraqi names/places, concrete numbers and dates, structured Q&A or lists, source mentions, expert tone.

OUTPUT — return ONLY a compact JSON object with these exact keys:
{
  "score": int 0-100,
  "authority": int 0-100,
  "local": int 0-100,
  "citation": int 0-100,
  "ai_view": short paragraph (max 280 chars) in REPORT language — describe HOW an LLM would actually use (or skip) this content and WHY, citing concrete observations from the text,
  "strengths": array of 2-4 short bullets in REPORT language — each must reference a SPECIFIC element from the text,
  "weaknesses": array of 2-4 short bullets in REPORT language — each must name a CONCRETE missing element (e.g. "no dates", "no Iraqi cities mentioned"),
  "recommendations": array of 3-5 actionable improvements in REPORT language — each must be specific and implementable in <30 minutes,
  "keywords": array of 4-8 high-value entities/keywords actually present (kept in their original language; do NOT invent any)
}
The REPORT language MUST be: "en"=English, "ar"=العربية, "ku"=کوردی. No prose outside JSON. No markdown.`;

export const Route = createFileRoute("/api/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const text = (body.text || "").trim();
          const lang = body.lang || "en";
          if (text.length < 20) return Response.json({ error: "Text too short" }, { status: 400 });
          if (text.length > 8000) return Response.json({ error: "Text too long" }, { status: 400 });

          const apiKey = process.env.LOVABLE_API_KEY;
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!apiKey || !SUPABASE_URL || !SERVICE) {
            return Response.json({ error: "Server not configured" }, { status: 500 });
          }
          const admin = createClient(SUPABASE_URL, SERVICE);

          let userId: string | null = null;
          const auth = request.headers.get("authorization");
          if (auth?.startsWith("Bearer ")) {
            const token = auth.slice(7);
            const { data } = await admin.auth.getUser(token);
            userId = data.user?.id || null;
          }
          if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });

          // Quota
          const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
          if (prof) {
            const periodStart = new Date(prof.usage_period_start);
            if (Date.now() - periodStart.getTime() > 30 * 86400000) {
              await admin.from("profiles").update({
                monthly_analyses_used: 0, monthly_suggestions_used: 0, usage_period_start: new Date().toISOString(),
              }).eq("id", userId);
              prof.monthly_analyses_used = 0;
            }
            let limit = 2; // free trial: 2 analyses
            if (prof.is_subscribed) {
              const { data: plan } = await admin.from("subscription_plans")
                .select("monthly_analyses").eq("name", prof.subscription_tier).maybeSingle();
              limit = Math.max(plan?.monthly_analyses || 200, Number((prof as any)?.quota_overrides?.monthly_analyses || 0));
              if (prof.subscription_expires_at && new Date(prof.subscription_expires_at) < new Date()) {
                await admin.from("profiles").update({ is_subscribed: false }).eq("id", userId);
                limit = 2;
              }
            }
            if (prof.monthly_analyses_used >= limit) {
              return Response.json({ error: "limit", limit }, { status: 402 });
            }
          }

          const hash = await sha256Hex(`v3-strict::${lang}::${text}`);
          const { data: cached } = await admin.from("analysis_cache").select("result, hits").eq("input_hash", hash).maybeSingle();
          let result: any;
          let fromCache = false;

          if (cached?.result) {
            result = cached.result;
            fromCache = true;
            await admin.from("analysis_cache").update({ hits: ((cached as any).hits || 0) + 1 }).eq("input_hash", hash);
          } else {
            const langGuide: Record<string, string> = {
              ar: "اكتب جميع القيم النصية باللغة العربية الفصحى فقط.",
              en: "Write all string fields in clear English only.",
              ku: "هەموو دەقەکان تەنها بە کوردی سۆرانی بنووسە.",
            };
            const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: `${SYS}\n\n${langGuide[lang] || langGuide.en}` },
                  { role: "user", content: `REPORT_LANGUAGE: ${lang}\n\nWrite the entire report (ai_view, strengths, weaknesses, recommendations) STRICTLY in language code "${lang}". Do not mix languages, even if the source text below is in a different language.\n\nContent to analyze:\n"""${text}"""` },
                ],
                response_format: { type: "json_object" },
              }),
            });
            if (resp.status === 429) return Response.json({ error: "rate_limit" }, { status: 429 });
            if (resp.status === 402) return Response.json({ error: "credits" }, { status: 402 });
            if (!resp.ok) {
              console.error("AI error", resp.status, await resp.text());
              return Response.json({ error: "ai_error" }, { status: 500 });
            }
            const data = await resp.json();
            const content = data?.choices?.[0]?.message?.content || "{}";
            try {
              const parsed = JSON.parse(content);
              const clamp = (n: any) => Math.max(0, Math.min(100, parseInt(n, 10) || 0));
              const arr = (a: any) => Array.isArray(a) ? a.slice(0, 8).map((x) => String(x).slice(0, 240)) : [];
              result = {
                score: clamp(parsed.score),
                authority: clamp(parsed.authority),
                local: clamp(parsed.local),
                citation: clamp(parsed.citation),
                ai_view: String(parsed.ai_view || "").slice(0, 400),
                strengths: arr(parsed.strengths),
                weaknesses: arr(parsed.weaknesses),
                recommendations: arr(parsed.recommendations),
                keywords: arr(parsed.keywords),
              };
            } catch {
              return Response.json({ error: "parse_error" }, { status: 500 });
            }
            await admin.from("analysis_cache").insert({ input_hash: hash, lang, result });
          }

          await admin.from("analyses").insert({
            user_id: userId, input_text: text.slice(0, 4000), input_hash: hash,
            lang, score: result.score, authority: result.authority, local_relevance: result.local, citation: result.citation, cached: fromCache,
          });
          const { data: cur } = await admin.from("profiles").select("monthly_analyses_used").eq("id", userId).single();
          await admin.from("profiles").update({
            monthly_analyses_used: (cur?.monthly_analyses_used || 0) + 1,
          }).eq("id", userId);
          await admin.from("activity_log").insert({ user_id: userId, action: "analyze", metadata: { score: result.score, cached: fromCache } });

          return Response.json({ ...result, cached: fromCache });
        } catch (e) {
          console.error(e);
          return Response.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
        }
      },
    },
  },
});
