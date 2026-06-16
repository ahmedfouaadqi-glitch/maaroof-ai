import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { describeMarket } from "@/lib/geo-scope.server";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";
import { qualityShell, buildEvidencePack, pickQualityFields } from "@/lib/tool-quality.server";


const COST = 3;

export const Route = createFileRoute("/api/geo-strategist")({
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
        const _runId = crypto.randomUUID();
          const _t0 = Date.now();
          const _chg = await chargeTokens({ userId, toolKey: "geo_strategist", runId: _runId, meta: { provider: "lovable_ai", model: "google/gemini-2.5-flash", endpoint: "/api/geo-strategist" } });
        if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });

        const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
        if (!prof) return Response.json({ error: "auth_required" }, { status: 401 });
        const used = Number((prof as any).monthly_analyses_used || 0);
        const overrideLimit = Number((prof as any)?.quota_overrides?.monthly_analyses || 0);
        const limit = (prof as any).is_subscribed ? Math.max(100, overrideLimit) : Math.max(5, overrideLimit);
        if (!(prof as any).is_subscribed && limit - used < COST) {
          return Response.json({ error: "subscription_required" }, { status: 402 });
        }

        const body = await request.json();

        const { brand, keywords = "", goals = {}, lang = "ar", scope } = body;
        if (!brand) return Response.json({ error: "brand_required" }, { status: 400 });

        // Pull last brand-boost report for grounding
        const { data: lastReport } = await admin.from("brand_boost_runs").select("report").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();

        const market = describeMarket(scope);
        const langName = lang === "ar" ? "Arabic" : lang === "ku" ? "Kurdish Sorani" : "English";
        const baseSys = `${FACTUAL_SAFETY_PROMPT}
You are a senior GEO strategist for ${market.market}. Reply ONLY in ${langName}.
Based on the brand's goals and the last brand-boost report (if any), produce a 12-week GEO action plan.
Return ONLY valid JSON:
{
  "summary": "2-3 sentences",
  "priority_keywords": ["kw1","kw2","..."],
  "content_types": [{"type":"e.g. how-to article","reason":"why"}],
  "priority_platforms": [{"engine":"chatgpt|gemini|perplexity|copilot|grok|claude","reason":"..."}],
  "editorial_calendar": [{"week":1,"title":"...","platform":"...","kpi":"..."}],
  "kpi_targets": {"visibility":"e.g. +15%","mentions":"...","backlinks":"..."},
  "risks": ["risk1"]
}`;
        const sys = qualityShell(baseSys);
        const pack = await buildEvidencePack(`${brand} ${keywords} ${market.region}`.trim(), { limit: 4, lang });
        const user = `Brand: ${brand}
Keywords: ${keywords || "-"}
Goals: ${JSON.stringify(goals)}
Market: ${market.region}
Last brand-boost report (if any): ${lastReport ? JSON.stringify((lastReport as any).report).slice(0, 4000) : "(none)"}

${pack.context_block}`;


        let parsed: any = {};
        try {
          const r = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: lovableAiHeaders(lovableKey),
            body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
          });
          if (r.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
          if (r.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
          const j: any = await r.json();
          try {
            const _u: any = (j as any)?.usage || {};
            const { enrichLedger: _el } = await import("@/lib/spend.server");
            await _el({ runId: _runId, provider: "lovable_ai", model: "google/gemini-2.5-flash", endpoint: "/api/geo-strategist", inputTokens: Number(_u.prompt_tokens)||0, outputTokens: Number(_u.completion_tokens)||0, latencyMs: Date.now() - _t0 });
          } catch {}
          parsed = extractJsonObject(String(j?.choices?.[0]?.message?.content || "{}")) || {};
        } catch {}

        const { data: row } = await admin.from("geo_strategies").insert({
          user_id: userId, brand, goals, scope, recommendations: parsed,
        }).select().single();
        await admin.from("profiles").update({ monthly_analyses_used: used + COST }).eq("id", userId);
        await admin.from("activity_log").insert({ user_id: userId, action: "geo_strategist", metadata: { brand, cost: COST } });

        return Response.json({ id: (row as any)?.id, ...parsed });
      },
    },
  },
});
