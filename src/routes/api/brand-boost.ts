import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { describeMarket } from "@/lib/geo-scope.server";
import { fcSearch } from "@/lib/firecrawl";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";

const PLATFORMS = ["chatgpt", "gemini", "claude", "perplexity", "copilot", "grok", "mistral", "deepseek", "kimi"] as const;
type Platform = typeof PLATFORMS[number];
const BRAND_BOOST_COST = 5;
const MAX_PLATFORMS_PER_RUN = 5;

// Map each user-facing AI engine to the closest model available on the Lovable AI Gateway.
// `proxy: true` means we cannot probe the engine directly; we use a similar-family model and
// disclose it transparently to the user.
const PLATFORM_MODEL: Record<Platform, { model: string; proxy: boolean }> = {
  chatgpt:    { model: "openai/gpt-5-mini",            proxy: false },
  gemini:     { model: "google/gemini-2.5-flash",      proxy: false },
  copilot:    { model: "openai/gpt-5-nano",            proxy: true  }, // Bing/Copilot ≈ OpenAI family
  perplexity: { model: "google/gemini-2.5-flash",      proxy: true  }, // grounded via real Firecrawl evidence
  claude:     { model: "openai/gpt-5-mini",            proxy: true  },
  grok:       { model: "openai/gpt-5-nano",            proxy: true  },
  mistral:    { model: "google/gemini-2.5-flash-lite", proxy: true  },
  deepseek:   { model: "google/gemini-2.5-flash-lite", proxy: true  },
  kimi:       { model: "google/gemini-2.5-pro",        proxy: true  }, // Kimi K2 ≈ long-context Pro proxy
};

async function callGateway(apiKey: string, model: string, messages: any[], timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: lovableAiHeaders(apiKey),
    body: JSON.stringify({ model, messages }),
      signal: controller.signal,
  });
    return r;
  } finally {
    clearTimeout(timeout);
  }
}

async function readGatewayMessage(r: Response) {
  const raw = await r.text().catch(() => "");
  let j: any = null;
  try { j = raw ? JSON.parse(raw) : null; } catch {}
  const content = String(j?.choices?.[0]?.message?.content || "").trim();
  const error = String(j?.error?.message || j?.error || raw.slice(0, 200) || `http_${r.status}`);
  return { content, error, raw };
}

function fallbackPlan(platforms: Platform[], lang: string, brand: string, evidence: { title: string; url: string; snippet: string }[], probes: any[]) {
  const ar = lang === "ar";
  const ku = lang === "ku";
  const firstUrl = evidence[0]?.url || "";
  const evidenceText = evidence.length ? evidence.slice(0, 3).map((e, i) => `[${i + 1}] ${e.title}`).join("، ") : (ar ? "لا توجد أدلة عامة كافية" : ku ? "بەڵگەی گشتی تەواو نییە" : "not enough public evidence");
  return {
    summary: ar ? `تم فحص ${brand} بأدلة عامة محدودة وإعداد خطة نشر قابلة للتنفيذ.` : ku ? `${brand} بە بەڵگەی گشتی سنووردار پشکنرا و پلانی بڵاوکردنەوە ئامادەکرا.` : `${brand} was checked against limited public evidence and a practical publishing plan was prepared.`,
    plan: platforms.map((platform) => {
      const probe = probes.find((p: any) => p.platform === platform);
      return {
        platform,
        current_signal: probe?.current_answer ? (ar ? "إشارة موجودة" : ku ? "نیشان هەیە" : "signal found") : (ar ? "إشارة ضعيفة" : ku ? "نیشانی لاواز" : "weak signal"),
        feeding_basis: evidenceText,
        recommended_actions: ar
          ? ["انشر صفحة تعريف رسمية مختصرة قابلة للفهرسة.", "أضف FAQ و JSON-LD بنفس الحقائق الموجودة في المصادر.", "اربط المحتوى من الحسابات والقنوات الرسمية."]
          : ku
            ? ["لاپەڕەیەکی فەرمی کورت بڵاو بکەرەوە.", "FAQ و JSON-LD زیاد بکە بە هەمان ڕاستییەکان.", "ناوەڕۆکەکە بە کەناڵە فەرمییەکانەوە ببەستەوە."]
            : ["Publish a concise official, indexable profile page.", "Add FAQ and JSON-LD using only evidenced facts.", "Link the content from official channels."],
        feed_strategy: ar ? "تغذية الويب العام بمحتوى رسمي قصير ومدعوم بروابط." : ku ? "خواردنی وێبی گشتی بە ناوەڕۆکی فەرمی و بە بەستەر." : "Feed the open web with concise official content backed by links.",
        content_pieces: [ar ? `صفحة: من هي ${brand}؟` : ku ? `لاپەڕە: ${brand} چییە؟` : `Page: What is ${brand}?`],
        injection_pack: {
          channel: platform === "grok" ? "X / social thread" : "Official website or public article",
          title: ar ? `نبذة موثقة عن ${brand}` : ku ? `پێناسەی پشتڕاستکراوەی ${brand}` : `Verified overview of ${brand}`,
          article_markdown: ar
            ? `## نبذة عن ${brand}\n\n${brand} علامة يجب تعريفها عبر مصادر عامة واضحة. انشر هذه النبذة في الموقع الرسمي مع روابط الأدلة المتاحة${firstUrl ? ` مثل [هذا المصدر](${firstUrl})` : ""}. يجب أن تتضمن الصفحة الاسم، المجال، الموقع الجغرافي، الخدمات، وروابط التواصل الرسمية بدون إضافة ادعاءات غير موثقة.`
            : ku
              ? `## دەربارەی ${brand}\n\n${brand} پێویستی بە پێناسەیەکی ڕوون لە سەرچاوە گشتییەکاندا هەیە${firstUrl ? ` وەک [ئەم سەرچاوەیە](${firstUrl})` : ""}. ناو، بوار، شوێن، خزمەتگوزاری و بەستەرە فەرمییەکان بنووسە، بەبێ زیادکردنی بانگەشەی نەسەلمێنراو.`
              : `## About ${brand}\n\n${brand} should be described through clear public sources${firstUrl ? ` such as [this source](${firstUrl})` : ""}. Publish the name, category, geography, services, and official contact links without adding unsupported claims.`,
          qa_pairs: [{ q: ar ? `ما هي ${brand}؟` : ku ? `${brand} چییە؟` : `What is ${brand}?`, a: ar ? `${brand} علامة تحتاج إلى تعريف عام موثق عبر مصادر رسمية.` : ku ? `${brand} پێویستی بە پێناسەی گشتیی پشتڕاستکراوە هەیە.` : `${brand} is a brand that should be described through verified public sources.` }],
          json_ld: JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", name: brand }, null, 2),
        },
      };
    }),
  };
}

export const Route = createFileRoute("/api/brand-boost")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const lovableKey = process.env.LOVABLE_API_KEY;
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!lovableKey || !SUPABASE_URL || !SERVICE) {
            return Response.json({ error: "internal_error" }, { status: 500 });
          }
          const admin = createClient(SUPABASE_URL, SERVICE);

          // Mandatory auth
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) return Response.json({ error: "auth_required" }, { status: 401 });
          const { data: userData, error: userErr } = await admin.auth.getUser(auth.slice(7));
          const userId = userData?.user?.id;
          if (userErr || !userId) return Response.json({ error: "auth_required" }, { status: 401 });

          const _runId = crypto.randomUUID();
          const _t0 = Date.now();
          const _chg = await chargeTokens({ userId, toolKey: "brand_boost", runId: _runId, meta: { provider: "lovable_ai", model: "openai/gpt-5-mini", endpoint: "/api/brand-boost" } });
          if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });

          const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
          if (!prof) return Response.json({ error: "auth_required" }, { status: 401 });
          // Per-user super-admin toggle for Brand Boost: quota_overrides.brand_boost = "on" | "off" | undefined
          const bbToggle = String((prof as any)?.quota_overrides?.brand_boost || "").toLowerCase();
          if (bbToggle === "off") {
            return Response.json({ error: "tool_disabled_by_admin" }, { status: 403 });
          }
          let allowed = bbToggle === "on";
          if (!allowed && (prof as any).is_subscribed) {
            if ((prof as any).subscription_expires_at && new Date((prof as any).subscription_expires_at) < new Date()) {
              await admin.from("profiles").update({ is_subscribed: false }).eq("id", userId);
            } else {
              allowed = true;
            }
          }
          const overrideLimit = Number((prof as any)?.quota_overrides?.monthly_analyses || 0);
          const used = Number((prof as any).monthly_analyses_used || 0);
          if (!allowed && overrideLimit - used < BRAND_BOOST_COST) {
            return Response.json({ error: "subscription_required" }, { status: 402 });
          }

          const body = await request.json();
          try {
            const _u: any = (body as any)?.usage || {};
            const { enrichLedger: _el } = await import("@/lib/spend.server");
            await _el({ runId: _runId, provider: "lovable_ai", model: "openai/gpt-5-mini", endpoint: "/api/brand-boost", inputTokens: Number(_u.prompt_tokens)||0, outputTokens: Number(_u.completion_tokens)||0, latencyMs: Date.now() - _t0 });
          } catch {}

          const { brand_name, brand_keywords, platforms = PLATFORMS, lang = "en", scope } = body;
          if (!brand_name) return Response.json({ error: "brand_name required" }, { status: 400 });

          // Admin-controlled overrides via app_settings.brand_boost:
          //   { enabled_platforms?: Platform[], probe_prompt?: string, probe_system?: string }
          let adminCfg: any = {};
          try {
            const { data: setting } = await admin.from("app_settings").select("value").eq("key", "brand_boost").maybeSingle();
            if (setting?.value && typeof setting.value === "object") adminCfg = setting.value;
          } catch {}

          const market = describeMarket(scope);
          const langName = lang === "ar" ? "Arabic" : lang === "ku" ? "Kurdish (Sorani)" : "English";
          const langInstr =
            lang === "ar" ? "اكتب جميع القيم النصية في JSON بالعربية الفصحى فقط."
            : lang === "ku" ? "هەموو دەقەکانی ناو JSON بە کوردی سۆرانی بنووسە."
            : "Write all string values inside the JSON in clear English only.";

          // ── Step 1: gather real public evidence (the "feeding") via Firecrawl
          let evidence: { title: string; url: string; snippet: string }[] = [];
          try {
            const queries = [
              `${brand_name} ${brand_keywords || ""} ${market.region}`.trim(),
              `"${brand_name}" reviews OR about OR official ${market.region}`.trim(),
            ];
            const seen = new Set<string>();
            for (const q of queries) {
              try {
                const sr: any = await fcSearch(q, { limit: 6, lang });
                const results = sr?.data?.web || sr?.web || sr?.data || [];
                for (const r of (Array.isArray(results) ? results : [])) {
                  const url = String(r?.url || "");
                  if (!url || seen.has(url)) continue;
                  seen.add(url);
                  evidence.push({
                    title: String(r?.title || url).slice(0, 160),
                    url,
                    snippet: String(r?.description || r?.markdown || "").slice(0, 400),
                  });
                  if (evidence.length >= 10) break;
                }
              } catch {}
              if (evidence.length >= 10) break;
            }
          } catch (e) {
            console.warn("[brand-boost] firecrawl failed", e);
          }
          const evidenceBlock = evidence.length
            ? evidence.map((e, i) => `[${i + 1}] ${e.title}\n${e.url}\n${e.snippet}`).join("\n\n")
            : "(no public evidence retrieved)";

          // ── Step 2: probe each selected platform with its mapped model
          // Allow admin to restrict the platform set globally
          const adminAllowed: Platform[] | null = Array.isArray(adminCfg.enabled_platforms) && adminCfg.enabled_platforms.length
            ? (adminCfg.enabled_platforms as string[]).filter((p) => (PLATFORMS as readonly string[]).includes(p)) as Platform[]
            : null;
          const requested = (platforms as Platform[]).filter((p) => PLATFORMS.includes(p));
          const targets = (adminAllowed ? requested.filter((p) => adminAllowed.includes(p)) : requested).slice(0, MAX_PLATFORMS_PER_RUN);
          if (!targets.length) return Response.json({ error: "no_platforms_enabled" }, { status: 400 });
          const probeSys = String(adminCfg.probe_system || `You are simulating the public-knowledge response of an AI assistant. Answer ONLY from what is plausibly in your training/grounding. ${FACTUAL_SAFETY_PROMPT}
If you have no reliable public knowledge, say so explicitly. Reply in ${langName}. Keep under 120 words.`);
          const probeUserTpl = String(adminCfg.probe_prompt || `What do you know about the brand "{brand}"{keywords} in the context of {market}? Mention concrete facts only.`);
          const probeUser = probeUserTpl
            .replace("{brand}", brand_name)
            .replace("{keywords}", brand_keywords ? ` (topics: ${brand_keywords})` : "")
            .replace("{market}", market.region);

          const probes = await Promise.all(
            targets.map(async (p) => {
              const cfg = PLATFORM_MODEL[p];
              try {
                const r = await callGateway(lovableKey, cfg.model, [
                  { role: "system", content: probeSys },
                  { role: "user", content: probeUser },
                ], 12000);
                if (r.status === 429) return { platform: p, model_used: cfg.model, is_proxy: cfg.proxy, current_answer: "", error: "rate_limited" };
                if (r.status === 402) return { platform: p, model_used: cfg.model, is_proxy: cfg.proxy, current_answer: "", error: "credits_exhausted" };
                if (!r.ok) return { platform: p, model_used: cfg.model, is_proxy: cfg.proxy, current_answer: "", error: `http_${r.status}` };
                const { content: ans } = await readGatewayMessage(r);
                return { platform: p, model_used: cfg.model, is_proxy: cfg.proxy, current_answer: ans };
              } catch (e: any) {
                return { platform: p, model_used: cfg.model, is_proxy: cfg.proxy, current_answer: "", error: e?.message || "probe_failed" };
              }
            })
          );

          // ── Step 3: per-platform improvement plan grounded on probe + evidence
          const planSys = `${FACTUAL_SAFETY_PROMPT}
You are a senior GEO/AI-visibility strategist for ${market.market}.
LOCALIZATION CONTEXT: ${market.contextHint}
${langInstr}
You receive: (a) the brand info, (b) what each AI engine actually said about it just now, (c) real public evidence retrieved from the open web.
For EACH platform produce: a short signal read of the engine's answer, what was likely "feeding" it (cite evidence numbers like [1],[2]; say "no signal" if the engine had nothing), 3-6 recommended actions, 2-4 publishable content pieces, AND a ready-to-publish "injection_pack" tailored to how that engine is fed. The injection_pack must be real copy-paste-ready text — not placeholders. Tailor channel to retrieval style (Perplexity/Copilot=fresh web index; Gemini=Google index → schema.org + GBP; ChatGPT/Claude=training+browse → high-authority articles + Wikipedia-style facts; Grok=X/social → tweet thread; Mistral/DeepSeek=open-web crawl). Never invent facts — only restate what's in the brand info / evidence.
Return ONLY valid JSON in this exact shape:
{
  "summary": "1-2 sentence overall read in REPORT language",
  "plan": [
    { "platform": "<key>", "current_signal": "...", "feeding_basis": "...", "recommended_actions": ["..."], "feed_strategy": "...", "content_pieces": ["..."],
      "injection_pack": {
        "channel": "where to publish",
        "title": "ready headline",
        "article_markdown": "publish-ready markdown 120-250 words mentioning brand + keywords, citing [n] evidence URLs as inline links",
        "qa_pairs": [ { "q": "user-style question", "a": "concise factual answer naming the brand" } ],
        "json_ld": "valid JSON-LD Organization or FAQPage as a string"
      }
    }
  ]
}`;

          const probesBlock = probes.map((p) =>
            `### ${p.platform} (model used: ${p.model_used}${p.is_proxy ? " — proxy" : ""})\n${p.error ? `[error: ${p.error}]` : (p.current_answer || "(empty)")}`
          ).join("\n\n");

          const planUser = `Brand: ${brand_name}
Keywords: ${brand_keywords || "-"}
Target market: ${market.region}
Platforms: ${targets.join(", ")}

WHAT EACH ENGINE ACTUALLY SAID JUST NOW:
${probesBlock}

REAL PUBLIC EVIDENCE (numbered):
${evidenceBlock}`;

          let planParsed: any = {};
          try {
            const planRes = await callGateway(lovableKey, "google/gemini-2.5-flash", [
              { role: "system", content: planSys },
              { role: "user", content: planUser },
            ], 18000);
            if (planRes.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
            if (planRes.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
            const planText = planRes.ok ? await readGatewayMessage(planRes) : { content: "", error: await planRes.text().catch(() => `http_${planRes.status}`) };
            if (!planRes.ok) console.error("[brand-boost] plan failed", planRes.status, planText.error);
            planParsed = extractJsonObject(String(planText.content || "{}")) || {};
          } catch (e) {
            console.error("[brand-boost] plan timeout/fallback", e);
          }
          if (!Array.isArray(planParsed.plan)) planParsed = fallbackPlan(targets, lang, brand_name, evidence, probes);
          const planByPlat = new Map<string, any>();
          for (const item of (planParsed.plan || [])) planByPlat.set(String(item.platform), item);

          // ── Merge probe + plan per platform
          const merged = probes.map((p) => {
            const pl = planByPlat.get(p.platform) || {};
            return {
              platform: p.platform,
              model_used: p.model_used,
              is_proxy: p.is_proxy,
              current_answer: p.current_answer,
              probe_error: (p as any).error || null,
              current_signal: pl.current_signal || (p.current_answer ? "answered" : "no signal"),
              feeding_basis: pl.feeding_basis || "no signal",
              recommended_actions: Array.isArray(pl.recommended_actions) ? pl.recommended_actions : [],
              feed_strategy: pl.feed_strategy || "",
              content_pieces: Array.isArray(pl.content_pieces) ? pl.content_pieces : [],
              injection_pack: pl.injection_pack && typeof pl.injection_pack === "object" ? pl.injection_pack : null,
            };
          });

          // Track usage
          const { data: cur } = await admin.from("profiles").select("monthly_analyses_used").eq("id", userId).single();
          await admin.from("profiles").update({
            monthly_analyses_used: ((cur as any)?.monthly_analyses_used || 0) + BRAND_BOOST_COST,
          }).eq("id", userId);
          await admin.from("activity_log").insert({ user_id: userId, action: "brand_boost", metadata: { brand: brand_name, platforms: targets, cost: BRAND_BOOST_COST } });

          return Response.json({
            summary: planParsed.summary || "",
            evidence,
            plan: merged,
          });
        } catch (e) {
          console.error("[api/brand-boost] failed", e);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
