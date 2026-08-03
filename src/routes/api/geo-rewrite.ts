import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";
import { resolveToolModel } from "@/lib/ai-engines.server";
import { asText } from "@/lib/input-coerce";

type GeoScope = { scope: "world" | "country" | "city" | "province"; country?: string; city?: string };
type Body = { text: string; lang?: "en" | "ar" | "ku"; scope?: GeoScope };

function buildSys(lang: string, scope?: GeoScope) {
  const place =
    scope?.scope === "city"     ? [scope.city, scope.country].filter(Boolean).join(", ") || "Iraq" :
    scope?.scope === "province" ? [scope.city, scope.country].filter(Boolean).join(", ") || "Iraq" :
    scope?.scope === "country"  ? scope.country || "Iraq" :
    scope?.scope === "world"    ? "a global audience" :
    "Iraq";

  return `You are a STRICT, evidence-safe GEO (Generative Engine Optimization) content rewriter for ${place}.

Your job: take the SHORT social-media-style post the user provides and TRANSFORM it into a longer, citation-ready GEO version that LLMs (ChatGPT/Gemini/Claude/Perplexity) will quote in their answers.

CRITICAL TRUTH RULE: NEVER invent or estimate numbers, dates, prices, sources, awards, claims, locations, names, or entities. Use ONLY facts explicitly present in the user's text. If a useful fact is missing, add a clearly bracketed field-to-fill placeholder such as [أضف رقماً موثقاً هنا] / [add verified stat here]. Placeholders DO NOT count as evidence when scoring.

REWRITE RULES (apply ALL):
1. Length: 220-450 words.
2. Do NOT add concrete numbers unless they already exist in the input. When missing, insert a field-to-fill placeholder.
3. Do NOT add named entities unless they already exist in the input; otherwise ask for real entities tied to ${place}.
4. Do NOT add a date/year unless it already exists in the input; otherwise add a field-to-fill placeholder.
5. Do NOT add a price/currency unless it already exists in the input; if needed, ask for a real price in the currency relevant to ${place}.
6. Use clear structure: a short intro paragraph, 3-5 bullet points or sub-claims, then a conclusion.
7. Keep the user's original intent and brand voice — DO NOT change the topic.
8. Output language MUST be the same as the user's "lang" field.
9. After rewriting, RE-SCORE the new text honestly with the same strict rubric:
   - score = round(authority*0.35 + citation*0.35 + local*0.30)
   - authority/citation/local each 0-100.

OUTPUT — return ONLY a compact JSON object with these exact keys:
{
  "rewritten": string (the full rewritten content in language "${lang}"),
  "score": int 0-100,
  "authority": int 0-100,
  "local": int 0-100,
  "citation": int 0-100,
  "added_elements": array of 3-6 short bullets in language "${lang}" describing structure added and which missing evidence placeholders were inserted,
  "verify_notes": array of 1-3 short bullets in language "${lang}" listing the exact real facts/sources the user must provide before publishing
}
No markdown. No prose outside JSON.`;
}

export const Route = createFileRoute("/api/geo-rewrite")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const text = asText(body.text, 200000);
          const lang = body.lang || "ar";
          const scope = body.scope;
          if (text.length < 10) return Response.json({ error: "text_too_short" }, { status: 400 });
          if (text.length > 4000) return Response.json({ error: "text_too_long" }, { status: 400 });

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
          const _runId = crypto.randomUUID();
          const _t0 = Date.now();
          // Governed model selection (Part 12 registry) with the legacy default as fallback.
          const _MODEL = await resolveToolModel("google/gemini-2.5-flash-lite");
          const _chg = await chargeTokens({ userId, toolKey: "geo_rewrite", runId: _runId, meta: { provider: "lovable_ai", model: _MODEL, endpoint: "/api/geo-rewrite" } });
          if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });

          // Charge against the analyses quota (this combines rewrite + rescore).
          const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
          if (prof) {
            let limit = 2;
            if (prof.is_subscribed) {
              const { data: plan } = await admin.from("subscription_plans")
                .select("monthly_analyses").eq("name", prof.subscription_tier).maybeSingle();
              limit = Math.max(plan?.monthly_analyses || 200, Number((prof as any)?.quota_overrides?.monthly_analyses || 0));
            }
            if ((prof.monthly_analyses_used || 0) >= limit) {
              return Response.json({ error: "limit", limit }, { status: 402 });
            }
          }

          const resp = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: lovableAiHeaders(apiKey),
            body: JSON.stringify({
              model: _MODEL,
              messages: [
                { role: "system", content: buildSys(lang, scope) },
                { role: "user", content: `LANGUAGE: ${lang}\n\nOriginal short post:\n"""${text}"""` },
              ],
            }),
          });
          if (resp.status === 429) return Response.json({ error: "rate_limit" }, { status: 429 });
          if (resp.status === 402) return Response.json({ error: "credits" }, { status: 402 });
          if (!resp.ok) return Response.json({ error: "ai_error" }, { status: 500 });

          const data = await resp.json();
          try {
            const _u: any = (data as any)?.usage || {};
            const { enrichLedger: _el } = await import("@/lib/spend.server");
            await _el({ runId: _runId, provider: "lovable_ai", model: _MODEL, endpoint: "/api/geo-rewrite", inputTokens: Number(_u.prompt_tokens)||0, outputTokens: Number(_u.completion_tokens)||0, latencyMs: Date.now() - _t0 });
          } catch {}

          const content = data?.choices?.[0]?.message?.content || "{}";
          const parsed: any = extractJsonObject(content);
          if (!parsed?.rewritten) return Response.json({ error: "ai_format_error" }, { status: 200 });

          const clamp = (n: any) => Math.max(0, Math.min(100, parseInt(n, 10) || 0));
          const arr = (a: any) => Array.isArray(a) ? a.slice(0, 8).map((x) => String(x).slice(0, 240)) : [];
          const result = {
            rewritten: String(parsed.rewritten).slice(0, 6000),
            score: clamp(parsed.score),
            authority: clamp(parsed.authority),
            local: clamp(parsed.local),
            citation: clamp(parsed.citation),
            added_elements: arr(parsed.added_elements),
            verify_notes: arr(parsed.verify_notes),
          };

          const { data: cur } = await admin.from("profiles").select("monthly_analyses_used").eq("id", userId).single();
          await admin.from("profiles").update({
            monthly_analyses_used: (cur?.monthly_analyses_used || 0) + 1,
          }).eq("id", userId);
          await admin.from("activity_log").insert({ user_id: userId, action: "geo_rewrite", metadata: { score: result.score } });

          return Response.json(result);
        } catch (e) {
          console.error("[api/geo-rewrite] failed", e);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
