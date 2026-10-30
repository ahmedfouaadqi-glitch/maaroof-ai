import { normalizeEngines } from "@/lib/ai-engines";
import { mciReuse, mciStore } from "@/lib/mci/resolver.server";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { describeMarket, type GeoScope } from "@/lib/geo-scope.server";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";
import { qualityShell, buildEvidencePack, pickQualityFields } from "@/lib/tool-quality.server";
import { resolveToolModel, enginesAllowedForUser, applyEntitlement, resolveEngineModels, excludeUnhealthyEngines } from "@/lib/ai-engines.server";
import { ENGINE_PERSONA } from "@/lib/ai-engines";
import { asText } from "@/lib/input-coerce";
import { blindProbeQuestion } from "@/lib/maaroof/probe-answer";


type Body = { brand?: string; keywords?: string; lang?: "en" | "ar" | "ku"; scope?: GeoScope; probe_engines?: string[]; notify?: boolean; background?: boolean; workspace_id?: string | null };

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

Each AI platform uses a DIFFERENT citation mechanism — name it explicitly:
- ChatGPT (OpenAI): hybrid — pretrained corpus + Bing-powered web tool. Favors well-structured pages, Wikipedia presence, news mentions, reputable backlinks, OpenGraph metadata. citation_method = "training_corpus + web_search".
- Gemini (Google): tightly tied to Google Search index + Knowledge Graph. Favors strong SEO, Google Business Profile, reviews, schema.org markup, recency. citation_method = "google_search_index + knowledge_graph".
- Claude (Anthropic): conservative; favors well-written long-form content, primary sources, .org/.gov domains, factual density. Web access only via tools. citation_method = "training_corpus + curated_web".
- Perplexity: live web search + inline citations. Favors freshness, clear sourcing, news coverage, listicles, comparison pages, sites that allow crawlers. citation_method = "live_web_search + ranked_citations".
- Copilot (Microsoft): Bing index + LinkedIn graph + Microsoft 365 graph. Favors LinkedIn presence, Bing-indexed pages, B2B content. citation_method = "bing_index + linkedin_graph".
- Grok (xAI): real-time X (Twitter) signal + general web. Favors brand presence on X, recent buzz, viral mentions, news. citation_method = "x_realtime + web_search".
- Mistral (Le Chat): web search via Brave/SerpAPI partners, training corpus. Favors EU-friendly sources, multilingual content, structured pages. citation_method = "training_corpus + brave_search".
- DeepSeek: efficient reasoning model with web tool. Favors technical docs, GitHub/Stack Overflow content, structured factual pages, multilingual sources (Chinese + English strong). citation_method = "training_corpus + web_search".
- Kimi (Moonshot AI): assess this engine from the returned response and citations; do not infer undocumented retrieval behavior.
- Qwen (Alibaba): assess this engine from the returned response and citations; do not infer undocumented retrieval behavior.

Return ONLY valid JSON in this exact shape:
{
  "visibility_percent": <0-100, unified weighted score>,
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
          const lang = body.lang === "ar" || body.lang === "ku" ? body.lang : "en";

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
          const userId = authData.user?.id;
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

          // Micro-probe (optional): live question to the engines the user selected.
          // Absent `probe_engines` → the original visibility flow below runs unchanged.
          if (Array.isArray(body.probe_engines) && body.probe_engines.length) {
            const { resolveProbePolicy } = await import("@/lib/tokens.server");
            const ent = await enginesAllowedForUser(admin, userId);
            const policy = await resolveProbePolicy(userId);
            // All requested engines run (up to ten); account plan no longer shortens the council.
            void ent;
            const picked = normalizeEngines(body.probe_engines);
            const { engines } = await excludeUnhealthyEngines(picked);
            if (!engines.length) return Response.json({ error: "no_engines" }, { status: 400 });
            let probeTopic = keywords;
            if (!probeTopic && workspace) {
              const card = workspace.entity_truth_card && typeof workspace.entity_truth_card === "object" ? workspace.entity_truth_card : {};
              const cardKeywords = Array.isArray(card.keywords) ? card.keywords.join(", ") : String(card.keywords || "");
              probeTopic = [card.entity_name || workspace.name, cardKeywords, card.sector || workspace.brand_summary]
                .filter(Boolean).join(" ").slice(0, 400);
            }
            if (!probeTopic && !workspace) {
              const { data: profile } = await admin.from("profiles").select("brand_keywords, specialty_scope").eq("id", userId).maybeSingle();
              probeTopic = String((profile as any)?.brand_keywords || (profile as any)?.specialty_scope || "").trim().slice(0, 400);
            }
            if (!probeTopic) return Response.json({ error: "probe_category_required" }, { status: 400 });
            const probeUnits = engines.length * 2;
            const pRun = crypto.randomUUID();
            const pChg = await chargeTokens({ userId, toolKey: "visibility.probe", runId: pRun, units: probeUnits, unitTokens: policy.tokensPerEngine ?? undefined, meta: { engines, phases: ["blind", "evidence_grounded"], endpoint: "/api/visibility#probe" } });
            if (!pChg.ok) return Response.json(chargeFailureBody(pChg.reason as any, pChg.left), { status: 402 });
            const market = describeMarket(body.scope);
            const models = await resolveEngineModels(engines);
            const q = blindProbeQuestion(probeTopic, market.region);
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
                  const sr: any = await fcSearch(`${probeTopic} ${market.region}`, { limit: 6 }, { userId, toolKey: "visibility" } as any);
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
              sources: { url: string; title: string }[]; ms: number
            }[] = [];
            const statuses: Record<string, {
              status: string; ms: number; blind_status?: string; grounded_status?: string;
              blind_ms?: number; grounded_ms?: number; blind_query?: string; grounded_query?: string
            }> = {};
            let completedUnits = 0;
            const askOne = async (e: string, model: string | undefined, phase: "blind" | "grounded", blindAnswer?: string) => {
              const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), PA.PROBE_TIMEOUT_MS);
              try {
                const phaseRules = phase === "blind"
                  ? "PHASE 1 — BLIND RETRIEVAL: The question is unbranded. Do not infer or assume a target brand, and do not favor any company. Answer it as you normally would based only on your available knowledge."
                  : "PHASE 2 — EVIDENCE-GROUNDED REVIEW: Evaluate whether the target entity is sufficiently supported by the public evidence included in the user's audit question. State exact gaps, weak claims, or contradictions. Do not invent facts or treat the blind answer as proof.";
                const actualQuestion = questionForPhase(e, phase, blindAnswer);
                const r = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
                  method: "POST", headers: lovableAiHeaders(apiKey), signal: ctl.signal,
                  body: JSON.stringify({ model, max_tokens: PA.PROBE_MAX_TOKENS, reasoning_effort: "low", messages: [
                    { role: "system", content: `${(ENGINE_PERSONA as any)[e] || `Answer as the ${e} assistant would.`} The user is in ${market.region}. ${phaseRules} Answer in the requested language. ${LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.en}\nReturn JSON only: {"answer":"${phase === "blind" ? "2-4 sentence organic recommendation answer" : "sufficiency verdict and specific knowledge gaps"}","brands":["${phase === "blind" ? "brand names recommended, in ranked order" : "leave empty for this grounded review"}"],"urls":["source URLs actually relied on"]}` },
                    { role: "user", content: actualQuestion },
                  ] }),
                });
                if (!r.ok) return { kind: "error" as const };
                const j: any = await r.json();
                const p = PA.parseProbeContent(j?.choices?.[0]?.message?.content);
                return p ? { kind: "ok" as const, p } : { kind: "empty" as const };
              } catch (err: any) {
                return { kind: ctl.signal.aborted ? ("timeout" as const) : ("error" as const) };
              } finally { clearTimeout(t); }
            };
            const questionForPhase = (engine: string, phase: "blind" | "grounded", blindAnswer?: string) => {
              if (phase === "blind") return q;
              return [
                "Evidence audit for target entity: " + brand,
                "Market: " + market.region,
                "Original unbiased question (phase 1): " + q,
                "Public evidence retrieved (may be empty):",
                evidenceText || "No public evidence was retrieved.",
                "Blind answer from " + engine + " (for comparison only):",
                blindAnswer || "Unavailable.",
                "Audit question: Based only on the supplied public evidence, is this entity sufficiently supported to cite as a reliable source in future answers? State specific evidence gaps, weak claims, contradictions, and what remains unverified. Do not treat the blind answer as proof."
              ].join("\n");
            };
            const groundedQuestionTemplate = () => questionForPhase("[model]", "grounded", "[the model's phase-1 blind answer]");
            const blindResults = new Map<string, { p: any; startedAt: number; blindMs: number }>();
            const askEngine = async (e: string, phase: "blind" | "grounded") => {
              const previous = blindResults.get(e);
              const startedAt = previous?.startedAt ?? Date.now();
              const exactQuestion = questionForPhase(e, phase, previous?.p.answer);
              const phaseStartedAt = Date.now();
              const askPhase = async (answer?: string) => {
                let res = await askOne(e, models[e]?.model, phase, answer);
                if (res.kind === "empty" || res.kind === "error") res = await askOne(e, "google/gemini-3.8-flash", phase, answer);
                return res;
              };
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
                blindResults.set(e, { p: res.p, startedAt, blindMs: phaseMs });
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
                blind_query: q, grounded_query: exactQuestion,
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
              const refund = PA.probePhaseRefund(Number(pChg.tokens || 0), probeUnits, completedUnits);
              if (refund > 0) { try { await admin.rpc("charge_tokens", { _user_id: userId, _tool_key: "visibility.probe", _tokens: -refund, _usd: 0, _run_id: pRun, _meta: { refund: true, partial: true, completed_units: completedUnits, asked_units: probeUnits, endpoint: "/api/visibility#probe" } } as any); } catch {} }
              return Number(pChg.tokens || 0) - refund;
            };
            // Background mode (only when a person asks for it from the tool page): finish after the response.
            if (body.background === true && policy.backgroundAllowed) {
              const work = (async () => {
                await askAll();
                const charged = await settle();
                const { notifyUser } = await import("@/lib/notify.server");
                if (!answers.length) {
                  try { await notifyUser(userId, "analysis_done", `${brand}: probe failed — refunded`, { link: "/dashboard" }); } catch {}
                  return;
                }
                try { await admin.from("report_drafts").insert({ user_id: userId, tool_key: "visibility", title: `${brand} — live probe`, payload: { probe: { query: q, blind_query: q, grounded_question_template: groundedQuestionTemplate(), asked: engines, answers, statuses, evidence, charged } } as any, lang } as any); } catch {}
                const hit = answers.filter((a) => a.mentioned).length;
                try { await notifyUser(userId, "analysis_done", `${brand}: ${hit}/${answers.length}`, { link: "/dashboard" }); } catch {}
              })().catch(() => {});
              // Safe start: run inline (each engine is capped at 30s) so the work can never be
              // detached after the response; results + notification are saved before we reply.
              await work;
              return Response.json({ ok: true, background: true, probe: { query: q, blind_query: q, grounded_question_template: groundedQuestionTemplate(), asked: engines, answers, statuses, evidence, evidence_source: evidenceSource, charged: pChg.tokens } });
            }
            await askAll();
            const charged = await settle();
            if (!answers.length) {
              return Response.json({ ok: false, error: "engines_no_answer", probe: { query: q, blind_query: q, grounded_question_template: groundedQuestionTemplate(), asked: engines, answers: [], statuses, evidence, evidence_source: evidenceSource, charged: 0, refunded: true } }, { status: 502 });
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
            const council = councilFromProbe(reasoned, engines, brand, lang as any, (k) => (ENGINE_CATALOG as any)[k]?.name || k);
            return Response.json({ ok: true, operation_id: pRun, probe: { query: q, blind_query: q, grounded_question_template: groundedQuestionTemplate(), asked: engines, answers: reasoned, statuses, evidence, evidence_source: evidenceSource, council, charged, basis: "measured" } });
          }

          const _runId = crypto.randomUUID();
          const _t0 = Date.now();
          // Governed model selection (Part 12 registry) with the legacy default as fallback.
          const _MODEL = await resolveToolModel("google/gemini-2.5-flash-lite");
          // MCI (additive, fail-open): reuse a fresh identical result for this user — no charge.
          const _mci = await mciReuse(admin as any, "visibility", userId, [brand, keywords, lang, body.scope, workspaceId], !!(body as any)?.force);
          if (_mci.hit) return Response.json({ ..._mci.hit, mci: { reused: true, at: _mci.at } });
          const _chg = await chargeTokens({ userId, toolKey: "visibility", runId: _runId, meta: { provider: "lovable_ai", model: _MODEL, endpoint: "/api/visibility" } });
          if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });

          const { data: roleRow } = await admin
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle();

          if (!roleRow) {
            // Allow active plan subscribers (counts against monthly_analyses)
            const { data: prof } = await admin.from("profiles").select("is_subscribed, subscription_tier, subscription_expires_at, monthly_analyses_used, quota_overrides").eq("id", userId).maybeSingle();
            const planActive = !!prof?.is_subscribed && (!prof.subscription_expires_at || new Date(prof.subscription_expires_at) >= new Date());
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
                console.error("[api/visibility] usage update failed:", usageErr.message);
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
            headers: lovableAiHeaders(apiKey),
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
            console.error("[api/visibility] task insert failed:", taskErr.message);
          }

          const _q = pickQualityFields(parsed || {});
          { const _out = { ok: true, taskId: taskRow?.id ?? null, result: { ...result, sources: pack.sources, ..._q }, sources: pack.sources, ..._q }; await mciStore(admin as any, "visibility", userId, _mci.key, _out); return Response.json(_out); }

        } catch (error) {
          console.error("[api/visibility] fatal error:", error);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
