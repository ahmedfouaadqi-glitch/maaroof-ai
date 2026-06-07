// Real per-platform "AI visibility simulation" for the Competitor Compare tool.
// Each brand gets ONE Lovable AI call that receives per-platform evidence
// (LinkedIn for Copilot, X for Grok, Wikipedia for Claude/ChatGPT, Reddit for
// Perplexity, news, reviews, geo, official site, on-site SEO). The model is
// instructed to score each engine independently using its own rubric, so the
// 8 numbers actually vary per brand instead of being a single shared score.
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders, extractJsonObject } from "@/lib/lovable-ai";

type Lang = "en" | "ar" | "ku";

export const PLATFORMS_9 = ["chatgpt","gemini","claude","perplexity","copilot","grok","mistral","deepseek","kimi"] as const;
export type Platform9 = typeof PLATFORMS_9[number];
// Back-compat aliases for older imports
export const PLATFORMS_8 = PLATFORMS_9;
export type Platform8 = Platform9;

export type BrandEvidenceInput = {
  name: string;
  hasOfficialSite: boolean;
  officialUrl?: string | null;
  officialStatus?: "confirmed" | "candidate" | "user" | "missing";
  evidenceByKind: Record<string, number>;
  totalEvidence: number;
  topSources?: { kind: string; title: string; url: string }[];
  /** Per-platform-relevant evidence counts: linkedin, x, reddit, wiki, news, reviews, geo, official, youtube, general */
  platformEvidence?: Record<string, number>;
  seoSignals?: {
    seo_score?: number;
    sge_score?: number;
    has_jsonld?: boolean;
    has_org_schema?: boolean;
    has_faq_schema?: boolean;
    has_article_schema?: boolean;
    has_og?: boolean;
    word_count?: number;
    h2_count?: number;
    h3_count?: number;
    external_links?: number;
    internal_links?: number;
    has_lang?: boolean;
  } | null;
};

export type PlatformScores = Record<Platform8, number>;
export type PlatformBasis = "measured_simulation" | "evidence_inferred" | "insufficient_evidence";

export type BrandProbeResult = {
  scores: PlatformScores;
  reasons: Record<Platform8, string>;
  basis: Record<Platform8, PlatformBasis>;
};

function clamp(n: any): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function basisFromEvidence(ev: number, hasOfficial: boolean, hasSeo: boolean): PlatformBasis {
  if (hasSeo && ev >= 4) return "measured_simulation";
  if (hasOfficial || ev >= 3) return "measured_simulation";
  if (ev > 0) return "evidence_inferred";
  return "insufficient_evidence";
}

const PLATFORM_RUBRIC = `Score each engine 0-100 USING ITS OWN signal mix — the 8 numbers MUST vary based on which evidence is present:

- chatgpt (OpenAI + Bing): WEIGH news + wiki + official site + OG metadata + reputable backlinks. Penalize if no news & no wiki.
- gemini (Google + Knowledge Graph): WEIGH JSON-LD/Organization/LocalBusiness schema + Google reviews + geo presence + recency. Penalize hard if no JSON-LD.
- claude (Anthropic): WEIGH long-form content + wiki + primary/authoritative sources + low-noise official site. Penalize thin content.
- perplexity (live web): WEIGH news freshness + reddit + reviews + comparison/listicle pages + inline citations. Penalize if no news AND no reddit.
- copilot (Microsoft Bing + LinkedIn): WEIGH LinkedIn presence + Bing-indexed pages + B2B content + official domain. Penalize if no LinkedIn.
- grok (xAI + X/Twitter): WEIGH X/Twitter mentions + recent news + viral buzz + YouTube. Penalize hard if no X presence.
- mistral (Brave + EU + multilingual): WEIGH multilingual content (lang attr) + structured pages + EU/non-US sources + official.
- deepseek (technical web, CN+EN): WEIGH technical/structured factual pages + JSON-LD + docs + multilingual.

Scoring guardrails:
- No evidence at all for the brand → ALL engines ≤ 10.
- Only an official site, zero news/social/reviews → most engines 18-32; engines that need their specific signal (grok without X, perplexity without news, copilot without LinkedIn) stay ≤ 20.
- Strong matching signal for a specific engine (e.g. 3+ LinkedIn results for copilot, 3+ X results for grok, JSON-LD+Organization for gemini) → that engine 55-80.
- Wikipedia presence boosts chatgpt + claude by ~15.
- The 8 numbers MUST NOT all cluster within 10 points of each other unless evidence is genuinely uniform.`;

async function probeOneBrand(
  brand: BrandEvidenceInput,
  lang: Lang,
  market: string | undefined,
  apiKey: string,
  model: string,
): Promise<BrandProbeResult | null> {
  const langName = lang === "ar" ? "Arabic" : lang === "ku" ? "Kurdish (Sorani)" : "English";
  const seo = brand.seoSignals;
  const seoBlock = seo
    ? `On-site SEO/SGE signals:
- seo_score=${seo.seo_score ?? "?"} / sge_score=${seo.sge_score ?? "?"}
- jsonld=${seo.has_jsonld ? "yes" : "no"}, organization_schema=${seo.has_org_schema ? "yes" : "no"}, faq_schema=${seo.has_faq_schema ? "yes" : "no"}, article_schema=${seo.has_article_schema ? "yes" : "no"}
- og_tags=${seo.has_og ? "yes" : "no"}, lang_attr=${seo.has_lang ? "yes" : "no"}
- word_count=${seo.word_count ?? 0}, h2=${seo.h2_count ?? 0}, h3=${seo.h3_count ?? 0}
- internal_links=${seo.internal_links ?? 0}, external_links=${seo.external_links ?? 0}`
    : "On-site SEO/SGE signals: (no official site scraped — major gap)";

  const pe = brand.platformEvidence || {};
  const perPlatformBlock = `Per-platform evidence counts (REAL search results retrieved for this brand):
- LinkedIn results: ${pe.linkedin ?? 0}  (drives copilot)
- X/Twitter results: ${pe.x ?? 0}  (drives grok)
- Reddit results: ${pe.reddit ?? 0}  (drives perplexity)
- Wikipedia results: ${pe.wiki ?? 0}  (drives chatgpt + claude)
- News results: ${pe.news ?? 0}  (drives chatgpt + perplexity + grok)
- Reviews results: ${pe.reviews ?? 0}  (drives gemini + perplexity)
- Geo/location results: ${pe.geo ?? 0}  (drives gemini)
- YouTube results: ${pe.youtube ?? 0}  (drives grok + general buzz)
- Official-search results: ${pe.official ?? 0}
- General results: ${pe.general ?? 0}`;

  const sourceList = (brand.topSources || []).slice(0, 14)
    .map((s, i) => `  ${i + 1}. [${s.kind}] ${s.title} — ${s.url}`)
    .join("\n") || "  (no public sources found)";

  const sys = `${PLATFORM_RUBRIC}

You are scoring how each of the 8 AI engines above would RECALL or CITE the brand "${brand.name}" if asked about it in market "${market || "global"}". Use ONLY the evidence below. Do NOT invent facts. Different engines MUST get different scores when their specific signals differ.

Reply in STRICT JSON only, no markdown:
{
  "scores": { "chatgpt": <0-100>, "gemini": <0-100>, "claude": <0-100>, "perplexity": <0-100>, "copilot": <0-100>, "grok": <0-100>, "mistral": <0-100>, "deepseek": <0-100> },
  "reasons": { "chatgpt": "<≤120 chars in ${langName}, cite the specific signal>", "gemini": "...", "claude": "...", "perplexity": "...", "copilot": "...", "grok": "...", "mistral": "...", "deepseek": "..." }
}`;

  const user = `Brand: ${brand.name}
Official site: ${brand.hasOfficialSite ? `${brand.officialUrl || "(found)"} [${brand.officialStatus || "confirmed"}]` : "NOT FOUND"}
Total public sources gathered: ${brand.totalEvidence}

${perPlatformBlock}

Evidence by kind (raw): ${JSON.stringify(brand.evidenceByKind)}

Top sources:
${sourceList}

${seoBlock}

Return the JSON now. Remember: different engines MUST score differently when their signals differ.`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: lovableAiHeaders(apiKey),
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn("[platform-probe] http", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data: any = await res.json();
    const content = String(data?.choices?.[0]?.message?.content || "{}");
    const parsed = extractJsonObject<any>(content);
    if (!parsed) return null;

    const scores = {} as PlatformScores;
    const reasons = {} as Record<Platform8, string>;
    const basis = {} as Record<Platform8, PlatformBasis>;
    for (const p of PLATFORMS_8) {
      scores[p] = clamp(parsed?.scores?.[p]);
      reasons[p] = String(parsed?.reasons?.[p] || "").slice(0, 200);
      // Per-platform basis: based on whether that platform's specific evidence exists
      const sig = (() => {
        switch (p) {
          case "copilot": return (pe.linkedin || 0) + (pe.official || 0);
          case "grok": return (pe.x || 0) + (pe.news || 0);
          case "perplexity": return (pe.news || 0) + (pe.reddit || 0) + (pe.reviews || 0);
          case "gemini": return (pe.reviews || 0) + (pe.geo || 0) + (seo?.has_jsonld ? 3 : 0);
          case "chatgpt": return (pe.news || 0) + (pe.wiki || 0);
          case "claude": return (pe.wiki || 0) + ((seo?.word_count || 0) >= 800 ? 2 : 0);
          case "mistral": return (pe.general || 0) + (seo?.has_lang ? 2 : 0);
          case "deepseek": return (seo?.has_jsonld ? 3 : 0) + (pe.general || 0);
          default: return 0;
        }
      })();
      basis[p] = basisFromEvidence(sig, brand.hasOfficialSite, !!brand.seoSignals);
    }
    return { scores, reasons, basis };
  } catch (e) {
    console.warn("[platform-probe] failed for", brand.name, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Probe all brands in parallel — one AI call per brand returning per-platform
 * scores grounded in per-platform evidence (so numbers actually vary).
 */
export async function probeBrandsPerPlatform(
  brands: BrandEvidenceInput[],
  opts: { lang: Lang; market?: string; apiKey: string; model?: string },
): Promise<Record<string, BrandProbeResult>> {
  const model = opts.model || "google/gemini-3-flash-preview";
  const out: Record<string, BrandProbeResult> = {};
  if (brands.length === 0) return out;

  const settled = await Promise.allSettled(
    brands.map((b) => probeOneBrand(b, opts.lang, opts.market, opts.apiKey, model)),
  );
  settled.forEach((r, i) => {
    const name = brands[i].name;
    if (r.status === "fulfilled" && r.value) {
      out[name] = r.value;
    }
  });
  return out;
}
