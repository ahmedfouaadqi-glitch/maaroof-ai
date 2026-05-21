// Real per-platform "AI visibility simulation" for the Competitor Compare tool.
// Strategy: one strong Lovable AI call per brand that receives the actual
// Firecrawl evidence + on-site SEO/SGE signals + official-site status, and
// returns evidence-grounded scores for each of the 8 engines along with a
// short reason per engine. This replaces the previous deterministic-only
// derivation and gives real per-platform output even when the user only
// provides brand names.
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders, extractJsonObject } from "@/lib/lovable-ai";

type Lang = "en" | "ar" | "ku";

export const PLATFORMS_8 = ["chatgpt","gemini","claude","perplexity","copilot","grok","mistral","deepseek"] as const;
export type Platform8 = typeof PLATFORMS_8[number];

export type BrandEvidenceInput = {
  name: string;
  hasOfficialSite: boolean;
  officialUrl?: string | null;
  evidenceByKind: Record<string, number>;
  totalEvidence: number;
  topSources?: { kind: string; title: string; url: string }[];
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

const PLATFORM_RUBRIC = `Each engine has a different citation/recall mechanism. Score 0-100 honestly:
- chatgpt (OpenAI + Bing): values news, Wikipedia, well-structured pages, OG metadata, reputable backlinks.
- gemini (Google + Knowledge Graph): values schema.org / JSON-LD, Organization/LocalBusiness, Google Business Profile, reviews, recency.
- claude (Anthropic): conservative; values long-form content, primary sources, factual density, .org/.gov.
- perplexity (live web): values news freshness, reviews, comparison pages, inline citations.
- copilot (Microsoft Bing + LinkedIn): values LinkedIn presence, Bing-indexed pages, B2B content.
- grok (xAI + X): values brand presence on X, recent buzz, viral mentions, news.
- mistral (Brave/SerpAPI partners): values multilingual content, EU sources, structured pages.
- deepseek (technical web): values technical/structured factual pages, multilingual (CN+EN), docs.

Score conservatively. If a brand has no evidence at all → all engines ≤ 12. If only an official site exists but zero news/reviews → most engines 15-35. Strong evidence in matching kind → 60-85. Be honest, do NOT inflate.`;

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
    : "On-site SEO/SGE signals: (no official site scraped — treat as a major gap)";

  const sourceList = (brand.topSources || []).slice(0, 12)
    .map((s, i) => `  ${i + 1}. [${s.kind}] ${s.title} — ${s.url}`)
    .join("\n") || "  (no public sources found)";

  const sys = `${PLATFORM_RUBRIC}

You are simulating how each of the 8 AI engines above would RECALL or CITE the brand "${brand.name}" if asked about it in market "${market || "global"}". Use ONLY the evidence below. Do NOT invent facts.

Reply in STRICT JSON only, no markdown:
{
  "scores": { "chatgpt": <0-100>, "gemini": <0-100>, "claude": <0-100>, "perplexity": <0-100>, "copilot": <0-100>, "grok": <0-100>, "mistral": <0-100>, "deepseek": <0-100> },
  "reasons": { "chatgpt": "<≤140 chars, in ${langName}>", "gemini": "...", "claude": "...", "perplexity": "...", "copilot": "...", "grok": "...", "mistral": "...", "deepseek": "..." }
}`;

  const user = `Brand: ${brand.name}
Official site: ${brand.hasOfficialSite ? brand.officialUrl || "(found)" : "NOT FOUND"}
Total public sources gathered: ${brand.totalEvidence}
Evidence by kind: ${JSON.stringify(brand.evidenceByKind)}

Top sources:
${sourceList}

${seoBlock}

Return the JSON now.`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: lovableAiHeaders(apiKey),
      body: JSON.stringify({
        model,
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
    const b = basisFromEvidence(brand.totalEvidence, brand.hasOfficialSite, !!brand.seoSignals);
    for (const p of PLATFORMS_8) {
      scores[p] = clamp(parsed?.scores?.[p]);
      reasons[p] = String(parsed?.reasons?.[p] || "").slice(0, 220);
      basis[p] = b;
    }
    return { scores, reasons, basis };
  } catch (e) {
    console.warn("[platform-probe] failed for", brand.name, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Probe all brands in parallel — one strong AI call per brand returning
 * per-platform scores grounded in the supplied evidence.
 *
 * Uses `google/gemini-2.5-flash` by default for a good cost/accuracy
 * tradeoff. Caller can pass a stronger model for "deep" mode.
 */
export async function probeBrandsPerPlatform(
  brands: BrandEvidenceInput[],
  opts: { lang: Lang; market?: string; apiKey: string; model?: string },
): Promise<Record<string, BrandProbeResult>> {
  const model = opts.model || "google/gemini-2.5-flash";
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
