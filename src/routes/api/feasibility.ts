import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { describeMarket, type GeoScope } from "@/lib/geo-scope.server";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";

type Body = {
  project_name?: string;
  sector?: string;
  city?: string;
  target_audience?: string;
  problem?: string;
  solution?: string;
  budget_iqd?: string | number;
  team_size?: string | number;
  timeline_months?: string | number;
  revenue_model?: string;
  competitors?: string;
  notes?: string;
  lang?: "en" | "ar" | "ku";
  scope?: GeoScope;
};

const buildSystem = (m: ReturnType<typeof describeMarket>) => `${FACTUAL_SAFETY_PROMPT}

You are a STRICT, evidence-based feasibility-study analyst for ${m.market}.

Analyze the project conservatively and realistically. LOCALIZATION CONTEXT: ${m.contextHint} If costs or market sizes are not provided by the user, return qualitative guidance or explicitly label required user inputs; do not invent ranges. When unsure, say so and assign lower confidence.

Return ONLY valid JSON with this exact shape (all text fields in REPORT language):
{
  "viability_score": <0-100 integer, weighted: market 30 + financial 30 + operational 20 + risk 20>,
  "verdict": "go" | "pivot" | "no-go",
  "confidence": "high" | "medium" | "low",
  "executive_summary": "3-5 sentence honest summary",
  "market": {
    "size_estimate": "qualitative assessment based on provided inputs; if no sourced size is provided, say insufficient data",
    "demand_signals": ["concrete signal 1", "..."],
    "barriers": ["concrete barrier 1", "..."],
    "score": <0-100>
  },
  "financial": {
    "startup_cost_iqd": "provided value or 'insufficient data — add real startup budget'",
    "monthly_burn_iqd": "provided value or 'insufficient data — add rent/payroll/marketing costs'",
    "breakeven_months": "calculated only if enough provided inputs exist, otherwise 'insufficient data'",
    "revenue_assumptions": ["assumption 1", "..."],
    "score": <0-100>
  },
  "operational": {
    "team_needs": ["role + count, e.g. '1 marketing lead, 2 ops, 1 developer'"],
    "key_processes": ["process 1", "..."],
    "infrastructure": ["item 1", "..."],
    "score": <0-100>
  },
  "risks": [
    { "risk": "specific risk", "severity": "high" | "medium" | "low", "mitigation": "concrete mitigation step" }
  ],
  "competitors": [
    { "name": "competitor name (or 'unknown' if not provided)", "strength": "what they do well", "gap": "where this project can win" }
  ],
  "next_steps": ["actionable step 1 (≤30 days)", "...", "..."],
  "kpis": ["measurable KPI 1", "..."]
}

Rules:
- viability_score MUST equal weighted average of the 4 sub-scores (market 30%, financial 30%, operational 20%, risk-inverse 20%).
- If a section has insufficient input, set its score lower and explicitly note "insufficient data" in that section's text.
- Avoid generic advice. Reference the actual project details given by the user.`;

function clamp(n: unknown) {
  const v = Number.parseInt(String(n ?? 0), 10);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, v));
}
function toArr(v: unknown, max = 8): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, max).map((s) => s.slice(0, 280));
}
function normSection(s: any) {
  return s && typeof s === "object" ? s : {};
}

function normalize(parsed: any) {
  const verdicts = ["go", "pivot", "no-go"];
  const confs = ["high", "medium", "low"];
  const market = normSection(parsed?.market);
  const financial = normSection(parsed?.financial);
  const operational = normSection(parsed?.operational);
  const risks = Array.isArray(parsed?.risks) ? parsed.risks.slice(0, 8).map((r: any) => ({
    risk: String(r?.risk || "").slice(0, 240),
    severity: ["high", "medium", "low"].includes(r?.severity) ? r.severity : "medium",
    mitigation: String(r?.mitigation || "").slice(0, 240),
  })).filter((r: any) => r.risk) : [];
  const competitors = Array.isArray(parsed?.competitors) ? parsed.competitors.slice(0, 6).map((c: any) => ({
    name: String(c?.name || "").slice(0, 80),
    strength: String(c?.strength || "").slice(0, 200),
    gap: String(c?.gap || "").slice(0, 200),
  })).filter((c: any) => c.name) : [];

  return {
    viability_score: clamp(parsed?.viability_score),
    verdict: verdicts.includes(parsed?.verdict) ? parsed.verdict : "pivot",
    confidence: confs.includes(parsed?.confidence) ? parsed.confidence : "medium",
    executive_summary: String(parsed?.executive_summary || "").slice(0, 900),
    market: {
      size_estimate: String(market.size_estimate || "").slice(0, 240),
      demand_signals: toArr(market.demand_signals, 6),
      barriers: toArr(market.barriers, 6),
      score: clamp(market.score),
    },
    financial: {
      startup_cost_iqd: String(financial.startup_cost_iqd || "").slice(0, 120),
      monthly_burn_iqd: String(financial.monthly_burn_iqd || "").slice(0, 120),
      breakeven_months: String(financial.breakeven_months || "").slice(0, 80),
      revenue_assumptions: toArr(financial.revenue_assumptions, 6),
      score: clamp(financial.score),
    },
    operational: {
      team_needs: toArr(operational.team_needs, 6),
      key_processes: toArr(operational.key_processes, 6),
      infrastructure: toArr(operational.infrastructure, 6),
      score: clamp(operational.score),
    },
    risks,
    competitors,
    next_steps: toArr(parsed?.next_steps, 8),
    kpis: toArr(parsed?.kpis, 8),
  };
}

export const Route = createFileRoute("/api/feasibility")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const project = (body.project_name || "").trim();
          const lang = body.lang === "ar" || body.lang === "ku" ? body.lang : "en";

          if (project.length < 2) return Response.json({ error: "project_required" }, { status: 400 });

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

          // Quota piggybacks on monthly_analyses_used
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
              if (prof.subscription_expires_at && new Date(prof.subscription_expires_at) < new Date()) {
                limit = 2;
              }
            }
            if ((prof.monthly_analyses_used || 0) >= limit) {
              return Response.json({ error: "limit", limit }, { status: 402 });
            }
          }

          const market = describeMarket(body.scope);
          const SYSTEM = buildSystem(market);
          const userPrompt = `REPORT_LANGUAGE: ${lang}
Project name: ${project}
Sector: ${body.sector || "(unspecified)"}
Target market: ${market.region}
City / Region: ${body.city || "(unspecified)"}
Target audience: ${body.target_audience || "(unspecified)"}
Problem solved: ${body.problem || "(unspecified)"}
Proposed solution: ${body.solution || "(unspecified)"}
Total budget: ${body.budget_iqd ?? "(unspecified)"}
Initial team size: ${body.team_size ?? "(unspecified)"}
Planned timeline (months): ${body.timeline_months ?? "(unspecified)"}
Revenue model: ${body.revenue_model || "(unspecified)"}
Known competitors: ${body.competitors || "(none provided)"}
Extra notes: ${body.notes || "(none)"}

Return the JSON feasibility report now. All string fields MUST be in language "${lang}".`;

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
            console.error("[api/feasibility] gateway error", resp.status, await resp.text());
            return Response.json({ error: `ai_${resp.status}` }, { status: 500 });
          }

          const data = await resp.json();
          const content = String(data?.choices?.[0]?.message?.content || "{}");
          const result = normalize(extractJsonObject(content) || {});

          // increment quota
          const { data: cur } = await admin.from("profiles").select("monthly_analyses_used").eq("id", userId).single();
          await admin.from("profiles").update({
            monthly_analyses_used: (cur?.monthly_analyses_used || 0) + 1,
          }).eq("id", userId);

          await admin.from("agent_tasks").insert({
            user_id: userId,
            task_type: "feasibility",
            input: project,
            status: "done",
            result: { ...result, lang, inputs: body },
          });
          await admin.from("activity_log").insert({ user_id: userId, action: "feasibility", metadata: { project, score: result.viability_score } });

          return Response.json({ ok: true, result });
        } catch (e) {
          console.error("[api/feasibility] fatal", e);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
