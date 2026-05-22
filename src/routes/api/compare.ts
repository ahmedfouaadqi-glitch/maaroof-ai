import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getUserContext, specialtyHint } from "@/lib/user-context.server";
import { describeMarket, type GeoScope } from "@/lib/geo-scope.server";
import { fcSearch, fcScrape, isFirecrawlError } from "@/lib/firecrawl";
import { analyzeSeoSge, derivePlatformPresence, deriveStrengthsWeaknesses, type SeoSgeReport } from "@/lib/seo-sge.server";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { probeBrandsPerPlatform, PLATFORMS_8, type BrandEvidenceInput } from "@/lib/platform-probe.server";

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

function liveSearchErrorFrom(errors: unknown[]) {
  const fc = errors.filter(isFirecrawlError);
  if (fc.some((e) => e.status === 402)) return { error: "live_search_credits_exhausted", status: 402 };
  if (fc.some((e) => e.status === 429)) return { error: "live_search_rate_limited", status: 429 };
  if (fc.length > 0) return { error: "live_search_unavailable", status: 503 };
  if (errors.length > 0) return { error: "live_search_unavailable", status: 503 };
  return null;
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

          let chargeUsage: (() => Promise<void>) | null = null;
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
              chargeUsage = async () => { await admin.from("profiles").update({ monthly_analyses_used: (prof!.monthly_analyses_used || 0) + 1 }).eq("id", userId); };
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
              chargeUsage = async () => { await admin.from("user_agent_subscriptions").update({ tasks_used: sub.tasks_used + 1, tasks_used_today: dailyUsed + 1, last_run_date: today }).eq("id", sub.id); };
            }
          }

          const userCtx = await getUserContext(admin, userId);
          const market = describeMarket(body.scope);
          const SYSTEM = buildSystem(market);
          let sources: any[] = [];
          const officialSites: Record<string, { url: string; content: string; status: "confirmed" | "candidate" | "user"; reason: string }> = {};
          const seoSgeReports: Record<string, SeoSgeReport> = {};
          const platformEvidence: Record<string, Record<string, number>> = {};
          const userWebsites = body.websites || {};
          const liveSearchFailures: unknown[] = [];
          try {
            const allBrands = [brand, ...competitors];
            // Multi-signal probe: general/official/reviews/news/geo + per-platform signals
            // (LinkedIn → copilot, X → grok, reddit → perplexity, wiki → claude/chatgpt, etc.)
            const queries = allBrands.flatMap((n) => [
              { brand: n, q: `${n} ${keywords} ${market.region}`.trim(), kind: "general", limit: 5 },
              { brand: n, q: `"${n}" official site OR موقع رسمي OR website`.trim(), kind: "official", limit: 5 },
              { brand: n, q: `"${n}" reviews OR رأي OR تقييم ${market.region}`.trim(), kind: "reviews", limit: 4 },
              { brand: n, q: `"${n}" news ${market.region}`.trim(), kind: "news", limit: 4 },
              { brand: n, q: `"${n}" ${market.region} address OR عنوان OR location`.trim(), kind: "geo", limit: 3 },
              { brand: n, q: `site:linkedin.com "${n}"`, kind: "linkedin", limit: 3 },
              { brand: n, q: `site:x.com OR site:twitter.com "${n}"`, kind: "x", limit: 3 },
              { brand: n, q: `site:reddit.com "${n}"`, kind: "reddit", limit: 3 },
              { brand: n, q: `site:wikipedia.org "${n}"`, kind: "wiki", limit: 2 },
              { brand: n, q: `site:youtube.com "${n}"`, kind: "youtube", limit: 2 },
            ]);
            const settled = await Promise.allSettled(queries.map((x) => fcSearch(x.q, { limit: x.limit, lang })));
            liveSearchFailures.push(...settled.filter((s) => s.status === "rejected").map((s) => (s as PromiseRejectedResult).reason));
            sources = settled.flatMap((s, idx) => {
              if (s.status !== "fulfilled") return [];
              const data: any = (s.value as any)?.data;
              const rows = Array.isArray(data) ? data : [...(data?.web || []), ...(data?.news || [])];
              const q = queries[idx];
              return rows.slice(0, q.limit).map((r: any) => ({
                brand: q.brand,
                kind: q.kind,
                title: r.title,
                url: r.url,
                snippet: (r.markdown || r.description || "").slice(0, 400),
              }));
            }).slice(0, 140);

            const liveSearchError = liveSearchErrorFrom(liveSearchFailures);
            if (liveSearchError && sources.length === 0) {
              return Response.json({ error: liveSearchError.error }, { status: liveSearchError.status });
            }

            // Per-platform evidence counts (real, varying per brand)
            for (const n of allBrands) {
              const ev: Record<string, number> = {};
              const mine = sources.filter((s) => s.brand === n);
              const c = (k: string) => mine.filter((s) => s.kind === k).length;
              ev.news = c("news"); ev.linkedin = c("linkedin"); ev.x = c("x");
              ev.reddit = c("reddit"); ev.wiki = c("wiki"); ev.youtube = c("youtube");
              ev.reviews = c("reviews"); ev.geo = c("geo"); ev.official = c("official"); ev.general = c("general");
              platformEvidence[n] = ev;
            }

            // Official site discovery — RELAXED with scoring + user-URL trust
            const NON_OFFICIAL = /(facebook|instagram|x\.com|twitter|linkedin|youtube|tiktok|wikipedia|wikiwand|yelp|tripadvisor|crunchbase|bloomberg|reuters|aljazeera|alarabiya|cnn|bbc|forbes|pinterest|reddit|medium|maps\.google|goo\.gl|bing\.com|yahoo|amazon\.|noon\.com|souq|opensooq|dubizzle|olx|trustpilot|glassdoor|indeed|google\.com|apple\.com\/store|play\.google)/i;
            const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
            const AR_MAP: Record<string,string> = { "ا":"a","أ":"a","إ":"a","آ":"a","ب":"b","ت":"t","ث":"th","ج":"j","ح":"h","خ":"kh","د":"d","ذ":"d","ر":"r","ز":"z","س":"s","ش":"sh","ص":"s","ض":"d","ط":"t","ظ":"z","ع":"a","غ":"gh","ف":"f","ق":"q","ك":"k","ل":"l","م":"m","ن":"n","ه":"h","و":"w","ي":"y","ى":"a","ء":"","ؤ":"o","ئ":"y","ة":"h"," ":"" };
            const translit = (s: string) => s.split("").map((c) => AR_MAP[c] ?? c).join("").toLowerCase().replace(/[^a-z0-9]/g, "");
            const hostMatches = (host: string, name: string, kwSlug: string) => {
              const root = host.split(".")[0];
              const slugs = [norm(name), translit(name), kwSlug].filter((s) => s && s.length >= 3);
              return slugs.some((slug) => {
                const seg = slug.slice(0, Math.min(5, slug.length));
                return root.includes(seg) || slug.includes(root.slice(0, Math.min(5, root.length)));
              });
            };
            const kwSlug = norm(keywords).slice(0, 12);

            await Promise.all(allBrands.map(async (n) => {
              // 1) Trust user-provided URL fully
              const userUrl = (userWebsites[n] || "").trim();
              if (userUrl) {
                try {
                  const scraped: any = await fcScrape(userUrl, { deep: true });
                  const root = scraped?.data || scraped;
                  const md = String(root?.markdown || "").slice(0, 1500);
                  officialSites[n] = { url: userUrl, content: md, status: "user", reason: "user_provided" };
                  seoSgeReports[n] = analyzeSeoSge({
                    url: userUrl, html: root?.html || "", markdown: root?.markdown || "",
                    links: Array.isArray(root?.links) ? root.links : [], metadata: root?.metadata || {},
                  });
                } catch (e) {
                  officialSites[n] = { url: userUrl, content: "", status: "user", reason: "user_provided_unreachable" };
                }
                return;
              }

              // 2) Score candidates
              type Cand = { url: string; host: string; score: number };
              const cands: Cand[] = [];
              const pool = sources.filter((s) => s.brand === n);
              for (const s of pool) {
                try {
                  const host = new URL(s.url).hostname.replace(/^www\./, "").toLowerCase();
                  if (NON_OFFICIAL.test(host)) continue;
                  let sc = 0;
                  if (s.kind === "official") sc += 5;
                  if (s.kind === "general") sc += 2;
                  if (hostMatches(host, n, kwSlug)) sc += 6;
                  if ((s.title || "").toLowerCase().includes(n.toLowerCase())) sc += 3;
                  if ((s.snippet || "").toLowerCase().includes(n.toLowerCase())) sc += 1;
                  if (sc > 0) cands.push({ url: s.url, host, score: sc });
                } catch {}
              }
              // 3) Fallback dedicated search
              if (cands.length === 0 || Math.max(...cands.map((c) => c.score)) < 4) {
                try {
                  const q = `"${n}" ${keywords} official site OR موقع رسمي ${market.region}`.trim().slice(0, 240);
                  const sr: any = await fcSearch(q, { limit: 6, lang });
                  const rows = (sr?.data?.web || sr?.data || sr?.web || []) as any[];
                  for (const r of rows) {
                    try {
                      const host = new URL(r.url).hostname.replace(/^www\./, "").toLowerCase();
                      if (NON_OFFICIAL.test(host)) continue;
                      let sc = 3;
                      if (hostMatches(host, n, kwSlug)) sc += 6;
                      if ((r.title || "").toLowerCase().includes(n.toLowerCase())) sc += 3;
                      cands.push({ url: r.url, host, score: sc });
                    } catch {}
                  }
                } catch (e) {
                  liveSearchFailures.push(e);
                  console.warn("[api/compare] official lookup failed", n, (e as Error).message);
                }
              }
              if (cands.length === 0) return;
              const byHost = new Map<string, Cand>();
              for (const c of cands) {
                const prev = byHost.get(c.host);
                if (!prev || c.score > prev.score) byHost.set(c.host, c);
              }
              const best = [...byHost.values()].sort((a, b) => b.score - a.score)[0];
              const chosenUrl = best.url;
              try {
                const scraped: any = await fcScrape(chosenUrl, { deep: true });
                const root = scraped?.data || scraped;
                const md = String(root?.markdown || "").slice(0, 1500);
                const title = String(root?.metadata?.title || "").toLowerCase();
                const desc = String(root?.metadata?.description || "").toLowerCase();
                const slugs = [norm(n), translit(n)].filter(Boolean);
                const hostMatchesBrand = hostMatches(best.host, n, kwSlug);
                const pageReferencesBrand = slugs.some((slug) =>
                  title.includes(slug.slice(0, 5)) || desc.includes(slug.slice(0, 5)) ||
                  md.toLowerCase().includes(n.toLowerCase()) || md.toLowerCase().includes(slug)
                );
                // RELAXED: accept on domain match OR page reference OR strong candidate score
                const accept = hostMatchesBrand || pageReferencesBrand || best.score >= 7;
                if (!accept || !md) {
                  console.warn("[api/compare] rejected official candidate", n, chosenUrl, { hostMatchesBrand, pageReferencesBrand, score: best.score });
                  return;
                }
                const status: "confirmed" | "candidate" = (hostMatchesBrand && pageReferencesBrand) ? "confirmed" : "candidate";
                const reason = status === "confirmed" ? "domain_and_page_match"
                  : hostMatchesBrand ? "domain_match_only" : "page_reference_only";
                officialSites[n] = { url: chosenUrl, content: md, status, reason };
                seoSgeReports[n] = analyzeSeoSge({
                  url: chosenUrl, html: root?.html || "", markdown: root?.markdown || "",
                  links: Array.isArray(root?.links) ? root.links : [], metadata: root?.metadata || {},
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
              max_tokens: 4096,
              messages: [
                { role: "system", content: `${SYSTEM}\n\n${LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.en}\n\nمهم جداً: أعد JSON صالحاً فقط دون أي نص قبله أو بعده ودون علامات markdown.` },
                { role: "user", content: prompt },
              ]
            }),
          });

          // Single cheap call (saves credits)
          let resp = await callModel("google/gemini-3-flash-preview");
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

          // Build evidence input per brand for the per-platform probe
          const topSourcesByBrand: Record<string, { kind: string; title: string; url: string }[]> = {};
          for (const s of sources) {
            const key = String(s.brand || "").toLowerCase().trim();
            (topSourcesByBrand[key] ||= []).push({ kind: s.kind || "general", title: s.title || s.url, url: s.url });
          }

          const probeInputs: BrandEvidenceInput[] = allBrandNames.map((n) => {
            const nKey = n.toLowerCase().trim();
            const seo = seoSgeReports[n] || null;
            return {
              name: n,
              hasOfficialSite: !!officialSites[n],
              officialUrl: officialSites[n]?.url || null,
              officialStatus: (officialSites[n]?.status as any) || "missing",
              evidenceByKind: evidenceByKind[nKey] || {},
              totalEvidence: evidenceCount[nKey] || 0,
              topSources: topSourcesByBrand[nKey] || [],
              platformEvidence: platformEvidence[n] || {},
              seoSignals: seo
                ? {
                    seo_score: seo.seo_score,
                    sge_score: seo.sge_score,
                    has_jsonld: seo.signals.has_jsonld,
                    has_org_schema: seo.signals.has_org_schema,
                    has_faq_schema: seo.signals.has_faq_schema,
                    has_article_schema: seo.signals.has_article_schema,
                    has_og: seo.signals.has_og,
                    word_count: seo.signals.word_count,
                    h2_count: seo.signals.h2_count,
                    h3_count: seo.signals.h3_count,
                    external_links: seo.signals.external_links,
                    internal_links: seo.signals.internal_links,
                    has_lang: seo.signals.has_lang,
                  }
                : null,
            };
          });

          // Per-brand, per-platform AI simulation (1 call per brand). Uses the
          // gathered evidence as ground truth — no generic hallucinations.
          let perPlatform: Record<string, Awaited<ReturnType<typeof probeBrandsPerPlatform>>[string]> = {};
          try {
            perPlatform = await probeBrandsPerPlatform(probeInputs, {
              lang: lang as any,
              market: market.region,
              apiKey,
              model: "google/gemini-2.5-flash",
            });
          } catch (e) {
            console.warn("[api/compare] platform probe failed:", e instanceof Error ? e.message : e);
          }

          const normalizedBrands = allBrandNames.map((n) => {
            const found = brands.find((b: any) => String(b?.name || "").toLowerCase().trim() === n.toLowerCase().trim()) || {};
            const nKey = n.toLowerCase().trim();
            const seo = seoSgeReports[n] || null;
            const evRatio = (evidenceCount[nKey] || 0) / totalEv;
            const evScore = Math.round(20 + evRatio * 70);

            // Prefer the per-platform AI probe; fall back to deterministic derivation
            const probe = perPlatform[n];
            const pp = probe?.scores || derivePlatformPresence({
              evidenceByKind: evidenceByKind[nKey] || {},
              totalEvidence: evidenceCount[nKey] || 0,
              seo,
            });

            let vis = clamp(found.visibility_percent);
            let geo = clamp(found.geo_score);
            if (vis === 0) vis = evScore;
            if (geo === 0) geo = Math.max(15, evScore - 10);
            // Blend in measured platform average so visibility reflects probe results
            const ppValues = Object.values(pp);
            if (ppValues.length) {
              const ppAvg = Math.round(ppValues.reduce((a, b) => a + b, 0) / ppValues.length);
              vis = Math.round(vis * 0.5 + ppAvg * 0.5);
            }
            if (seo) {
              vis = Math.round(vis * 0.6 + seo.seo_score * 0.25 + seo.sge_score * 0.15);
              geo = Math.round(geo * 0.5 + seo.seo_score * 0.5);
            }

            return {
              name: n,
              is_main: n === brand,
              visibility_percent: clamp(vis),
              geo_score: clamp(geo),
              sentiment: ["positive", "neutral", "negative"].includes(found.sentiment) ? found.sentiment : "neutral",
              platform_presence: pp,
              platform_reasons: probe?.reasons || {},
              platform_basis: probe?.basis || {},
              strengths: arr(found.strengths, 4),
              weaknesses: arr(found.weaknesses, 4),
            };
          });

          // Mark all 8 as measured for brands where the probe succeeded
          const platformMeasured: Record<string, string[]> = {};
          const platformMeasuredScores: Record<string, { gemini?: number | null; chatgpt?: number | null }> = {};
          for (const b of normalizedBrands) {
            if (perPlatform[b.name]) {
              platformMeasured[b.name] = PLATFORMS_8.filter((p) => perPlatform[b.name]?.basis?.[p] === "measured_simulation");
            }
            platformMeasuredScores[b.name] = {
              gemini: b.platform_presence?.gemini ?? null,
              chatgpt: b.platform_presence?.chatgpt ?? null,
            };
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

            // Confidence + evidence count surfaced to UI
            const ev = evidenceCount[nKey] || 0;
            const hasSeo = !!seoSgeReports[b.name];
            const confidence = (hasSeo && ev >= 5) ? "high" : (hasSeo || ev >= 3) ? "medium" : "low";
            (b as any).evidence_count = ev;
            (b as any).confidence = confidence;
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
            official_site_status: Object.fromEntries(Object.entries(officialSites).map(([k, v]) => [k, { status: v.status, reason: v.reason }])),
            seo_sge: seoSgeReports,
            platform_measured: platformMeasured,
            live_search: {
              ok: sources.length > 0,
              sources_count: sources.length,
              failed_queries: liveSearchFailures.length,
            },
          };

          if (chargeUsage) await chargeUsage();

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
