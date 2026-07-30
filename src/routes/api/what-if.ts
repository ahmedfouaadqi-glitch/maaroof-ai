import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";
import { resolveToolModel } from "@/lib/ai-engines.server";

const COST = 2;

export const Route = createFileRoute("/api/what-if")({
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
          // Governed model selection (Part 12 registry) with the legacy default as fallback.
          const _MODEL = await resolveToolModel("google/gemini-2.5-flash");
          const _chg = await chargeTokens({ userId, toolKey: "what_if", runId: _runId, meta: { provider: "lovable_ai", model: _MODEL, endpoint: "/api/what-if" } });
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

        const { brand, changes = {}, lang = "ar", kind = "market", axes = null } = body;
        if (!brand) return Response.json({ error: "brand_required" }, { status: 400 });

        // Use last analysis or brand-boost report as baseline
        const { data: lastAnalysis } = await admin.from("analyses").select("score,details").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
        const { data: lastBoost } = await admin.from("brand_boost_runs").select("report").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();

        const langName = lang === "ar" ? "Arabic" : lang === "ku" ? "Kurdish Sorani" : "English";
        const sys = `${FACTUAL_SAFETY_PROMPT}
You are a What-If simulation engine for AI engine visibility. Reply ONLY in ${langName}.
Estimate the LIKELY directional impact of the proposed changes on the brand's visibility across each AI engine. Be conservative; never invent numbers — express deltas as ranges and include "confidence" (low|medium|high). Return ONLY valid JSON:
{
  "summary": "2-3 sentences",
  "engine_projections": [
    {"engine":"chatgpt","baseline_score":<0-100|null>,"projected_delta":"+X% to +Y%","confidence":"low|medium|high","reason":"..."}
    // include gemini, perplexity, copilot, claude, grok, mistral, deepseek, kimi
  ],
  "estimated_cost": "free|low|medium|high",
  "time_to_impact_weeks": <number>,
  "risks": ["..."],
  "final_recommendation": "go|wait|skip + 1-line reason"
}`;
        const axesBlock = axes && typeof axes === "object"
          ? `\nSimulation axes (Part 6 — Future Decision Simulator):\n${JSON.stringify(axes).slice(0, 1500)}`
          : "";
        const user = `Brand: ${brand}
Simulation kind: ${kind}
Proposed changes: ${JSON.stringify(changes)}${axesBlock}
Baseline analysis score: ${(lastAnalysis as any)?.score ?? "unknown"}
Baseline brand-boost summary: ${(lastBoost as any)?.report?.summary || "(none)"}`;

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
            await _el({ runId: _runId, provider: "lovable_ai", model: _MODEL, endpoint: "/api/what-if", inputTokens: Number(_u.prompt_tokens)||0, outputTokens: Number(_u.completion_tokens)||0, latencyMs: Date.now() - _t0 });
          } catch {}
          parsed = extractJsonObject(String(j?.choices?.[0]?.message?.content || "{}")) || {};
        } catch {}

        await admin.from("whatif_scenarios").insert({ user_id: userId, brand, changes, projection: parsed, kind, axes });
        await admin.from("profiles").update({ monthly_analyses_used: used + COST }).eq("id", userId);
        await admin.from("activity_log").insert({ user_id: userId, action: "what_if", metadata: { brand, cost: COST } });

        return Response.json(parsed);
      },
    },
  },
});
