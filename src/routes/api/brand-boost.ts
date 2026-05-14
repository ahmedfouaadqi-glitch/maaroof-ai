import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { describeMarket } from "@/lib/geo-scope.server";
import { fcSearch } from "@/lib/firecrawl";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";

const PLATFORMS = ["chatgpt", "gemini", "claude", "perplexity", "copilot", "grok", "mistral", "deepseek"] as const;
type Platform = typeof PLATFORMS[number];

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
};

async function callGateway(apiKey: string, model: string, messages: any[]) {
  const r = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: lovableAiHeaders(apiKey),
    body: JSON.stringify({ model, messages }),
  });
  return r;
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
          if (!allowed && overrideLimit <= ((prof as any).monthly_analyses_used || 0)) {
            return Response.json({ error: "subscription_required" }, { status: 402 });
          }

          const body = await request.json();
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
          const targets = adminAllowed ? requested.filter((p) => adminAllowed.includes(p)) : requested;
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
                ]);
                if (r.status === 429) return { platform: p, model_used: cfg.model, is_proxy: cfg.proxy, current_answer: "", error: "rate_limited" };
                if (r.status === 402) return { platform: p, model_used: cfg.model, is_proxy: cfg.proxy, current_answer: "", error: "credits_exhausted" };
                if (!r.ok) return { platform: p, model_used: cfg.model, is_proxy: cfg.proxy, current_answer: "", error: `http_${r.status}` };
                const j: any = await r.json();
                const ans = String(j?.choices?.[0]?.message?.content || "").trim();
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
For EACH platform produce: a short signal read of the engine's answer, what was likely "feeding" it (cite evidence numbers like [1],[2] when used; say "no signal" if the engine had nothing), 3-6 concrete recommended actions to increase the chance the engine will cite the brand, and 2-4 publishable content pieces. Be specific to the platform's known retrieval style (e.g. Perplexity = web-grounded, ChatGPT = training+browse, Copilot = Bing index, Gemini = Google index, Claude = curated training, Grok = X/social, Mistral/DeepSeek = open-web training). Never invent facts.
Return ONLY valid JSON in this exact shape:
{
  "summary": "1-2 sentence overall read in REPORT language",
  "plan": [
    { "platform": "<key>", "current_signal": "...", "feeding_basis": "what the engine appears to be feeding on (cite [n] or 'no signal')", "recommended_actions": ["..."], "feed_strategy": "1-2 sentences on HOW to feed this engine specifically", "content_pieces": ["..."] }
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

          let planRes = await callGateway(lovableKey, "google/gemini-2.5-flash", [
            { role: "system", content: planSys },
            { role: "user", content: planUser },
          ]);
          if (planRes.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
          if (planRes.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
          if (!planRes.ok) {
            console.error("[brand-boost] plan failed", planRes.status, await planRes.text().catch(() => ""));
            return Response.json({ error: "ai_error" }, { status: 500 });
          }
          const planJ: any = await planRes.json();
          const planParsed: any = extractJsonObject(String(planJ?.choices?.[0]?.message?.content || "{}")) || {};
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
            };
          });

          // Track usage
          const { data: cur } = await admin.from("profiles").select("monthly_analyses_used").eq("id", userId).single();
          await admin.from("profiles").update({
            monthly_analyses_used: ((cur as any)?.monthly_analyses_used || 0) + 1,
          }).eq("id", userId);
          await admin.from("activity_log").insert({ user_id: userId, action: "brand_boost", metadata: { brand: brand_name, platforms: targets } });

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
