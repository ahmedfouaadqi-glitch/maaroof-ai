import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthenticatedUserId } from "@/lib/api-auth.server";
import { recordBrandOperation } from "@/lib/brand-operations.server";
import { describeMarket } from "@/lib/geo-scope.server";
import { fcScrape, fcSearch } from "@/lib/firecrawl";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";
import { ENGINE_CATALOG, ENGINE_KEYS, type EngineKey } from "@/lib/ai-engines";
import { applyEntitlement, enginesAllowedForUser, resolveEngineModels, resolveToolModel } from "@/lib/ai-engines.server";


// Engine catalog + engine⇄model mapping now live in the shared source of truth
// (`src/lib/ai-engines.ts` + `ai-engines.server.ts`) so every tool, the UI and
// the admin registry stay in sync. The `proxy` flag records the configured
// connection route only; it does not change the requested engine's identity.
const PLATFORMS = ENGINE_KEYS;
type Platform = EngineKey;
const BRAND_BOOST_COST = 5;


function validPublicWebsiteUrl(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    const host = parsed.hostname.toLowerCase();
    if (!host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null;
    const private172 = host.match(/^172\.(\d+)\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return null;
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

type TokenAcc = { in: number; out: number };
async function callGateway(apiKey: string, model: string, messages: any[], timeoutMs = 30000, acc?: TokenAcc) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: lovableAiHeaders(apiKey),
    body: JSON.stringify({ model, messages }),
      signal: controller.signal,
  });
    // Tap the response stream so the caller can still read it, while we capture usage
    if (r.ok && acc) {
      try {
        const cloned = r.clone();
        const j: any = await cloned.json().catch(() => null);
        const u = j?.usage || {};
        acc.in += Number(u.prompt_tokens) || 0;
        acc.out += Number(u.completion_tokens) || 0;
      } catch {}
    }
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
  const hasObservations = evidence.length > 0 || probes.some((p: any) => Boolean(p.current_answer));
  const evidenceText = evidence.length ? evidence.slice(0, 3).map((e, i) => `[${i + 1}] ${e.title}`).join("، ") : (ar ? "لا توجد أدلة عامة كافية" : ku ? "بەڵگەی گشتی تەواو نییە" : "not enough public evidence");
  return {
    summary: hasObservations ? (ar ? "تعذّر بناء خطة مكتملة؛ هذه خطوات عامة مبنية على الإشارات المتاحة وليست تدقيقاً شاملاً." : ku ? "پلانی تەواو دروست نەکرا؛ ئەمانە هەنگاوی گشتی لەسەر بنەمای نیشانە بەردەستەکانن." : "A complete model plan could not be built; these are general steps informed by available signals, not a full audit.") : (ar ? "لم تتوفر أدلة ويب أو إجابات محركات قابلة للاستخدام. ما يلي إرشادات عامة لجمع البيانات، وليس تشخيصاً لهذه العلامة." : ku ? "بەڵگەی وێب یان وەڵامی بزوێنەر بەردەست نەبوو؛ ئەمانە ڕێنمایی گشتیی کۆکردنەوەی زانیارییە، نەک دەستنیشانکردنی تایبەت." : "No usable public evidence or engine answers were retrieved. These are generic data-collection steps, not a diagnosis of this brand."),
    plan: platforms.map((platform) => {
      const probe = probes.find((p: any) => p.platform === platform);
      return {
        platform,
        current_signal: probe?.current_answer ? (ar ? "إشارة موجودة" : ku ? "نیشان هەیە" : "signal found") : (ar ? "لم تُقَس" : ku ? "پێوانە نەکراوە" : "not measured"),
        feeding_basis: evidenceText,
        recommended_actions: evidence.length ? (ar
          ? ["راجع المعلومات المنشورة على المصدر المرتبط قبل اعتمادها.", "حدّث ملف العلامة بالحقائق التي يدعمها المصدر، وأضف مرجعها داخل الصفحة."]
          : ku
            ? ["زانیارییە بڵاوکراوەکانی سەرچاوەکە بپشکنە پێش پەسەندکردنیان.", "پرۆفایلی براند بە ڕاستییە پشتگیریکراوەکان نوێ بکەرەوە و سەرچاوەیان بنووسە."]
            : ["Review the linked source before accepting its claims.", "Update the brand profile only with source-supported facts and cite the source."]
          ) : [],
        feed_strategy: ar ? "تغذية الويب العام بمحتوى رسمي قصير ومدعوم بروابط." : ku ? "خواردنی وێبی گشتی بە ناوەڕۆکی فەرمی و بە بەستەر." : "Feed the open web with concise official content backed by links.",
        content_pieces: evidence.length ? [ar ? `صفحة موثقة عن ${brand} بالاستناد إلى المصادر المسترجعة` : ku ? `لاپەڕەی پشتبەستوو بە سەرچاوەکان دەربارەی ${brand}` : `Evidence-backed page about ${brand}`] : [],
        injection_pack: evidence.length ? {
          channel: platform === "grok" ? "X / social thread" : "Official website or public article",
          title: ar ? `نبذة موثقة عن ${brand}` : ku ? `پێناسەی پشتڕاستکراوەی ${brand}` : `Verified overview of ${brand}`,
          article_markdown: ar
            ? `## نبذة عن ${brand}\n\n${brand} علامة يجب تعريفها عبر مصادر عامة واضحة. انشر هذه النبذة في الموقع الرسمي مع روابط الأدلة المتاحة${firstUrl ? ` مثل [هذا المصدر](${firstUrl})` : ""}. يجب أن تتضمن الصفحة الاسم، المجال، الموقع الجغرافي، الخدمات، وروابط التواصل الرسمية بدون إضافة ادعاءات غير موثقة.`
            : ku
              ? `## دەربارەی ${brand}\n\n${brand} پێویستی بە پێناسەیەکی ڕوون لە سەرچاوە گشتییەکاندا هەیە${firstUrl ? ` وەک [ئەم سەرچاوەیە](${firstUrl})` : ""}. ناو، بوار، شوێن، خزمەتگوزاری و بەستەرە فەرمییەکان بنووسە، بەبێ زیادکردنی بانگەشەی نەسەلمێنراو.`
              : `## About ${brand}\n\n${brand} should be described through clear public sources${firstUrl ? ` such as [this source](${firstUrl})` : ""}. Publish the name, category, geography, services, and official contact links without adding unsupported claims.`,
          qa_pairs: [{ q: ar ? `ما هي ${brand}؟` : ku ? `${brand} چییە؟` : `What is ${brand}?`, a: ar ? `${brand} علامة تحتاج إلى تعريف عام موثق عبر مصادر رسمية.` : ku ? `${brand} پێویستی بە پێناسەی گشتیی پشتڕاستکراوە هەیە.` : `${brand} is a brand that should be described through verified public sources.` }],
          json_ld: JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", name: brand }, null, 2),
        } : null,
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

          // Browser requests use bearer tokens; long-running server dispatch uses a signed, route-bound identity.
          const userId = await resolveAuthenticatedUserId(request, admin);
          if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });
          const body = await request.json().catch(() => ({} as any));
          const workspaceRaw = typeof body?.workspace_id === "string" ? body.workspace_id.trim() : "";
          if (workspaceRaw && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceRaw)) {
            return Response.json({ error: "invalid_workspace" }, { status: 400 });
          }
          const workspaceId = workspaceRaw || null;
          if (workspaceId) {
            const { data: ownedWorkspace } = await admin.from("workspaces").select("id").eq("id", workspaceId).eq("owner_id", userId).maybeSingle();
            if (!ownedWorkspace) return Response.json({ error: "workspace_not_found" }, { status: 404 });
          }

          const _runId = crypto.randomUUID();
          const _t0 = Date.now();
          const _chg = await chargeTokens({ userId, toolKey: "brand_boost", runId: _runId, meta: { provider: "lovable_ai", model: "openai/gpt-5-mini", endpoint: "/api/brand-boost", workspace_id: workspaceId } });
          if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });

          const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
          if (!prof) return Response.json({ error: "auth_required" }, { status: 401 });
          // Per-user super-admin toggle for Brand Boost: quota_overrides.brand_boost = "on" | "off" | undefined
          const bbToggle = String((prof as any)?.quota_overrides?.brand_boost || "").toLowerCase();
          if (bbToggle === "off") {
            return Response.json({ error: "tool_disabled_by_admin" }, { status: 403 });
          }
          // Access is decided by chargeTokens (plan + wallet + per-user overrides); the legacy monthly-subscription gate was removed.

          const { brand_name, brand_keywords, platforms = PLATFORMS, lang = "en", scope } = body;
          const websiteUrl = body?.website_url ? validPublicWebsiteUrl(body.website_url) : null;
          if (body?.website_url && !websiteUrl) return Response.json({ error: "invalid_public_website_url" }, { status: 400 });
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
          let evidence: { title: string; url: string; snippet: string; source_type?: string }[] = [];
          const websiteScan = { requested: Boolean(websiteUrl), url: websiteUrl, status: websiteUrl ? "pending" : "not_provided", characters_read: 0, error: null as string | null };
          const seenEvidenceUrls = new Set<string>();
          // Crawl the customer's declared official website first. Search snippets alone are not a website audit.
          if (websiteUrl) {
            try {
              const crawled: any = await fcScrape(websiteUrl, { deep: false });
              const markdown = String(crawled?.data?.markdown || crawled?.markdown || "");
              if (markdown.trim()) {
                evidence.push({
                  title: String(crawled?.data?.metadata?.title || crawled?.metadata?.title || websiteUrl).slice(0, 160),
                  url: websiteUrl,
                  snippet: markdown.slice(0, 1400),
                  source_type: "direct_website_crawl",
                });
                seenEvidenceUrls.add(websiteUrl);
                websiteScan.status = "completed";
                websiteScan.characters_read = markdown.length;
              } else {
                websiteScan.status = "no_content";
                websiteScan.error = "empty_crawl_result";
              }
            } catch (e: any) {
              websiteScan.status = "failed";
              websiteScan.error = String(e?.message || "website_crawl_failed").slice(0, 180);
              console.warn("[brand-boost] official website scrape failed", websiteScan.error);
            }
          }
          try {
            const queries = [
              `${brand_name} ${brand_keywords || ""} ${market.region}`.trim(),
              `"${brand_name}" reviews OR about OR official ${market.region}`.trim(),
            ];
            for (const q of queries) {
              try {
                const sr: any = await fcSearch(q, { limit: 6, lang });
                const results = sr?.data?.web || sr?.web || sr?.data || [];
                for (const r of (Array.isArray(results) ? results : [])) {
                  const url = String(r?.url || "");
                  if (!/^https?:\/\//i.test(url) || seenEvidenceUrls.has(url)) continue;
                  seenEvidenceUrls.add(url);
                  evidence.push({
                    title: String(r?.title || url).slice(0, 160),
                    url,
                    snippet: String(r?.description || r?.markdown || "").slice(0, 500),
                    source_type: "public_search_result",
                  });
                  if (evidence.length >= 10) break;
                }
              } catch {}
              if (evidence.length >= 10) break;
            }
          } catch (e) {
            console.warn("[brand-boost] firecrawl search failed", e);
          }
          const evidenceBlock = evidence.length
            ? evidence.map((e, i) => `[${i + 1}] ${e.title}\n${e.url}\n${e.snippet}`).join("\n\n")
            : "(no public evidence retrieved)";

          // ── Step 2: probe each selected engine with its governed model
          // Admin may restrict the engine set globally; the user's plan caps how
          // many of the ten engines a single run may probe (MARK 1/2/3 = 3/6/10).
          const adminAllowed: Platform[] | null = Array.isArray(adminCfg.enabled_platforms) && adminCfg.enabled_platforms.length
            ? (adminCfg.enabled_platforms as string[]).filter((p) => (PLATFORMS as readonly string[]).includes(p)) as Platform[]
            : null;
          const entitlement = await enginesAllowedForUser(admin, userId);
          const requested = applyEntitlement(platforms, entitlement);
          const picked = adminAllowed ? requested.filter((p) => adminAllowed.includes(p)) : requested;
          if (!picked.length) return Response.json({ error: "no_platforms_enabled" }, { status: 400 });
          // A provider that is currently failing is skipped instead of failing
          // the whole run; the reason travels back in the response.
          const { excludeUnhealthyEngines } = await import("@/lib/ai-engines.server");
          const healthFilter = await excludeUnhealthyEngines(picked as EngineKey[]);
          const targets = healthFilter.engines as Platform[];
          const engineModels = await resolveEngineModels(targets, "final");
          const probeSys = String(adminCfg.probe_system || `You are responding through Maaroof's configured integration for the requested engine. Answer only from the knowledge and retrieval context actually available to this runtime. Do not impersonate another engine. ${FACTUAL_SAFETY_PROMPT}
If you have no reliable public knowledge, say so explicitly. Reply in ${langName}. Keep under 120 words.`);
          const probeUserTpl = String(adminCfg.probe_prompt || `What do you know about the brand "{brand}"{keywords} in the context of {market}? Mention concrete facts only.`);
          const probeUser = probeUserTpl
            .replace("{brand}", brand_name)
            .replace("{keywords}", brand_keywords ? ` (topics: ${brand_keywords})` : "")
            .replace("{market}", market.region);

          const _tokAcc: TokenAcc = { in: 0, out: 0 };
          const probes = await Promise.all(
            targets.map(async (p) => {
              const resolved = engineModels[p];
              const cfg = { model: resolved?.model || ENGINE_CATALOG[p].defaultModel, proxy: ENGINE_CATALOG[p].proxy };

              try {
                const r = await callGateway(lovableKey, cfg.model, [
                  { role: "system", content: probeSys },
                  { role: "user", content: probeUser },
                ], 12000, _tokAcc);
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
For EACH platform produce: a short signal read of the engine's answer, what was likely "feeding" it (cite evidence numbers like [1],[2]; say "no signal" if the engine had nothing), 3-6 recommended actions, 2-4 publishable content pieces, AND a ready-to-publish "injection_pack" tailored to how that engine is fed. The injection_pack must be real copy-paste-ready text — not placeholders. Do not assert undocumented or proprietary retrieval/indexing/training mechanisms for any engine. Tailor actions only to observed responses and the evidence supplied. Every company-specific factual recommendation must cite evidence indexes such as [1] or be explicitly labeled as a hypothesis requiring verification. If direct website evidence is absent, state that limitation. Never invent facts.
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
          const _planT0 = Date.now();
          const planModel = await resolveToolModel("google/gemini-2.5-flash", "planning");
          try {
            const planRes = await callGateway(lovableKey, planModel, [
              { role: "system", content: planSys },
              { role: "user", content: planUser },
            ], 18000, _tokAcc);
            if (planRes.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
            if (planRes.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
            const planText = planRes.ok ? await readGatewayMessage(planRes) : { content: "", error: await planRes.text().catch(() => `http_${planRes.status}`) };
            if (!planRes.ok) console.error("[brand-boost] plan failed", planRes.status, planText.error);
            planParsed = extractJsonObject(String(planText.content || "{}")) || {};
          } catch (e) {
            console.error("[brand-boost] plan timeout/fallback", e);
          }
          // Enrich ledger with real provider USD cost (sum across all gateway calls)
          try {
            const { enrichLedger: _el } = await import("@/lib/spend.server");
            await _el({
              runId: _runId, provider: "lovable_ai", model: planModel, endpoint: "/api/brand-boost",
              inputTokens: _tokAcc.in, outputTokens: _tokAcc.out, latencyMs: Date.now() - _planT0,
            });
          } catch {}

          const usedFallbackPlan = !Array.isArray(planParsed.plan);
          if (usedFallbackPlan) planParsed = fallbackPlan(targets, lang, brand_name, evidence, probes);
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
              recommendation_assessments: (Array.isArray(pl.recommended_actions) ? pl.recommended_actions : []).map((action: unknown) => {
                const actionText = String(action || "");
                const cited = Array.from(actionText.matchAll(/\[(\d+)\]/g)).map((match) => Number(match[1]));
                const validRefs = Array.from(new Set(cited.filter((index) => index >= 1 && index <= evidence.length)));
                return {
                  action: actionText,
                  confidence: validRefs.length ? "evidence_referenced" : "requires_verification",
                  evidence_refs: validRefs,
                };
              }),
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
          await recordBrandOperation(admin, {
            id: _runId,
            userId,
            workspaceId,
            operationType: "brand_boost",
            brandName: String(brand_name),
            durationMs: Date.now() - _t0,
            chargedUnits: BRAND_BOOST_COST,
            requestMeta: { engines: targets, connection_modes: Object.fromEntries(merged.map((p: any) => [p.platform, p.is_proxy ? "proxy" : "direct"])) },
            resultMeta: {
              evidence_count: evidence.length,
              website_scan: websiteScan,
              analysis_status: websiteScan.status === "completed" ? "direct_website_crawled" : evidence.length ? "public_search_evidence_only" : "insufficient_evidence",
              plan_source: usedFallbackPlan ? "deterministic_fallback" : "model_plan",
              evidence_urls: evidence.map((item: any) => String(item.url || "")).filter((url: string) => /^https?:\/\//i.test(url)).slice(0, 30),
              engine_responses: merged.filter((p: any) => Boolean(p.current_answer)).length,
              recommended_actions: merged.reduce((n: number, p: any) => n + (p.recommended_actions?.length || 0), 0),
              recommendations_requiring_verification: merged.reduce((n: number, p: any) => n + (p.recommendation_assessments || []).filter((a: any) => a.confidence === "requires_verification").length, 0),
              content_pieces: merged.reduce((n: number, p: any) => n + (p.content_pieces?.length || 0), 0),
              platform_results: merged.map((p: any) => ({
                platform: p.platform,
                answered: Boolean(p.current_answer),
                current_signal: p.current_signal,
                recommended_actions: p.recommended_actions?.length || 0,
                content_pieces: p.content_pieces?.length || 0,
              })),
              summary: String(planParsed.summary || "").slice(0, 500),
            },
          });
          await admin.from("activity_log").insert({ user_id: userId, action: "brand_boost", metadata: {
            operation_id: _runId,
            workspace_id: workspaceId,
            brand: brand_name,
            platforms: targets,
            connection_modes: Object.fromEntries(merged.map((p: any) => [p.platform, p.is_proxy ? "proxy" : "direct"])),
            cost: BRAND_BOOST_COST,
            duration_ms: Date.now() - _t0,
          } });

          const answeredEngines = merged.filter((p: any) => Boolean(p.current_answer) && !p.probe_error).length;
          const analysisStatus = websiteScan.status === "completed"
            ? "direct_website_crawled"
            : evidence.length > 0
              ? "public_search_evidence_only"
              : answeredEngines > 0
                ? "engine_observations_only"
                : "insufficient_evidence";
          return Response.json({
            operation_id: _runId,
            summary: planParsed.summary || "",
            analysis_status: analysisStatus,
            analysis_limitations: [
              websiteScan.status === "not_provided" ? "No official website URL was provided; no direct website crawl was performed." : null,
              websiteScan.status === "failed" || websiteScan.status === "no_content" ? "The official website crawl did not return usable page content." : null,
              evidence.length === 0 ? "No public web evidence was retrieved in this run." : null,
              answeredEngines === 0 ? "No configured engine returned a usable answer." : null,
              "Configured model responses are observations from Maaroof integrations, not proof of what every public consumer app displays to all users.",
            ].filter(Boolean),
            website_scan: websiteScan,
            evidence,
            plan_source: usedFallbackPlan ? "deterministic_fallback" : "model_plan",
            plan: merged,
            engines: {
              plan: entitlement.plan,
              limit: entitlement.limit,
              allowed: entitlement.allowed,
              locked: entitlement.locked,
              used: targets,
              excluded_unhealthy: healthFilter.excluded,
            },
          });

        } catch (e) {
          console.error("[api/brand-boost] failed", e);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
