import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getUserContext, specialtyHint } from "@/lib/user-context.server";
import { describeMarket, type GeoScope } from "@/lib/geo-scope.server";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";

type Body = { brand?: string; competitors?: string[]; keywords?: string; lang?: "en" | "ar" | "ku"; scope?: GeoScope };

const LANG_INSTRUCTION: Record<string, string> = {
  ar: "اكتب جميع القيم النصية داخل JSON باللغة العربية الفصحى.",
  en: "Write all string values inside the JSON in clear English.",
  ku: "هەموو بەهای دەقی ناو JSON ـەکە بە کوردی سۆرانی بنووسە.",
};

const buildSystem = (m: ReturnType<typeof describeMarket>) => `أنت محلل GEO خبير. ستُعطى علامة تجارية رئيسية و حتى 4 منافسين والسوق المستهدف هو: ${m.region} (${m.market}).
السياق المحلي: ${m.contextHint}
قيّم كل علامة بشكل واقعي ومتحفّظ — لا تختلق أرقاماً مؤكدة.
أعد JSON صالح فقط بهذا الشكل بالضبط:
{
  "brands": [
    {
      "name": "...",
      "is_main": true | false,
      "visibility_percent": <0-100>,
      "geo_score": <0-100>,
      "sentiment": "positive" | "neutral" | "negative",
      "platform_presence": { "chatgpt": <0-100>, "gemini": <0-100>, "claude": <0-100>, "perplexity": <0-100>, "copilot": <0-100>, "grok": <0-100>, "mistral": <0-100>, "deepseek": <0-100> },
      "strengths": ["...","..."],
      "weaknesses": ["...","..."]
    }
  ],
  "winner": "اسم العلامة الأقوى ظهوراً",
  "winner_reason": "جملة قصيرة (سطرين كحد أقصى) تشرح لماذا هذه العلامة هي الفائزة استناداً إلى الأرقام والمؤشرات",
  "overview": "فقرة قصيرة (3-4 جمل) تقارن المشهد العام",
  "content_gaps": ["موضوع/زاوية يفتقدها المنافسون يمكن للعلامة الرئيسية أن تستحوذ عليه","..."],
  "recommendations": ["خطوة عملية للعلامة الرئيسية لتجاوز المنافسين 1","...","..."]
}`;

function clamp(n: unknown) {
  const v = Number.parseInt(String(n ?? 0), 10);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, v));
}
function arr(v: unknown, max = 5) {
  if (!Array.isArray(v)) return [] as string[];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, max).map((s) => s.slice(0, 220));
}

export const Route = createFileRoute("/api/compare")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const brand = (body.brand || "").trim();
          const competitors = (body.competitors || []).map((c) => String(c || "").trim()).filter(Boolean).slice(0, 4);
          const keywords = (body.keywords || "").trim();
          const lang = body.lang === "ar" || body.lang === "ku" ? body.lang : "en";

          if (brand.length < 2) return Response.json({ error: "brand_required" }, { status: 400 });
          if (competitors.length === 0) return Response.json({ error: "competitors_required" }, { status: 400 });

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

          const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
          if (!roleRow) {
            // Allow active plan subscribers (counts against monthly_analyses)
            const { data: prof } = await admin.from("profiles").select("is_subscribed, subscription_tier, subscription_expires_at, monthly_analyses_used, usage_period_start, quota_overrides").eq("id", userId).maybeSingle();
            const planActive = !!prof?.is_subscribed && (!prof.subscription_expires_at || new Date(prof.subscription_expires_at) >= new Date());
            if (planActive) {
              const { data: plan } = await admin.from("subscription_plans").select("monthly_analyses").eq("name", prof!.subscription_tier).maybeSingle();
              const override = Number((prof as any)?.quota_overrides?.monthly_analyses || 0);
              const limit = Math.max(plan?.monthly_analyses || 200, override);
              if ((prof!.monthly_analyses_used || 0) >= limit) return Response.json({ error: "limit", limit }, { status: 402 });
              await admin.from("profiles").update({ monthly_analyses_used: (prof!.monthly_analyses_used || 0) + 1 }).eq("id", userId);
            } else {
              const { data: sub } = await admin.from("user_agent_subscriptions").select("*, agent_addons(*)").eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
              if (!sub) return Response.json({ error: "no_active_subscription" }, { status: 402 });
              const addon = (sub as any).agent_addons;
              if (!addon) return Response.json({ error: "no_addon" }, { status: 402 });
              if (sub.expires_at && new Date(sub.expires_at) < new Date()) return Response.json({ error: "subscription_expired" }, { status: 402 });
              const today = new Date().toISOString().slice(0, 10);
              const dailyUsed = sub.last_run_date === today ? sub.tasks_used_today : 0;
              if (sub.tasks_used + 1 > addon.monthly_tasks) return Response.json({ error: "monthly_cap_reached" }, { status: 402 });
              if (dailyUsed + 1 > addon.daily_task_cap) return Response.json({ error: "daily_cap_reached" }, { status: 402 });
              await admin.from("user_agent_subscriptions").update({ tasks_used: sub.tasks_used + 1, tasks_used_today: dailyUsed + 1, last_run_date: today }).eq("id", sub.id);
            }
          }

          const userCtx = await getUserContext(admin, userId);
          const market = describeMarket(body.scope);
          const SYSTEM = buildSystem(market);
          const prompt = `العلامة الرئيسية: ${brand}\nالمنافسون: ${competitors.join(" / ")}\nالكلمات المفتاحية / المجال: ${keywords || "(غير محدد)"}\nالسوق المستهدف: ${market.region}\nقيّم جميع العلامات (الرئيسية + المنافسين). قدّر platform_presence لكل محرك بناءً على ما تعرفه عن طريقة استشهاد كل محرك بالمصادر المتعلقة بـ ${market.region}.${specialtyHint(userCtx, lang as any)}`;

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
            const txt = await resp.text();
            console.error("[api/compare] AI error", resp.status, txt);
            return Response.json({ error: `ai_${resp.status}` }, { status: 500 });
          }

          const data = await resp.json();
          const content = String(data?.choices?.[0]?.message?.content || "{}");
          const parsed: any = extractJsonObject(content) || {};

          const PLATFORMS = ["chatgpt","gemini","claude","perplexity","copilot","grok","mistral"] as const;
          const allBrandNames = [brand, ...competitors];
          const brands = Array.isArray(parsed.brands) ? parsed.brands.slice(0, 5) : [];
          const normalizedBrands = allBrandNames.map((n) => {
            const found = brands.find((b: any) => String(b?.name || "").toLowerCase().trim() === n.toLowerCase().trim()) || {};
            const pp: Record<string, number> = {};
            const src = (found.platform_presence && typeof found.platform_presence === "object") ? found.platform_presence : {};
            for (const p of PLATFORMS) pp[p] = clamp(src[p]);
            return {
              name: n,
              is_main: n === brand,
              visibility_percent: clamp(found.visibility_percent),
              geo_score: clamp(found.geo_score),
              sentiment: ["positive", "neutral", "negative"].includes(found.sentiment) ? found.sentiment : "neutral",
              platform_presence: pp,
              strengths: arr(found.strengths, 4),
              weaknesses: arr(found.weaknesses, 4),
            };
          });

          // Rank brands by composite score (visibility + GEO) for fair ordering
          const ranked = [...normalizedBrands]
            .map((b) => ({ ...b, _composite: b.visibility_percent * 0.6 + b.geo_score * 0.4 }))
            .sort((a, b) => b._composite - a._composite)
            .map((b, i) => ({ ...b, rank: i + 1 }));

          const result = {
            brands: ranked.map(({ _composite, ...rest }) => rest),
            winner: String(parsed.winner || ranked[0]?.name || brand).slice(0, 120),
            winner_reason: String(parsed.winner_reason || "").slice(0, 320),
            overview: String(parsed.overview || "").slice(0, 600),
            content_gaps: arr(parsed.content_gaps, 6),
            recommendations: arr(parsed.recommendations, 6),
            specialty: userCtx.specialty,
          };

          await admin.from("agent_tasks").insert({
            user_id: userId,
            task_type: "competitor_compare",
            input: `${brand} vs ${competitors.join(", ")}`,
            status: "done",
            result: { ...result, lang, keywords, competitors, brand },
          });

          return Response.json({ ok: true, result });
        } catch (e) {
          console.error("[api/compare] fatal", e);
          return Response.json({ error: e instanceof Error ? e.message : "unknown_error" }, { status: 500 });
        }
      },
    },
  },
});
