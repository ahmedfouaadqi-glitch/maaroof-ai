import { normalizeEngines, ENGINE_KEYS } from "@/lib/ai-engines";
import { mciReuse, mciStore } from "@/lib/mci/resolver.server";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { describeMarket, type GeoScope } from "@/lib/geo-scope.server";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";
import { qualityShell, buildEvidencePack, pickQualityFields } from "@/lib/tool-quality.server";
import { resolveToolModel, enginesAllowedForUser, applyEntitlement, resolveEngineModels } from "@/lib/ai-engines.server";
import { ENGINE_PERSONA } from "@/lib/ai-engines";
import { asText } from "@/lib/input-coerce";
import { buildVisibilityQueries } from "@/lib/maaroof/visibility-intelligence-adapters";
import { calculateVisibilityQueryPackMetrics } from "@/lib/maaroof/visibility-query-pack-metrics";
import { calculateVisibilityProbeMetrics } from "@/lib/maaroof/visibility-metrics";
import { deriveOfficialSiteCategory } from "@/lib/maaroof/website-category";
import { normalizeOfficialWebsite } from "@/lib/maaroof/official-website";
import { settleTokenRefund } from "@/lib/maaroof/token-refund";


type Body = { brand?: string; official_website?: string; keywords?: string; lang?: "en" | "ar" | "ku"; scope?: GeoScope; probe_engines?: string[]; notify?: boolean; background?: boolean; workspace_id?: string | null };

const LANG_INSTRUCTION: Record<string, string> = {
  ar: "اكتب جميع القيم النصية داخل JSON باللغة العربية الفصحى.",
  en: "Write all string values inside the JSON in clear English.",
  ku: "هەموو بەهای دەقی ناو JSON ـەکە بە کوردی سۆرانی بنووسە.",
};

const buildSystem = (m: ReturnType<typeof describeMarket>) => `${FACTUAL_SAFETY_PROMPT}

You are a STRICT, evidence-based AI Visibility analyst for ${m.market}.
Your job: estimate how likely each major AI engine (ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek, Kimi, Qwen) is to mention or cite this brand when answering queries from ${m.audience} — and explain HOW each engine evaluates trust/citation differently.

LOCALIZATION CONTEXT for this run: ${m.contextHint}

Be conservative. If signals are weak or unknown, return low scores and say so. NEVER fabricate facts, numbers, awards, or partnerships. When you have no evidence, say "no public signals detected" instead of inventing facts.

Assess each engine independently from the response and the evidence available for this run. Do not invent, assume, or generalize undocumented retrieval/indexing mechanisms. Only name a specific retrieval or citation mechanism when it is directly supported by evidence for this run; otherwise use "not established by this probe". Do not describe a proxy route as simulation or as another engine.
Use the following engine names only as identification labels. Do not infer each engine's proprietary retrieval stack, index source, freshness weighting, or citation policy from its brand name. Derive all findings from the actual output and evidence collected in this run.

Return ONLY valid JSON in this exact shape:
{
  "visibility_percent": <0-100, arithmetic mean of the ten engine score estimates>,
  "confidence": "high" | "medium" | "low",
  "sentiment": "positive" | "neutral" | "negative",
  "appearance_summary": "1-2 sentence summary in REPORT language",
  "strengths": ["concrete observation", "..."],
  "weaknesses": ["concrete missing element", "..."],
  "competitors": ["likely competitor names mentioned together with this brand", "..."],
  "recommendations": ["specific actionable improvement, prioritized", "..."],
  "platforms": [
    {
      "name": "ChatGPT",
      "score": <0-100>,
      "citation_likelihood": "high" | "medium" | "low",
      "citation_method": "short label naming the mechanism (e.g. 'training_corpus + web_search')",
      "evidence_basis": "what THIS engine relies on for THIS brand (e.g. 'no Wikipedia article; few news mentions; weak backlinks')",
      "authority_factors": ["short factor 1 affecting trust on this engine", "factor 2", "factor 3"],
      "trust_signal": "short label e.g. 'Limited training data presence'",
      "freshness_weight": "high" | "medium" | "low",
      "why": "1-2 sentences in REPORT language explaining HOW this engine sees the brand and WHY this score",
      "action": "single most impactful next step for THIS engine in REPORT language",
      "priority": "high" | "medium" | "low"
    },
    { "name": "Gemini", ... },
    { "name": "Claude", ... },
    { "name": "Perplexity", ... },
    { "name": "Copilot", ... },
    { "name": "Grok", ... },
    { "name": "Mistral", ... },
    { "name": "DeepSeek", ... },
    { "name": "Kimi", ... },
    { "name": "Qwen", ... }
  ]
}
visibility_percent MUST be the arithmetic mean of all 10 platform scores (rounded), and must be treated as a model estimate rather than an independently verified visibility measurement. All text fields MUST be in REPORT language.`;

function clamp(n: unknown) {
  const value = Number.parseInt(String(n ?? 0), 10);
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function toArray(value: unknown, max = 6) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, max)
    .map((item) => item.slice(0, 220));
}

function normalizePlatforms(value: unknown): Array<any> {
  const NAMES = ["ChatGPT", "Gemini", "Claude", "Perplexity", "Copilot", "Grok", "Mistral", "DeepSeek", "Kimi", "Qwen"];
  const arr = Array.isArray(value) ? value : [];
  const byName = new Map<string, any>();
  for (const item of arr) {
    if (item && typeof item === "object") {
      const name = String((item as any).name || "").trim();
      if (name) byName.set(name, item);
    }
  }
  const enumOrDefault = (v: any, vals: string[], d: string) => (vals.includes(v) ? v : d);
  return NAMES.map((name) => {
    const p: any = byName.get(name) || {};
    const factors = Array.isArray(p.authority_factors)
      ? p.authority_factors.slice(0, 4).map((x: any) => String(x ?? "").slice(0, 90)).filter(Boolean)
      : [];
    return {
      name,
      score: clamp(p.score),
      citation_likelihood: enumOrDefault(p.citation_likelihood, ["high", "medium", "low"], "low"),
      citation_method: String(p.citation_method || "").trim().slice(0, 100),
      evidence_basis: String(p.evidence_basis || "").trim().slice(0, 240),
      authority_factors: factors,
      trust_signal: String(p.trust_signal || "").trim().slice(0, 120),
      freshness_weight: enumOrDefault(p.freshness_weight, ["high", "medium", "low"], "medium"),
      why: String(p.why || "").trim().slice(0, 360),
      action: String(p.action || "").trim().slice(0, 220),
      priority: enumOrDefault(p.priority, ["high", "medium", "low"], "medium"),
    };
  });
}

function normalizeResult(parsed: any, fallbackText = "") {
  const sentiment = ["positive", "neutral", "negative"].includes(parsed?.sentiment)
    ? parsed.sentiment
    : "neutral";

  const platforms = normalizePlatforms(parsed?.platforms);
  const platformAvg = platforms.length
    ? Math.round(platforms.reduce((s, p) => s + (p.score || 0), 0) / platforms.length)
    : clamp(parsed?.visibility_percent);
  const visibility_percent = platformAvg;

  const confidence = ["high", "medium", "low"].includes(parsed?.confidence) ? parsed.confidence : "medium";

  return {
    visibility_percent,
    visibility_score_basis: "arithmetic_mean_of_10_model_estimates",
    confidence,
    sentiment,
    appearance_summary: String(parsed?.appearance_summary || fallbackText || "").trim().slice(0, 500),
    strengths: toArray(parsed?.strengths, 6),
    weaknesses: toArray(parsed?.weaknesses, 6),
    competitors: toArray(parsed?.competitors, 6),
    recommendations: toArray(parsed?.recommendations, 8),
    platforms,
  };
}

export const Route = createFileRoute("/api/visibility")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const brand = asText(body.brand, 200);
          const keywords = asText(body.keywords, 400);
          let officialWebsite = asText(body.official_website, 500);
          const requestedLanguage = (body as any).lang;
          if (requestedLanguage != null && !["ar", "en", "ku"].includes(requestedLanguage)) {
            return Response.json({ error: "unsupported_audience_language", supported: ["ar", "en", "ku"] }, { status: 400 });
          }
          const lang = requestedLanguage === "ar" || requestedLanguage === "ku" ? requestedLanguage : "en";

          if (brand.length < 2) {
            return Response.json({ error: "brand_required" }, { status: 400 });
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!apiKey || !SUPABASE_URL || !SERVICE) {
            return Response.json({ error: "server_not_configured" }, { status: 500 });
          }

          const admin = createClient(SUPABASE_URL, SERVICE);
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) {
            return Response.json({ error: "auth_required" }, { status: 401 });
          }

          const token = auth.slice(7);
          const { data: authData } = await admin.auth.getUser(token);
          const userId = authData.user?.id as string;
          if (!userId) {
            return Response.json({ error: "auth_required" }, { status: 401 });
          }

          const workspaceRaw = body.workspace_id;
          if (workspaceRaw != null && workspaceRaw !== "" && (typeof workspaceRaw !== "string" || !/^[0-9a-f-]{36}$/i.test(workspaceRaw))) {
            return Response.json({ error: "invalid_workspace" }, { status: 400 });
          }
          const workspaceId = typeof workspaceRaw === "string" && workspaceRaw ? workspaceRaw : null;
          let workspace: any = null;
          if (workspaceId) {
            const { data: ws, error: wsError } = await admin.from("workspaces")
              .select("id, owner_id, name, brand_url, brand_summary, keywords, country, city, entity_truth_card, onboarding, settings")
              .eq("id", workspaceId).eq("owner_id", userId).maybeSingle();
            if (wsError || !ws) return Response.json({ error: "workspace_not_found" }, { status: 404 });
            workspace = ws;
          }
          if (!officialWebsite && workspace?.brand_url) officialWebsite = String(workspace.brand_url).trim();
          const normalizedOfficialWebsite = normalizeOfficialWebsite(officialWebsite);
          if (!normalizedOfficialWebsite) {
            return Response.json({ error: officialWebsite ? "invalid_official_website" : "official_website_required" }, { status: 400 });
          }
          officialWebsite = normalizedOfficialWebsite;

          // Micro-probe (optional): live question to the engines the user selected.
          // Absent `probe_engines` → the original visibility flow below runs unchanged.
          { // The primary visibility action now runs the live ten-engine probe; estimates are not the default result.
            const { resolveProbePolicy } = await import("@/lib/tokens.server");
            const ent = await enginesAllowedForUser(admin, userId);
            const policy = await resolveProbePolicy(userId);
            // All requested engines run (up to ten); account plan no longer shortens the council.
            void ent;
            const picked = normalizeEngines(body.probe_engines);
            // Health telemetry is diagnostic only: historical failures must never silently remove requested engines.
            const engines = picked.length ? ENGINE_KEYS.filter((e) => picked.includes(e)) : [...ENGINE_KEYS];
            if (!engines.length) return Response.json({ error: "no_engines" }, { status: 400 });
            let probeTopic = keywords;
            if (!probeTopic && workspace) {
              const card = workspace.entity_truth_card && typeof workspace.entity_truth_card === "object" ? workspace.entity_truth_card : {};
              const cardKeywords = Array.isArray(card.keywords) ? card.keywords.join(", ") : String(card.keywords || "");
              probeTopic = [cardKeywords, card.sector, workspace.brand_summary]
                .filter(Boolean).join(" ").slice(0, 400);
            }
            if (!probeTopic) {
              const { data: profile } = await admin.from("profiles").select("brand_keywords, specialty_scope").eq("id", userId).maybeSingle();
              probeTopic = String((profile as any)?.brand_keywords || (profile as any)?.specialty_scope || "").trim().slice(0, 400);
            }
            const probeUnits = engines.length * 2;
            const pRun = crypto.randomUUID();
            const pStartedAt = Date.now();
            const pChg = await chargeTokens({ userId, toolKey: "visibility.probe", runId: pRun, units: probeUnits, unitTokens: policy.tokensPerEngine ?? undefined, meta: { engines, phases: ["blind", "evidence_grounded"], endpoint: "/api/visibility#probe" } });
            if (!pChg.ok) return Response.json(chargeFailureBody(pChg.reason as any, pChg.left), { status: 402 });
            const market = describeMarket(body.scope);
            const effectiveOfficialWebsite = officialWebsite || String(workspace?.brand_url || "").trim();
            const officialHost = (() => { try { return effectiveOfficialWebsite ? new URL(effectiveOfficialWebsite).hostname.replace(/^www\./i, "") : ""; } catch { return ""; } })();
            let categorySource = probeTopic ? (keywords ? "user_keywords" : "workspace_knowledge") : "official_site";
            let officialSiteCategoryEvidence: { title: string; description: string; fetch_source: string } | null = null;
            if (!probeTopic) {
              try {
                const { fcScrape } = await import("@/lib/firecrawl");
                const scraped: any = await fcScrape(effectiveOfficialWebsite, { deep: false, allowDirectHttp: false }, { userId, toolKey: "visibility" });
                const page = scraped?.data || scraped || {};
                const metadata = page?.metadata || scraped?.metadata || {};
                const derived = deriveOfficialSiteCategory({
                  title: metadata?.title || metadata?.ogTitle,
                  description: metadata?.description || metadata?.ogDescription,
                  markdown: page?.markdown || page?.content,
                  hostname: officialHost,
                }, brand);
                if (derived) {
                  probeTopic = derived.category;
                  categorySource = derived.basis;
                  officialSiteCategoryEvidence = {
                    title: String(metadata?.title || officialHost).slice(0, 160),
                    description: derived.category,
                    fetch_source: String(scraped?.fetch_source || "unknown"),
                  };
                }
              } catch (error) {
                console.warn("[visibility.probe] official-site category extraction failed", error);
              }
            }
            if (!probeTopic) {
              const chargedTokens = Number(pChg.tokens || 0);
              const billingSettlement = await settleTokenRefund(chargedTokens, chargedTokens, async (refundTokens) =>
                admin.rpc("charge_tokens", {
                  _user_id: userId, _tool_key: "visibility.probe", _tokens: -refundTokens, _usd: 0, _run_id: pRun,
                  _meta: { refund: true, reason: "official_site_category_unresolved", endpoint: "/api/visibility#probe" },
                } as any)
              );
              return Response.json({
                error: "official_site_category_unresolved",
                message: "A usable category could not be extracted from the official website. Add category keywords or enrich the workspace knowledge card.",
                refund_attempted: billingSettlement.refund_requested_tokens > 0,
                refunded: billingSettlement.refund_confirmed === true || billingSettlement.refund_requested_tokens === 0,
                billing_settlement: billingSettlement,
              }, { status: 422 });
            }
            const models = await resolveEngineModels(engines);
            const queryPack = buildVisibilityQueries({
              brandName: brand, officialWebsite: effectiveOfficialWebsite,
              geography: market.region, audienceLanguage: lang,
            }, probeTopic);
            const q = queryPack.find((item) => item.kind === "blind_discovery")!.prompt;
            const persistWorkspaceProbe = async (metrics: any, resultAnswers: any[], queryPackMetrics: any) => {
              if (!workspaceId || !workspace) return;
              const previousCard = workspace.entity_truth_card && typeof workspace.entity_truth_card === "object" ? workspace.entity_truth_card : {};
              const nextCard = {
                ...previousCard,
                entity_name: previousCard.entity_name || brand,
                keywords: keywords || previousCard.keywords || probeTopic,
                last_visibility_probe: {
                  operation_id: pRun,
                  measured_at: new Date().toISOString(),
                  market: market.region,
                  category: probeTopic,
                  category_source: categorySource,
                  official_website: effectiveOfficialWebsite,
                  metrics,
                  query_pack_metrics: queryPackMetrics,
                  answers: resultAnswers.map((answer: any) => ({ engine: answer.engine, mentioned: answer.mentioned, rank: answer.rank, status: answer.status, provider: answer.provider, gateway_model: answer.gateway_model, grounded_provider: answer.grounded_provider, grounded_gateway_model: answer.grounded_gateway_model, sources: (answer.sources || []).slice(0, 5) })),
                },
              };
              const { error } = await admin.from("workspaces").update({ entity_truth_card: nextCard, ...(effectiveOfficialWebsite ? { brand_url: effectiveOfficialWebsite } : {}) }).eq("id", workspaceId).eq("owner_id", userId);
              if (error) console.warn("[visibility] workspace truth-card update failed", error.message);
            };
            const PA = await import("@/lib/maaroof/probe-answer");
            let evidence: { url: string; title: string }[] = [];
            let evidenceText = "";
            let evidenceSource: "knowledge" | "web" | "none" = "none";
            const collectEvidence = async () => {
              // MCI evidence gate runs only after the blind phase; reuse verified facts and search only when needed.
              try {
                const { evidenceGate } = await import("@/lib/mci/evidence-gate");
                let factQuery = admin.from("knowledge_facts").select("id, fact, confidence, created_at, source").eq("user_id", userId);
                factQuery = workspaceId ? factQuery.eq("workspace_id", workspaceId) : factQuery.is("workspace_id", null);
                const { data: kf } = await factQuery.order("created_at", { ascending: false }).limit(20);
                const items = ((kf || []) as any[]).map((f) => ({ id: String(f.id), source: "knowledge" as const, claimType: (Number(f.confidence) >= 0.85 ? "verified_fact" : "hypothesis") as any, content: String(f.fact || ""), reliability: Number(f.confidence) || 0, createdAt: f.created_at }));
                const gate = evidenceGate(items);
                if (!gate.needWeb) {
                  const verified = items.filter((i) => i.claimType === "verified_fact").slice(0, 6);
                  evidence = verified.map((i: any) => ({ url: String(i.source || ""), title: String(i.content || "").slice(0, 120) })).filter((x) => /^https?:\/\//.test(x.url));
                  evidenceText = verified.map((i: any) => `- ${i.content.slice(0, 240)}${/^https?:\/\//.test(String(i.source || "")) ? ` (${i.source})` : ""}`).join("\n");
                  evidenceSource = "knowledge";
                }
                if (gate.needWeb && process.env.FIRECRAWL_API_KEY) {
                  const { fcSearch } = await import("@/lib/firecrawl");
                  const evidenceQuery = [probeTopic, brand, market.region, officialHost ? `site:${officialHost}` : ""].filter(Boolean).join(" ");
                  const sr: any = await fcSearch(evidenceQuery, { limit: 6, lang }, { userId, toolKey: "visibility" } as any);
                  const raw: any[] = sr?.data?.web || sr?.web || (Array.isArray(sr?.data) ? sr.data : []);
                  evidence = raw.map((it: any) => ({ url: String(it?.url || ""), title: String(it?.title || it?.metadata?.title || "").slice(0, 160) })).filter((x: any) => /^https?:\/\//.test(x.url)).slice(0, 6);
                  evidenceText = raw.slice(0, 6).map((it: any) => `- ${String(it?.title || "").slice(0, 120)}: ${String(it?.description || it?.markdown || "").replace(/\s+/g, " ").slice(0, 200)} (${it?.url || ""})`).join("\n");
                  evidenceSource = evidence.length ? "web" : "none";
                }
              } catch { evidenceSource = "none"; }
            };
            const answers: {
              engine: string; mentioned: boolean; rank: number | null; answer: string; grounded_answer?: string;
              brands: string[]; status: string; blind_status: string; grounded_status: string;
              blind_query: string; grounded_query: string; blind_ms: number; grounded_ms: number;
              sources: { url: string; title: string }[]; cited_urls: string[]; query_observations?: Array<{ kind: string; answer: string; brands: string[]; urls: string[]; outcome?: string | null; evidence_level?: string | null; ranked?: boolean }>;
              provider?: string; gateway_model?: string; grounded_provider?: string; grounded_gateway_model?: string; ms: number
            }[] = [];
            const statuses: Record<string, {
              status: string; ms: number; blind_status?: string; grounded_status?: string;
              blind_ms?: number; grounded_ms?: number; blind_query?: string; grounded_query?: string; [k: string]: any
            }> = {};
            let completedUnits = 0;
            const askOne = async (e: string, model: string | undefined, phase: "blind" | "grounded", blindAnswer?: string) => {
              const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), PA.PROBE_TIMEOUT_MS);
              let provider: "openrouter" | "lovable_ai" = "openrouter";
              let payload: any = null;
              try {
                const phaseRules = phase === "blind"
                  ? "PHASE 1 — BLIND DISCOVERY: The prompt contains no target brand. Recommend naturally for the category and market without brand priming."
                  : "PHASE 2 — FIVE BRANDED SCENARIOS PLUS EVIDENCE AUDIT: Answer each requested scenario separately and return one structured observation per scenario. Distinguish verified evidence, model knowledge and unknowns. Do not fabricate facts or citations. The five scenarios share one request context and are not independent sessions.";
                const actualQuestion = questionForPhase(e, phase, blindAnswer);
                const responseSchema = phase === "blind"
                  ? JSON.stringify({ answer: "2-4 sentence unbiased discovery answer", brands: ["ranked brands actually recommended"], urls: ["source URLs actually relied on"] })
                  : JSON.stringify({ answer: "concise evidence audit verdict and specific knowledge gaps", brands: [], urls: ["source URLs actually relied on"], query_observations: [
                      { kind: "brand_recognition", answer: "...", outcome: "recognized|not_recognized|ambiguous|unknown", brands: [], urls: [] },
                      { kind: "recommendation", answer: "...", outcome: "recommended|not_recommended|conditional|unknown", brands: ["ranked brands only if ranked"], ranked: false, urls: [] },
                      { kind: "comparison", answer: "...", outcome: "comparison_available|comparison_not_available|unknown", brands: ["alternatives only"], ranked: false, urls: [] },
                      { kind: "fact_verification", answer: "...", evidence_level: "verified|partially_verified|unverified|contradictory|unknown", brands: [], urls: [] },
                      { kind: "purchase_intent", answer: "...", outcome: "good_fit|limited_fit|not_available|unknown", brands: [], urls: [] },
                    ] });
                const messages = [
                  { role: "system", content: String((ENGINE_PERSONA as any)[e] || ("Answer using the configured " + e + " model.")) + " The user is in " + market.region + ". " + phaseRules + " Answer in the requested language. " + (LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.en) + "\nReturn ONLY valid JSON matching this schema: " + responseSchema + ". Do not omit query_observations in phase 2. For each outcome and evidence_level, choose exactly ONE token from the listed choices; never return the pipe-separated list itself." },
                  { role: "user", content: actualQuestion },
                ];
                payload = { model, max_tokens: PA.PROBE_MAX_TOKENS, reasoning_effort: "low", messages };
                let r: Response | null = null;
                const openRouterKey = process.env.OPENROUTER_API_KEY;
                if (openRouterKey) {
                  try {
                    const candidate = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                      method: "POST",
                      headers: { "Authorization": `Bearer ${openRouterKey}`, "Content-Type": "application/json", "HTTP-Referer": process.env.APP_URL || "https://maaroof.ai", "X-Title": "MAAROOF AI" },
                      signal: ctl.signal,
                      body: JSON.stringify(payload),
                    });
                    if (candidate.ok) r = candidate;
                    else console.warn("[visibility.probe] OpenRouter failed; falling back to Lovable", e, candidate.status);
                  } catch (err) {
                    if (ctl.signal.aborted) throw err;
                    console.warn("[visibility.probe] OpenRouter request failed; falling back to Lovable", e);
                  }
                }
                if (!r) {
                  provider = "lovable_ai";
                  r = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
                    method: "POST", headers: lovableAiHeaders(apiKey), signal: ctl.signal,
                    body: JSON.stringify(payload),
                  });
                }
                if (!r.ok) return { kind: "error" as const, provider, model: String(model || "") };
                let j: any = await r.json();
                let p = PA.parseProbeContent(j?.choices?.[0]?.message?.content);
                let actualModel = String(j?.model || model || "");
                if (!p && provider === "openrouter") {
                  // Empty OpenRouter payloads are failures too: retry once through Lovable.
                  provider = "lovable_ai";
                  const fallbackCtl = new AbortController();
                  const fallbackTimer = setTimeout(() => fallbackCtl.abort(), PA.PROBE_TIMEOUT_MS);
                  try {
                    const fallbackResponse = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, { method: "POST", headers: lovableAiHeaders(apiKey), signal: fallbackCtl.signal, body: JSON.stringify(payload) });
                    if (!fallbackResponse.ok) return { kind: "error" as const, provider, model: String(model || "") };
                    j = await fallbackResponse.json();
                    p = PA.parseProbeContent(j?.choices?.[0]?.message?.content);
                    actualModel = String(j?.model || model || "");
                  } finally { clearTimeout(fallbackTimer); }
                }
                return p ? { kind: "ok" as const, p, provider, model: actualModel } : { kind: "empty" as const, provider, model: actualModel };
              } catch (err: any) {
                if (provider === "openrouter") {
                  // A timed-out or network-failed OpenRouter attempt gets its own bounded Lovable retry.
                  const fallbackCtl = new AbortController();
                  const fallbackTimer = setTimeout(() => fallbackCtl.abort(), PA.PROBE_TIMEOUT_MS);
                  try {
                    const fallbackResponse = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, { method: "POST", headers: lovableAiHeaders(apiKey), signal: fallbackCtl.signal, body: JSON.stringify(payload) });
                    if (!fallbackResponse.ok) return { kind: fallbackCtl.signal.aborted ? ("timeout" as const) : ("error" as const), provider: "lovable_ai" as const, model: String(model || "") };
                    const fallbackJson: any = await fallbackResponse.json();
                    const fallbackParsed = PA.parseProbeContent(fallbackJson?.choices?.[0]?.message?.content);
                    return fallbackParsed ? { kind: "ok" as const, p: fallbackParsed, provider: "lovable_ai" as const, model: String(fallbackJson?.model || model || "") } : { kind: "empty" as const, provider: "lovable_ai" as const, model: String(fallbackJson?.model || model || "") };
                  } catch { return { kind: fallbackCtl.signal.aborted ? ("timeout" as const) : ("error" as const), provider: "lovable_ai" as const, model: String(model || "") }; }
                  finally { clearTimeout(fallbackTimer); }
                }
                return { kind: ctl.signal.aborted ? ("timeout" as const) : ("error" as const), provider: "unknown" as const, model: String(model || "") };
              } finally { clearTimeout(t); }
            };
            const questionForPhase = (engine: string, phase: "blind" | "grounded", blindAnswer?: string) => {
              if (phase === "blind") return q;
              const scenarioQuestions = queryPack
                .filter((item) => item.kind !== "blind_discovery")
                .map((item) => "[" + item.kind + "] " + item.prompt)
                .join("\n\n");
              return [
                "Evidence audit for target entity: " + brand,
                "Official website supplied for this audit: " + (effectiveOfficialWebsite || "not supplied"),
                "Market: " + market.region,
                "Original unbiased question (phase 1): " + q,
                "Public evidence retrieved (may be empty):",
                evidenceText || "No public evidence was retrieved.",
                "Blind answer from " + engine + " (for comparison only):",
                blindAnswer || "Unavailable.",
                "First, assess evidence sufficiency and state evidence gaps, weak claims, contradictions and unknowns. Do not treat the blind answer as proof.",
                "Then answer the following five fixed branded scenarios separately. Do not merge them into one general answer. Do not invent facts, sources, shipping availability or market coverage.",
                scenarioQuestions,
                "Return one query_observations item for EACH exact kind: brand_recognition, recommendation, comparison, fact_verification, purchase_intent. Each item must contain kind, concise answer, brands and URLs; include the prescribed outcome for each relevant scenario, evidence_level for fact_verification, and ranked=true only when the brand list is actually ranked."
              ].join("\n");
            };
            const groundedQuestionTemplate = () => questionForPhase("[model]", "grounded", "[the model's phase-1 blind answer]");
            const blindResults = new Map<string, { p: any; startedAt: number; blindMs: number; provider: string; model: string }>();
            const askEngine = async (e: string, phase: "blind" | "grounded") => {
              const previous = blindResults.get(e);
              const startedAt = previous?.startedAt ?? Date.now();
              const exactQuestion = questionForPhase(e, phase, previous?.p.answer);
              const phaseStartedAt = Date.now();
              // Keep each result attributed to the requested engine. Do not silently
              // replace an empty/failed engine response with a different model.
              const askPhase = async (answer?: string) => askOne(e, models[e]?.model, phase, answer);
              const res = await askPhase(previous?.p.answer);
              const phaseMs = Date.now() - phaseStartedAt;
              if (phase === "blind") {
                if (res.kind !== "ok") {
                  statuses[e] = {
                    status: res.kind, blind_status: res.kind, ms: phaseMs, blind_ms: phaseMs,
                    blind_query: exactQuestion, grounded_query: "",
                  };
                  return;
                }
                completedUnits++;
                blindResults.set(e, { p: res.p, startedAt, blindMs: phaseMs, provider: res.provider, model: res.model });
                statuses[e] = {
                  status: "blind_answered", blind_status: "answered", ms: phaseMs, blind_ms: phaseMs,
                  blind_query: exactQuestion,
                };
                return;
              }
              if (!previous) return;
              if (res.kind === "ok") completedUnits++;
              const p = previous.p;
              const idx = p.brands.findIndex((b: string) => b.toLowerCase().includes(brand.toLowerCase()) || brand.toLowerCase().includes(b.toLowerCase()));
              const sources = [...PA.linkSources(p, evidence), ...(res.kind === "ok" ? PA.linkSources(res.p, evidence) : [])].filter((src: any, i: number, all: any[]) => all.findIndex((x) => x.url === src.url) === i);
              const totalMs = previous.blindMs + phaseMs;
              statuses[e] = {
                status: res.kind === "ok" ? "answered" : "partial",
                blind_status: "answered", grounded_status: res.kind,
                ms: totalMs, blind_ms: previous.blindMs, grounded_ms: phaseMs,
                blind_query: q, grounded_query: exactQuestion, provider: res.provider, gateway_model: res.model, requested_engine: e,
              };
              answers.push({
                engine: e,
                mentioned: idx >= 0 || p.answer.toLowerCase().includes(brand.toLowerCase()),
                rank: idx >= 0 ? idx + 1 : null,
                answer: p.answer,
                grounded_answer: res.kind === "ok" ? res.p.answer : undefined,
                brands: p.brands,
                status: res.kind === "ok" ? "answered" : "partial",
                blind_status: "answered",
                grounded_status: res.kind,
                blind_query: q,
                grounded_query: exactQuestion,
                blind_ms: previous.blindMs,
                grounded_ms: phaseMs,
                sources,
                cited_urls: p.urls,
                query_observations: res.kind === "ok" ? (res.p.query_observations || []) : [],
                provider: previous.provider,
                gateway_model: previous.model,
                grounded_provider: res.provider,
                grounded_gateway_model: res.model,
                ms: totalMs,
              });
            };
            // Throttled batches (3 at a time, short gap) instead of firing all ten at once.
            const askAll = async () => {
              for (const batch of PA.probeBatches(engines, 3)) {
                await Promise.allSettled(batch.map((e) => askEngine(e, "blind")));
                await new Promise((r) => setTimeout(r, 200));
              }
              await collectEvidence();
              const groundedEngines = engines.filter((e) => blindResults.has(e));
              for (const batch of PA.probeBatches(groundedEngines, 3)) {
                await Promise.allSettled(batch.map((e) => askEngine(e, "grounded")));
                await new Promise((r) => setTimeout(r, 200));
              }
            };
            const settle = async () => {
              const requestedRefund = PA.probePhaseRefund(Number(pChg.tokens || 0), probeUnits, completedUnits);
              return settleTokenRefund(Number(pChg.tokens || 0), requestedRefund, async (refundTokens) =>
                admin.rpc("charge_tokens", {
                  _user_id: userId, _tool_key: "visibility.probe", _tokens: -refundTokens, _usd: 0, _run_id: pRun,
                  _meta: { refund: true, partial: true, completed_units: completedUnits, asked_units: probeUnits, endpoint: "/api/visibility#probe" },
                } as any)
              );
            };
            // Background mode (only when a person asks for it from the tool page): finish after the response.
            if (body.background === true && policy.backgroundAllowed) {
              let backgroundCharged = 0;
              let backgroundSettlement: Awaited<ReturnType<typeof settle>> | null = null;
              let bgMetrics: ReturnType<typeof calculateVisibilityProbeMetrics> | null = null;
              let bgQueryPackMetrics: ReturnType<typeof calculateVisibilityQueryPackMetrics> | null = null;
              const work = (async () => {
                await askAll();
                bgQueryPackMetrics = calculateVisibilityQueryPackMetrics(brand, engines, queryPack.map((item) => item.kind), answers, statuses);
                const settlement = await settle();
                backgroundSettlement = settlement;
                backgroundCharged = settlement.charged_tokens;
                const { recordBrandOperation } = await import("@/lib/brand-operations.server");
                const { ENGINE_CATALOG } = await import("@/lib/ai-engines");
                if (!answers.length) {
                  await recordBrandOperation(admin, {
                    id: pRun, userId, workspaceId, operationType: "visibility_probe", brandName: brand,
                    status: "failed", durationMs: Date.now() - pStartedAt, chargedUnits: backgroundCharged,
                    requestMeta: { engines, market: market.region },
                    resultMeta: { engines_answered: 0, evidence_count: evidence.length, query_pack_metrics: bgQueryPackMetrics, billing_settlement: settlement, refunded: settlement.refund_confirmed === true || settlement.refund_requested_tokens === 0 },
                    errorMessage: "engines_no_answer",
                  });
                  try {
                    const { notifyUser } = await import("@/lib/notify.server");
                    await notifyUser(userId, "analysis_done", `${brand}: probe failed`, { link: "/dashboard" });
                  } catch {}
                  return;
                }
                const metrics = calculateVisibilityProbeMetrics(brand, engines, answers);
                await persistWorkspaceProbe(metrics, answers, bgQueryPackMetrics);
                bgMetrics = metrics;
                try { await admin.from("report_drafts").insert({ user_id: userId, tool_key: "visibility", title: `${brand} — live probe`, payload: { probe: { query: q, blind_query: q, category: probeTopic, category_source: categorySource, official_website: effectiveOfficialWebsite, query_pack: queryPack, query_pack_metrics: bgQueryPackMetrics, grounded_question_template: groundedQuestionTemplate(), asked: engines, answers, statuses, evidence, visibility_metrics: metrics, charged: backgroundCharged } } as any, lang } as any); } catch {}
                const hit = answers.filter((a) => a.mentioned).length;
                await recordBrandOperation(admin, {
                  id: pRun, userId, workspaceId, operationType: "visibility_probe", brandName: brand,
                  durationMs: Date.now() - pStartedAt, chargedUnits: backgroundCharged,
                  requestMeta: { engines, market: market.region, category: probeTopic, category_source: categorySource, official_website: effectiveOfficialWebsite, audience_language: lang, engine_models: Object.fromEntries(engines.map((key) => [key, models[key]?.model || null])), connection_modes: Object.fromEntries(engines.map((key) => [key, (ENGINE_CATALOG as any)?.[key]?.proxy ? "proxy" : "direct"])) },
                  resultMeta: {
                    engines_answered: answers.length,
                    mentions: hit,
                    top5: answers.filter((answer: any) => Number(answer.rank) > 0 && Number(answer.rank) <= 5).length,
                    evidence_count: evidence.length,
                    evidence_urls: evidence.map((item) => item.url).slice(0, 30),
                    evidence_source: evidenceSource,
                    query_pack_metrics: bgQueryPackMetrics,
                    visibility_metrics: metrics,
                    billing_settlement: settlement,
                    basis: "live_engine_probe",
                  },
                });
                try {
                  const { notifyUser } = await import("@/lib/notify.server");
                  await notifyUser(userId, "analysis_done", `${brand}: ${hit}/${answers.length}`, { link: "/dashboard" });
                } catch {}
              })().catch((error) => {
                console.error("[visibility] background probe failed", error);
              });
              // This path is awaited inline; no detached work continues after the response.
              await work;
              return Response.json({ ok: true, operation_id: pRun, background: true, probe: { query: q, blind_query: q, category: probeTopic, category_source: categorySource, official_website: effectiveOfficialWebsite, query_pack: queryPack, query_pack_metrics: bgQueryPackMetrics, grounded_question_template: groundedQuestionTemplate(), asked: engines, answers, statuses, evidence, evidence_source: evidenceSource, visibility_metrics: bgMetrics, charged: backgroundCharged, billing_settlement: backgroundSettlement } });
            }
            await askAll();
            const queryPackMetrics = calculateVisibilityQueryPackMetrics(brand, engines, queryPack.map((item) => item.kind), answers, statuses);
            const billingSettlement = await settle();
            const charged = billingSettlement.charged_tokens;
            if (!answers.length) {
              const { recordBrandOperation } = await import("@/lib/brand-operations.server");
              await recordBrandOperation(admin, {
                id: pRun,
                userId,
                workspaceId,
                operationType: "visibility_probe",
                brandName: brand,
                status: "failed",
                durationMs: Date.now() - pStartedAt,
                chargedUnits: charged,
                requestMeta: { engines, market: market.region },
                resultMeta: { engines_answered: 0, evidence_count: evidence.length, query_pack_metrics: queryPackMetrics, billing_settlement: billingSettlement, refunded: billingSettlement.refund_confirmed === true || billingSettlement.refund_requested_tokens === 0 },
                errorMessage: "engines_no_answer",
              });
              return Response.json({ ok: false, operation_id: pRun, error: "engines_no_answer", probe: { query: q, blind_query: q, category: probeTopic, category_source: categorySource, official_website: effectiveOfficialWebsite, query_pack: queryPack, query_pack_metrics: queryPackMetrics, grounded_question_template: groundedQuestionTemplate(), asked: engines, answers: [], statuses, evidence, evidence_source: evidenceSource, charged, refunded: billingSettlement.refund_confirmed === true || billingSettlement.refund_requested_tokens === 0, billing_settlement: billingSettlement } }, { status: 502 });
            }
            if (body.notify) {
              try {
                const { notifyUser } = await import("@/lib/notify.server");
                const hit = answers.filter((a) => a.mentioned).length;
                await notifyUser(userId, "analysis_done", `${brand}: ${hit}/${answers.length}`, { link: "/dashboard" });
              } catch {}
            }
            const { withReasons, councilFromProbe } = await import("@/lib/maaroof/model-council");
            const { ENGINE_CATALOG } = await import("@/lib/ai-engines");
            const reasoned = withReasons(answers as any, brand, lang as any);
            const metrics = calculateVisibilityProbeMetrics(brand, engines, answers);
            await persistWorkspaceProbe(metrics, answers, queryPackMetrics);
            const council = councilFromProbe(reasoned, engines, brand, lang as any, (k) => (ENGINE_CATALOG as any)[k]?.name || k);
            const { recordBrandOperation } = await import("@/lib/brand-operations.server");
            await recordBrandOperation(admin, {
              id: pRun,
              userId,
              workspaceId,
              operationType: "visibility_probe",
              brandName: brand,
              durationMs: Date.now() - pStartedAt,
              chargedUnits: Number(charged) || 0,
              requestMeta: {
                engines,
                market: market.region,
                official_website: effectiveOfficialWebsite,
                category: probeTopic,
                category_source: categorySource,
                audience_language: lang,
                engine_models: Object.fromEntries(engines.map((key) => [key, models[key]?.model || null])),
                connection_modes: Object.fromEntries(engines.map((key) => [key, (ENGINE_CATALOG as any)?.[key]?.proxy ? "proxy" : "direct"])),
              },
              resultMeta: {
                engines_answered: reasoned.length,
                mentions: reasoned.filter((answer: any) => answer.mentioned).length,
                top5: reasoned.filter((answer: any) => Number(answer.rank) > 0 && Number(answer.rank) <= 5).length,
                evidence_count: evidence.length,
                evidence_urls: evidence.map((item) => item.url).slice(0, 30),
                evidence_source: evidenceSource,
                query_pack_metrics: queryPackMetrics,
                billing_settlement: billingSettlement,
                official_site_category_evidence: officialSiteCategoryEvidence,
                category: probeTopic,
                category_source: categorySource,
                visibility_metrics: metrics,
                basis: "live_engine_probe",
              },
            });
            return Response.json({ ok: true, operation_id: pRun, probe: { query: q, blind_query: q, category: probeTopic, category_source: categorySource, official_website: effectiveOfficialWebsite, query_pack: queryPack, query_pack_metrics: queryPackMetrics, grounded_question_template: groundedQuestionTemplate(), asked: engines, answers: reasoned, statuses, evidence, evidence_source: evidenceSource, official_site_category_evidence: officialSiteCategoryEvidence, visibility_metrics: metrics, council, charged, billing_settlement: billingSettlement, basis: "measured" } });
          }

          const _runId = crypto.randomUUID();
          const _t0 = Date.now();
          // Governed model selection (Part 12 registry) with the legacy default as fallback.
          const _MODEL = await resolveToolModel("google/gemini-2.5-flash-lite");
          // MCI (additive, fail-open): reuse a fresh identical result for this user — no charge.
          const _mci = await mciReuse(admin as any, "visibility", userId, [brand, keywords, lang, body.scope, workspaceId], !!(body as any)?.force);
          if (_mci.hit) return Response.json({ ..._mci.hit, mci: { reused: true, at: _mci.at } });
          const _chg = await chargeTokens({ userId, toolKey: "visibility", runId: _runId, meta: { provider: "lovable_ai", model: _MODEL, endpoint: "/api/visibility" } });
          if (!_chg.ok) return Response.json(chargeFailureBody((_chg as any).reason, (_chg as any).left), { status: 402 });

          const { data: roleRow } = await admin
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle();

          if (!roleRow) {
            // Allow active plan subscribers (counts against monthly_analyses)
            const { data: prof } = await admin.from("profiles").select("is_subscribed, subscription_tier, subscription_expires_at, monthly_analyses_used, quota_overrides").eq("id", userId).maybeSingle();
            const planActive = !!prof?.is_subscribed && (!prof!.subscription_expires_at || new Date(prof!.subscription_expires_at) >= new Date());
            if (planActive) {
              const { data: plan } = await admin.from("subscription_plans").select("monthly_analyses").eq("name", prof!.subscription_tier).maybeSingle();
              const override = Number((prof as any)?.quota_overrides?.monthly_analyses || 0);
              const limit = Math.max(plan?.monthly_analyses || 200, override);
              if ((prof!.monthly_analyses_used || 0) >= limit) /* balance-only: legacy monthly limit no longer blocks */ void limit;
              await admin.from("profiles").update({ monthly_analyses_used: (prof!.monthly_analyses_used || 0) + 1 }).eq("id", userId);
            } else {
              const { data: sub } = await admin
                .from("user_agent_subscriptions")
                .select("*, agent_addons(*)")
                .eq("user_id", userId)
                .eq("status", "active")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (!sub) return Response.json({ error: "no_active_subscription" }, { status: 402 });
              const addon = (sub as any).agent_addons;
              if (!addon) return Response.json({ error: "no_addon" }, { status: 402 });
              if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
                return Response.json({ error: "subscription_expired" }, { status: 402 });
              }

              const today = new Date().toISOString().slice(0, 10);
              const dailyUsed = sub.last_run_date === today ? sub.tasks_used_today : 0;
              if (sub.tasks_used + 1 > addon.monthly_tasks) {
                return Response.json({ error: "monthly_cap_reached" }, { status: 402 });
              }
              if (dailyUsed + 1 > addon.daily_task_cap) {
                return Response.json({ error: "daily_cap_reached" }, { status: 402 });
              }

              const { error: usageErr } = await admin
                .from("user_agent_subscriptions")
                .update({
                  tasks_used: sub.tasks_used + 1,
                  tasks_used_today: dailyUsed + 1,
                  last_run_date: today,
                })
                .eq("id", sub.id);

              if (usageErr) {
                console.error("[api/visibility] usage update failed:", usageErr!.message);
                return Response.json({ error: "usage_update_failed" }, { status: 500 });
              }
            }
          }

          const market = describeMarket(body.scope);
          const SYSTEM = buildSystem(market);
          const prompt = `REPORT_LANGUAGE: ${lang}\nBrand: ${brand}\nKeywords: ${keywords || "(unspecified)"}\nMarket: ${market.region}\n\nReturn the JSON now. All text fields MUST be in language code "${lang}".`;
          const pack = await buildEvidencePack(`${brand} ${keywords || ""} ${market.region} AI visibility`.trim(), { limit: 4, lang });
          const resp = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: lovableAiHeaders(apiKey as string),
            body: JSON.stringify({
              model: _MODEL,
              messages: [
                { role: "system", content: `${qualityShell(SYSTEM)}\n\n${LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.en}` },
                { role: "user", content: `${prompt}\n\n${pack.context_block}` },
              ]
            }),
          });


          if (resp.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
          if (resp.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
          if (!resp.ok) {
            const rawError = await resp.text();
            console.error("[api/visibility] AI gateway error:", resp.status, rawError);
            return Response.json({ error: `ai_${resp.status}` }, { status: 500 });
          }

          const data = await resp.json();
          try {
            const _u: any = (data as any)?.usage || {};
            const { enrichLedger: _el } = await import("@/lib/spend.server");
            await _el({ runId: _runId, provider: "lovable_ai", model: _MODEL, endpoint: "/api/visibility", inputTokens: Number(_u.prompt_tokens)||0, outputTokens: Number(_u.completion_tokens)||0, latencyMs: Date.now() - _t0 });
          } catch {}

          const content = String(data?.choices?.[0]?.message?.content || "{}");

          const parsed = extractJsonObject(content);

          const result = normalizeResult(parsed || {}, content);

          // Never overwrite the main account identity with a checked brand; only fill it when empty.
          await admin.from("profiles").update({ brand_name: brand, brand_keywords: keywords || null }).eq("id", userId).is("brand_name", null);

          const taskPayload = {
            user_id: userId,
            task_type: "ai_visibility",
            input: brand,
            status: "done",
            result: { ...result, raw: content, lang, keywords },
          };

          const { data: taskRow, error: taskErr } = await admin
            .from("agent_tasks")
            .insert(taskPayload)
            .select("id")
            .single();

          if (taskErr) {
            console.error("[api/visibility] task insert failed:", taskErr!.message);
          }

          const _q = pickQualityFields(parsed || {});
          const { recordBrandOperation } = await import("@/lib/brand-operations.server");
          await recordBrandOperation(admin, {
            id: _runId,
            userId,
            workspaceId,
            operationType: "visibility_analysis",
            brandName: brand,
            durationMs: Date.now() - _t0,
            chargedUnits: Number((_chg as any).tokens) || 0,
            requestMeta: { keywords, market: market.region, score_basis: "arithmetic_mean_of_10_model_estimates" },
            resultMeta: {
              visibility_percent: result.visibility_percent,
              platform_scores: result.platforms,
              evidence_count: pack.sources.length,
              evidence_urls: pack.sources.map((source: any) => source.url).filter(Boolean).slice(0, 30),
              basis: "model_generated_estimates",
              task_id: taskRow?.id ?? null,
            },
          });
          { const _out = { ok: true, operation_id: _runId, taskId: taskRow?.id ?? null, result: { ...result, sources: pack.sources, ..._q }, sources: pack.sources, ..._q }; await mciStore(admin as any, "visibility", userId, _mci.key, _out); return Response.json(_out); }

        } catch (error) {
          console.error("[api/visibility] fatal error:", error);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
