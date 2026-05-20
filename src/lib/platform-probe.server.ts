// Batched platform "recall" probe via Lovable AI Gateway.
// One cheap call (gemini-2.5-flash) returns 0-100 scores for each of the 8
// engines for every brand, grounded in the evidence summary we pass in.
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders, extractJsonObject } from "@/lib/lovable-ai";

type Lang = "en" | "ar" | "ku";

export const PLATFORMS_8 = ["chatgpt","gemini","claude","perplexity","copilot","grok","mistral","deepseek"] as const;
export type Platform8 = typeof PLATFORMS_8[number];

export type BrandEvidence = {
  name: string;
  hasOfficialSite: boolean;
  evidenceByKind: Record<string, number>;
  totalEvidence: number;
};

export type PlatformScores = Record<Platform8, number>;

function clamp(n: any): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

/**
 * Single batched call to estimate per-platform recall for every brand at once.
 * Returns null on failure (caller should fall back to deterministic derivation).
 */
export async function probeAllPlatformsBatch(
  brands: BrandEvidence[],
  lang: Lang,
  market: string | undefined,
  apiKey: string,
): Promise<Record<string, PlatformScores> | null> {
  if (brands.length === 0) return {};

  const langName = lang === "ar" ? "Arabic" : lang === "ku" ? "Kurdish (Sorani)" : "English";
  const evidenceBlock = brands.map((b) =>
    `- ${b.name}: official_site=${b.hasOfficialSite ? "yes" : "no"}, total_sources=${b.totalEvidence}, by_kind=${JSON.stringify(b.evidenceByKind)}`,
  ).join("\n");

  const sys = `You estimate how well 8 AI engines (ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek) would recall a brand based ONLY on the evidence summary provided. Each engine has a different bias:
- ChatGPT/Copilot: news + official + OpenGraph mentions.
- Gemini: schema.org, structured data, Google Business / geo presence, reviews.
- Claude: longform / official content, reputable citations.
- Perplexity: news + reviews + fresh citations.
- Grok: news + social-style buzz.
- Mistral: multilingual general web.
- DeepSeek: structured / technical content.

Score each engine 0-100 honestly. If a brand has zero evidence, scores must be very low (0-15). If it has many sources of the matching kind, the matching engine should be higher.
Return STRICT JSON only, no markdown, with this shape:
{ "<brand_name>": { "chatgpt": <0-100>, "gemini": <0-100>, "claude": <0-100>, "perplexity": <0-100>, "copilot": <0-100>, "grok": <0-100>, "mistral": <0-100>, "deepseek": <0-100> }, ... }`;

  const user = `Market: ${market || "global"}. Reply language hints: ${langName} (scores only, no prose).\n\nEvidence per brand:\n${evidenceBlock}\n\nReturn the JSON object now.`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: lovableAiHeaders(apiKey),
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data: any = await res.json();
    const content = String(data?.choices?.[0]?.message?.content || "{}");
    const parsed = extractJsonObject<Record<string, any>>(content);
    if (!parsed || typeof parsed !== "object") return null;

    const out: Record<string, PlatformScores> = {};
    for (const b of brands) {
      const raw = parsed[b.name] || parsed[b.name.toLowerCase()] || {};
      const scores = {} as PlatformScores;
      for (const p of PLATFORMS_8) scores[p] = clamp(raw?.[p]);
      out[b.name] = scores;
    }
    return out;
  } catch {
    return null;
  }
}
