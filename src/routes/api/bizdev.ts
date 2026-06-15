import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { describeMarket, type GeoScope } from "@/lib/geo-scope.server";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";

type Body = {
  business_name?: string;
  stage?: string;
  sector?: string;
  city?: string;
  current_revenue_iqd?: string | number;
  monthly_customers?: string | number;
  team_size?: string | number;
  channels?: string;
  goals?: string;
  challenges?: string;
  budget_iqd?: string | number;
  notes?: string;
  lang?: "en" | "ar" | "ku";
  scope?: GeoScope;
};

const buildSystem = (m: ReturnType<typeof describeMarket>) => `${FACTUAL_SAFETY_PROMPT}

You are a senior business-development strategist for ${m.market}. Build a realistic, sequenced 12-month growth plan.

Be concrete and conservative. LOCALIZATION CONTEXT: ${m.contextHint} NEVER fabricate exact partner names, KPI targets, budgets, contacts, or government statistics. If inputs are weak, say so and recommend discovery steps before tactics.

Return ONLY valid JSON in this exact shape (all text fields in REPORT language):
{
  "growth_score": <0-100, current readiness>,
  "stage_assessment": "1-3 sentence honest take on where the business actually is",
  "north_star_metric": "the ONE metric this business should obsess over for the next 12 months",
  "swot": {
    "strengths": ["...", "..."],
    "weaknesses": ["...", "..."],
    "opportunities": ["...", "..."],
    "threats": ["...", "..."]
  },
  "growth_levers": [
    {
      "title": "lever name (e.g. 'Activate WhatsApp Catalog')",
      "impact": "high" | "medium" | "low",
      "effort": "high" | "medium" | "low",
      "expected_outcome": "concrete outcome only if supported by provided data; otherwise say what to measure first",
      "how_to": ["step 1", "step 2", "step 3"]
    }
  ],
  "channel_plan": [
    {
      "channel": "channel name (Instagram, WhatsApp, TikTok, Google Ads, B2B outbound, Events, etc.)",
      "fit": "high" | "medium" | "low",
      "monthly_budget_iqd": "provided budget allocation or 'insufficient data — add monthly budget'",
      "primary_kpi": "single KPI",
      "first_action": "first concrete action this week"
    }
  ],
  "partnerships": [
    { "type": "type of partner (e.g. 'Local logistics', 'University club')", "value": "what they bring", "approach": "how to reach out" }
  ],
  "roadmap": {
    "month_1_3": ["initiative 1", "..."],
    "month_4_6": ["initiative 1", "..."],
    "month_7_12": ["initiative 1", "..."]
  },
  "risks": [
    { "risk": "specific risk", "severity": "high" | "medium" | "low", "mitigation": "concrete mitigation" }
  ],
  "kpis": [
    { "name": "KPI", "target_3m": "target at 3 months if calculable, otherwise baseline needed", "target_12m": "target at 12 months if calculable, otherwise baseline needed" }
  ],
  "quick_wins": ["actionable win achievable in <14 days", "...", "..."]
}

Rules:
- growth_score reflects ACTUAL readiness given the inputs, not aspiration.
- Every recommendation must reference the specific business stage, sector, and city given.
- Quick wins must be doable with existing resources.
- Avoid generic phrases like "improve marketing" — be specific.`;

function clamp(n: unknown) {
  const v = Number.parseInt(String(n ?? 0), 10);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, v));
}
function arr(v: unknown, max = 8): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, max).map((s) => s.slice(0, 280));
}
const sev = (v: any) => (["high", "medium", "low"].includes(v) ? v : "medium");

function normalize(parsed: any) {
  const swot = parsed?.swot || {};
  return {
    growth_score: clamp(parsed?.growth_score),
    stage_assessment: String(parsed?.stage_assessment || "").slice(0, 600),
    north_star_metric: String(parsed?.north_star_metric || "").slice(0, 200),
    swot: {
      strengths: arr(swot.strengths, 6),
      weaknesses: arr(swot.weaknesses, 6),
      opportunities: arr(swot.opportunities, 6),
      threats: arr(swot.threats, 6),
    },
    growth_levers: (Array.isArray(parsed?.growth_levers) ? parsed.growth_levers : []).slice(0, 6).map((l: any) => ({
      title: String(l?.title || "").slice(0, 160),
      impact: sev(l?.impact),
      effort: sev(l?.effort),
      expected_outcome: String(l?.expected_outcome || "").slice(0, 240),
      how_to: arr(l?.how_to, 6),
    })).filter((l: any) => l.title),
    channel_plan: (Array.isArray(parsed?.channel_plan) ? parsed.channel_plan : []).slice(0, 8).map((c: any) => ({
      channel: String(c?.channel || "").slice(0, 80),
      fit: sev(c?.fit),
      monthly_budget_iqd: String(c?.monthly_budget_iqd || "").slice(0, 120),
      primary_kpi: String(c?.primary_kpi || "").slice(0, 120),
      first_action: String(c?.first_action || "").slice(0, 240),
    })).filter((c: any) => c.channel),
    partnerships: (Array.isArray(parsed?.partnerships) ? parsed.partnerships : []).slice(0, 6).map((p: any) => ({
      type: String(p?.type || "").slice(0, 120),
      value: String(p?.value || "").slice(0, 200),
      approach: String(p?.approach || "").slice(0, 240),
    })).filter((p: any) => p.type),
    roadmap: {
      month_1_3: arr(parsed?.roadmap?.month_1_3, 6),
      month_4_6: arr(parsed?.roadmap?.month_4_6, 6),
      month_7_12: arr(parsed?.roadmap?.month_7_12, 6),
    },
    risks: (Array.isArray(parsed?.risks) ? parsed.risks : []).slice(0, 6).map((r: any) => ({
      risk: String(r?.risk || "").slice(0, 240), severity: sev(r?.severity), mitigation: String(r?.mitigation || "").slice(0, 240),
    })).filter((r: any) => r.risk),
    kpis: (Array.isArray(parsed?.kpis) ? parsed.kpis : []).slice(0, 8).map((k: any) => ({
      name: String(k?.name || "").slice(0, 120),
      target_3m: String(k?.target_3m || "").slice(0, 120),
      target_12m: String(k?.target_12m || "").slice(0, 120),
    })).filter((k: any) => k.name),
    quick_wins: arr(parsed?.quick_wins, 8),
  };
}

export const Route = createFileRoute("/api/bizdev")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const name = (body.business_name || "").trim();
          const lang = body.lang === "ar" || body.lang === "ku" ? body.lang : "en";
          if (name.length < 2) return Response.json({ error: "business_required" }, { status: 400 });

          const apiKey = process.env.LOVABLE_API_KEY;
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!apiKey || !SUPABASE_URL || !SERVICE) return Response.json({ error: "server_not_configured" }, { status: 500 });

          const admin = createClient(SUPABASE_URL, SERVICE);
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) return Response.json({ error: "auth_required" }, { status: 401 });
          const { data: authData } = await admin.auth.getUser(auth.slice(7));
          const userId = authData.user?.id;
          if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });
          const _runId = crypto.randomUUID();
          const _t0 = Date.now();
          const _chg = await chargeTokens({ userId, toolKey: "bizdev", runId: _runId, meta: { provider: "lovable_ai", model: "google/gemini-2.5-flash-lite", endpoint: "/api/bizdev" } });
          if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });

          const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
          if (prof) {
            const periodStart = new Date(prof.usage_period_start);
            if (Date.now() - periodStart.getTime() > 30 * 86400000) {
              await admin.from("profiles").update({
                monthly_analyses_used: 0, monthly_suggestions_used: 0, usage_period_start: new Date().toISOString(),
              }).eq("id", userId);
              prof.monthly_analyses_used = 0;
            }
            let limit = 2;
            if (prof.is_subscribed) {
              const { data: plan } = await admin.from("subscription_plans")
                .select("monthly_analyses").eq("name", prof.subscription_tier).maybeSingle();
              limit = Math.max(plan?.monthly_analyses || 200, Number((prof as any)?.quota_overrides?.monthly_analyses || 0));
              if (prof.subscription_expires_at && new Date(prof.subscription_expires_at) < new Date()) limit = 2;
            }
            if ((prof.monthly_analyses_used || 0) >= limit) {
              return Response.json({ error: "limit", limit }, { status: 402 });
            }
          }

          const market = describeMarket(body.scope);
          const SYSTEM = buildSystem(market);
          const userPrompt = `REPORT_LANGUAGE: ${lang}
Business name: ${name}
Stage: ${body.stage || "(unspecified)"}
Sector: ${body.sector || "(unspecified)"}
Target market: ${market.region}
City / Region: ${body.city || "(unspecified)"}
Current monthly revenue: ${body.current_revenue_iqd ?? "(unspecified)"}
Monthly active customers: ${body.monthly_customers ?? "(unspecified)"}
Team size: ${body.team_size ?? "(unspecified)"}
Current marketing channels: ${body.channels || "(unspecified)"}
12-month goals: ${body.goals || "(unspecified)"}
Top challenges right now: ${body.challenges || "(unspecified)"}
Available growth budget (per month): ${body.budget_iqd ?? "(unspecified)"}
Extra notes: ${body.notes || "(none)"}

Return the JSON business-development plan now. All string fields MUST be in language "${lang}".`;

          const langGuide: Record<string, string> = {
            ar: "اكتب جميع القيم النصية داخل JSON باللغة العربية الفصحى.",
            en: "Write all string values inside the JSON in clear English.",
            ku: "هەموو بەهای دەقی ناو JSON ـەکە بە کوردی سۆرانی بنووسە.",
          };
          const resp = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: lovableAiHeaders(apiKey),
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: `${SYSTEM}\n\n${langGuide[lang] || langGuide.en}` },
                { role: "user", content: userPrompt },
              ]
            }),
          });

          if (resp.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
          if (resp.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
          if (!resp.ok) {
            console.error("[api/bizdev] gateway error", resp.status, await resp.text());
            return Response.json({ error: `ai_${resp.status}` }, { status: 500 });
          }

          const data = await resp.json();

          const content = String(data?.choices?.[0]?.message?.content || "{}");
          const result = normalize(extractJsonObject(content) || {});

          const { data: cur } = await admin.from("profiles").select("monthly_analyses_used").eq("id", userId).single();
          await admin.from("profiles").update({
            monthly_analyses_used: (cur?.monthly_analyses_used || 0) + 1,
          }).eq("id", userId);

          await admin.from("agent_tasks").insert({
            user_id: userId,
            task_type: "bizdev",
            input: name,
            status: "done",
            result: { ...result, lang, inputs: body },
          });
          await admin.from("activity_log").insert({ user_id: userId, action: "bizdev", metadata: { name, score: result.growth_score } });

          return Response.json({ ok: true, result });
        } catch (e) {
          console.error("[api/bizdev] fatal", e);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
