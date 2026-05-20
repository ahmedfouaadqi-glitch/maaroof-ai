import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getUserContext, specialtyHint } from "@/lib/user-context.server";
import { describeMarket, type GeoScope } from "@/lib/geo-scope.server";
import { fcSearch, fcScrape } from "@/lib/firecrawl";
import { analyzeSeoSge, derivePlatformPresence, deriveStrengthsWeaknesses, type SeoSgeReport } from "@/lib/seo-sge.server";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { probeAllPlatformsBatch, PLATFORMS_8 } from "@/lib/platform-probe.server";

type Body = { brand?: string; competitors?: string[]; keywords?: string; lang?: "en" | "ar" | "ku"; scope?: GeoScope; websites?: Record<string, string> };

const LANG_INSTRUCTION: Record<string, string> = {
  ar: "اكتب جميع القيم النصية داخل JSON باللغة العربية الفصحى.",
  en: "Write all string values inside the JSON in clear English.",
  ku: "هەموو بەهای دەقی ناو JSON ـەکە بە کوردی سۆرانی بنووسە.",
};

const buildSystem = (m: ReturnType<typeof describeMarket>) => `${FACTUAL_SAFETY_PROMPT}

أنت محلل GEO خبير. ستُعطى علامة تجارية رئيسية و حتى 4 منافسين والسوق المستهدف هو: ${m.region} (${m.market}).
السياق المحلي: ${m.contextHint}
قيّم كل علامة بشكل واقعي ومتحفّظ اعتماداً على المصادر المرفقة فقط. إذا لم تجد دليلاً لعلامة معينة، أعطها درجة منخفضة واكتب أن الإشارات العامة غير متوفرة.
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
          let sources: any[] = [];
          const officialSites: Record<string, { url: string; content: string }> = {};
          const seoSgeReports: Record<string, SeoSgeReport> = {};
          const userWebsites = body.websites || {};
          try {
            const allBrands = [brand, ...competitors];
            // Multi-signal probe: general, official site, reviews, news, geo presence
            const queries = allBrands.flatMap((n) => [
              { brand: n, q: `${n} ${keywords} ${market.region}`.trim(), kind: "general" },
              { brand: n, q: `"${n}" official site OR موقع رسمي OR website`.trim(), kind: "official" },
              { brand: n, q: `"${n}" reviews OR رأي OR تقييم ${market.region}`.trim(), kind: "reviews" },
              { brand: n, q: `"${n}" news ${market.region}`.trim(), kind: "news" },
              { brand: n, q: `"${n}" ${market.region} address OR عنوان OR location`.trim(), kind: "geo" },
            ]);
            const settled = await Promise.allSettled(queries.map((x) => fcSearch(x.q, { limit: 5, lang })));
            sources = settled.flatMap((s, idx) => {
              if (s.status !== "fulfilled") return [];
              const data: any = (s.value as any)?.data;
              const rows = Array.isArray(data) ? data : [...(data?.web || []), ...(data?.news || [])];
              return rows.slice(0, 5).map((r: any) => ({
                brand: queries[idx].brand,
                kind: queries[idx].kind,
                title: r.title,
                url: r.url,
                snippet: (r.markdown || r.description || "").slice(0, 400),
              }));
            }).slice(0, 60);

            // Auto-detect or use user-provided official website per brand, then DEEP scrape for SEO/SGE
            const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
            await Promise.all(allBrands.map(async (n) => {
              const nNorm = norm(n);
              let chosenUrl: string | null = (userWebsites[n] || "").trim() || null;
              if (!chosenUrl && nNorm) {
                const candidates = sources.filter((s) => s.brand === n);
                const found = candidates.find((s) => {
                  try {
                    const host = new URL(s.url).hostname.replace(/^www\./, "").toLowerCase();
                    const root = host.split(".")[0];
                    return root.includes(nNorm.slice(0, Math.min(6, nNorm.length))) || nNorm.includes(root);
                  } catch { return false; }
                });
                chosenUrl = found?.url || null;
              }
              if (!chosenUrl) return;
              try {
                const scraped: any = await fcScrape(chosenUrl, { deep: true });
                const root = scraped?.data || scraped;
                const md = String(root?.markdown || "").slice(0, 1500);
                if (md) officialSites[n] = { url: chosenUrl, content: md };
                seoSgeReports[n] = analyzeSeoSge({
                  url: chosenUrl,
                  html: root?.html || "",
                  markdown: root?.markdown || "",
                  links: Array.isArray(root?.links) ? root.links : [],
                  metadata: root?.metadata || {},
                });
              } catch (e) {
                console.warn("[api/compare] scrape failed for", n, chosenUrl, e instanceof Error ? e.message : e);
              }
            }));
          } catch (e) {
            console.warn("[api/compare] sources gather failed:", e instanceof Error ? e.message : e);
          }

          const sourceBlock = sources.map((s, i) => `[${i + 1}] (${s.kind || "general"}) ${s.brand}: ${s.title} (${s.url})\n${s.snippet}`).join("\n\n") || "(no live sources available)";
          const officialBlock = Object.entries(officialSites)
            .map(([n, o]) => `=== Official site of ${n} (${o.url}) ===\n${o.content}`)
            .join("\n\n") || "(no official sites verified)";
          const prompt = `العلامة الرئيسية: ${brand}\nالمنافسون: ${competitors.join(" / ")}\nالكلمات المفتاحية / المجال: ${keywords || "(غير محدد)"}\nالسوق المستهدف: ${market.region}\nقيّم جميع العلامات (الرئيسية + المنافسين) اعتماداً على المصادر أدناه فقط (محتوى الموقع الرسمي ونتائج البحث). لا تستخدم معرفة غير موثقة. استنتج platform_presence بشكل محافظ من قوة الأدلة المتاحة لكل محرك، وليس كحقيقة مؤكدة.${specialtyHint(userCtx, lang as any)}\n\nOfficial site content:\n${officialBlock}\n\nSearch sources:\n${sourceBlock}`;


          const callModel = async (model: string) => fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: lovableAiHeaders(apiKey),
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: `${SYSTEM}\n\n${LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.en}\n\nمهم جداً: أعد JSON صالحاً فقط دون أي نص قبله أو بعده ودون علامات markdown.` },
                { role: "user", content: prompt },
              ]
            }),
          });

          // Single cheap call (saves credits)
          let resp = await callModel("google/gemini-2.5-flash");
          if (resp.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
          if (resp.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
          if (!resp.ok) {
            const txt = await resp.text();
            console.error("[api/compare] AI error", resp.status, txt);
            return Response.json({ error: `ai_${resp.status}` }, { status: 500 });
          }

          let data = await resp.json();
          let content = String(data?.choices?.[0]?.message?.content || "{}");
          let parsed: any = extractJsonObject(content) || {};

          // (no retry — save credits; deterministic layers will fill the gaps)

          const PLATFORMS = ["chatgpt","gemini","claude","perplexity","copilot","grok","mistral","deepseek"] as const;
          const allBrandNames = [brand, ...competitors];
          const brands = Array.isArray(parsed.brands) ? parsed.brands.slice(0, 5) : [];

          // Per-brand evidence counts by kind
          const evidenceCount: Record<string, number> = {};
          const evidenceByKind: Record<string, Record<string, number>> = {};
          for (const s of sources) {
            const k = String(s.brand || "").toLowerCase().trim();
            evidenceCount[k] = (evidenceCount[k] || 0) + 1;
            const kind = String(s.kind || "general");
            evidenceByKind[k] = evidenceByKind[k] || {};
            evidenceByKind[k][kind] = (evidenceByKind[k][kind] || 0) + 1;
          }
          const totalEv = Math.max(1, sources.length);

          const normalizedBrands = allBrandNames.map((n) => {
            const found = brands.find((b: any) => String(b?.name || "").toLowerCase().trim() === n.toLowerCase().trim()) || {};
            const nKey = n.toLowerCase().trim();
            const seo = seoSgeReports[n] || null;
            const evRatio = (evidenceCount[nKey] || 0) / totalEv; // 0..1
            const evScore = Math.round(20 + evRatio * 70); // 20..90 floor based on share of evidence

            // REAL signal-driven platform presence (overrides model estimate)
            const pp = derivePlatformPresence({
              evidenceByKind: evidenceByKind[nKey] || {},
              totalEvidence: evidenceCount[nKey] || 0,
              seo,
            });

            let vis = clamp(found.visibility_percent);
            let geo = clamp(found.geo_score);
            if (vis === 0) vis = evScore;
            if (geo === 0) geo = Math.max(15, evScore - 10);
            // If we have a real SEO report, blend it into visibility (signals matter more than model)
            if (seo) {
              vis = Math.round(vis * 0.4 + seo.seo_score * 0.4 + seo.sge_score * 0.2);
              geo = Math.round(geo * 0.5 + seo.seo_score * 0.5);
            }

            return {
              name: n,
              is_main: n === brand,
              visibility_percent: clamp(vis),
              geo_score: clamp(geo),
              sentiment: ["positive", "neutral", "negative"].includes(found.sentiment) ? found.sentiment : "neutral",
              platform_presence: pp,
              strengths: arr(found.strengths, 4),
              weaknesses: arr(found.weaknesses, 4),
            };
          });

          // Layer B: ONE batched AI call grading all 8 platforms for all brands
          const platformMeasured: Record<string, string[]> = {};
          const platformMeasuredScores: Record<string, { gemini?: number | null; chatgpt?: number | null }> = {};
          try {
            const batchInput = normalizedBrands.map((b) => {
              const k = b.name.toLowerCase().trim();
              return {
                name: b.name,
                hasOfficialSite: !!officialSites[b.name],
                evidenceByKind: evidenceByKind[k] || {},
                totalEvidence: evidenceCount[k] || 0,
              };
            });
            const probed = await probeAllPlatformsBatch(batchInput, lang as any, market.region, apiKey);
            if (probed) {
              for (const b of normalizedBrands) {
                const scores = probed[b.name];
                if (!scores) continue;
                const measured: string[] = [];
                for (const p of PLATFORMS_8) {
                  (b.platform_presence as any)[p] = scores[p];
                  measured.push(p);
                }
                if (measured.length) platformMeasured[b.name] = measured;
                platformMeasuredScores[b.name] = { gemini: scores.gemini, chatgpt: scores.chatgpt };
              }
            }
          } catch (e) {
            console.warn("[api/compare] platform probe failed:", e instanceof Error ? e.message : e);
          }

          // Layer C: strengths/weaknesses from REAL signals — always populate
          for (const b of normalizedBrands) {
            const nKey = b.name.toLowerCase().trim();
            const sw = deriveStrengthsWeaknesses({
              seo: seoSgeReports[b.name] || null,
              evidenceByKind: evidenceByKind[nKey] || {},
              totalEvidence: evidenceCount[nKey] || 0,
              hasOfficialSite: !!officialSites[b.name],
              platformMeasured: platformMeasuredScores[b.name] || {},
            });
            // Merge: prefer derived, fill gaps with model output
            const modelS = arr((b as any).strengths, 4);
            const modelW = arr((b as any).weaknesses, 4);
            b.strengths = sw.strengths.length > 0 ? sw.strengths : modelS;
            b.weaknesses = sw.weaknesses.length > 0 ? sw.weaknesses : modelW;
            // Guaranteed baselines so the UI is never empty
            if (b.strengths.length === 0) {
              b.strengths = officialSites[b.name]
                ? ["sw_strong_official_site"]
                : ["sw_strong_brand_listed"];
            }
            if (b.weaknesses.length === 0) {
              const fallback: string[] = [];
              if (!officialSites[b.name]) fallback.push("sw_weak_no_official_site");
              if ((evidenceCount[nKey] || 0) === 0) fallback.push("sw_weak_no_evidence");
              if (fallback.length === 0) fallback.push("sw_weak_limited_signals");
              b.weaknesses = fallback;
            }
          }


          const ranked = [...normalizedBrands]
            .map((b) => ({ ...b, _composite: b.visibility_percent * 0.6 + b.geo_score * 0.4 }))
            .sort((a, b) => b._composite - a._composite)
            .map((b, i) => ({ ...b, rank: i + 1 }));

          // Always derive winner from ranking — model's winner field is unreliable
          const top = ranked[0];
          const winner = top?.name || brand;
          const modelReason = String(parsed.winner_reason || "").trim();
          const badReason = !modelReason || /لا يمكن|لم يتم|غير محدد|unknown|undetermined|cannot|n\/a/i.test(modelReason);
          const winnerReason = badReason
            ? (lang === "ar"
                ? `${winner} يتصدّر بظهور ${top?.visibility_percent}% ودرجة GEO ${top?.geo_score}/100 استناداً إلى الأدلة المتاحة.`
                : lang === "ku"
                ? `${winner} پێشەنگە بە دەرکەوتنی ${top?.visibility_percent}% و GEO ${top?.geo_score}/100.`
                : `${winner} leads with ${top?.visibility_percent}% visibility and ${top?.geo_score}/100 GEO score.`)
            : modelReason.slice(0, 320);


          const result = {
            brands: ranked.map(({ _composite, ...rest }) => rest),
            winner,
            winner_reason: winnerReason,
            overview: String(parsed.overview || "").slice(0, 600),
            content_gaps: arr(parsed.content_gaps, 6),
            recommendations: arr(parsed.recommendations, 6),
            specialty: userCtx.specialty,
            sources,
            official_sites: Object.fromEntries(Object.entries(officialSites).map(([k, v]) => [k, v.url])),
            seo_sge: seoSgeReports,
            platform_measured: platformMeasured,
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
