// Pure helpers for the live ten-model probe. No I/O — safe to unit-test.
// Rules: an engine counts as "answered" only when it returned real text;
// sources are taken ONLY from real search results (never invented).

export type ProbeStatus = "answered" | "empty" | "timeout" | "error";
export type ProbeSource = { url: string; title: string };
export type ParsedQueryObservation = { kind: string; answer: string; brands: string[]; urls: string[] };
export type ParsedProbe = { answer: string; brands: string[]; urls: string[]; query_observations?: ParsedQueryObservation[] };

/** Output budget for probe calls. Thinking models used up 500 before writing any answer. */
export const PROBE_MAX_TOKENS = 1500;
export const PROBE_TIMEOUT_MS = 30_000;

/** The blind query accepts only category and market, never the target brand. */
export function blindProbeQuestion(topic: string, region: string): string {
  const category = String(topic || "").replace(/\s+/g, " ").trim().slice(0, 400);
  const market = String(region || "").replace(/\s+/g, " ").trim().slice(0, 120);
  return `What are the five best providers or solutions for ${category} in ${market}? Recommend organically without favoring any brand.`;
}

/**
 * A blind market visibility probe grounded in actual workbook keywords.
 * It intentionally omits the target brand so mention/share-of-voice is not primed.
 */
export type ProbeLanguage = "ar" | "en" | "ku" | "fr" | "de" | "es";

/**
 * Build a blind model-visibility prompt in the selected content language.
 * Keyword text is preserved as supplied; target market remains a separate input.
 */
export function keywordVisibilityProbeQuestion(
  topic: string,
  region: string,
  keywords: string[] = [],
  contentLanguage: ProbeLanguage = "en",
): string {
  const category = String(topic || "").replace(/\\s+/g, " ").trim().slice(0, 240) || "the products or services in the uploaded workbook";
  const market = String(region || "").replace(/\\s+/g, " ").trim().slice(0, 120);
  const phrases = [...new Set(keywords.map((value) => String(value || "").trim()).filter(Boolean))].slice(0, 8);
  const keywordContext = phrases.length
    ? phrases.map((value) => '"' + value.slice(0, 180) + '"' ).join(", ")
    : category;
  const prompts: Record<ProbeLanguage, string> = {
    en: "In " + market + ", a customer searches in this category: " + category + ". Actual phrases: " + keywordContext + ". Based only on existing knowledge, which relevant brands, providers, retailers, or websites would you naturally recommend? Stay within the category; do not recommend SEO agencies unless the phrases request them. Reply as JSON {\"answer\": string, \"brands\": string[], \"urls\": string[]}. Do not invent URLs.",
    ar: "في سوق " + market + "، يبحث العميل ضمن هذا التخصص: " + category + ". عبارات البحث الفعلية: " + keywordContext + ". بناءً على معرفتك فقط، ما العلامات أو المزودين أو المتاجر أو المواقع التي توصي بها طبيعياً؟ التزم بالتخصص ولا تقترح وكالات SEO إلا إذا كانت العبارات تطلب ذلك. أجب بالعربية بتنسيق JSON {\"answer\": string, \"brands\": string[], \"urls\": string[]}. لا تختلق روابط.",
    ku: "لە بازاڕی " + market + "، کڕیارێک لەم بوارەدا دەگەڕێت: " + category + ". دەستەواژە ڕاستەقینەکان: " + keywordContext + ". تەنها لەسەر زانیاریی خۆت، کام براند و دابینکەر و فرۆشگا پێشنیار دەکەیت؟ لە بوارەکەدا بمێنەوە و URL دروست مەکە. JSON: {\"answer\": string, \"brands\": string[], \"urls\": string[]}.",
    fr: "Sur le marché " + market + ", un client recherche dans cette catégorie : " + category + ". Requêtes réelles : " + keywordContext + ". Selon vos connaissances, quelles marques, quels fournisseurs ou sites recommanderiez-vous naturellement ? Restez dans la catégorie et n’inventez pas d’URL. Répondez en français au format JSON {\"answer\": string, \"brands\": string[], \"urls\": string[]}.",
    de: "Im Markt " + market + " sucht ein Kunde in dieser Kategorie: " + category + ". Tatsächliche Suchbegriffe: " + keywordContext + ". Welche passenden Marken, Anbieter oder Websites würden Sie anhand Ihres Wissens empfehlen? Bleiben Sie bei der Kategorie und erfinden Sie keine URLs. Antworten Sie auf Deutsch als JSON {\"answer\": string, \"brands\": string[], \"urls\": string[]}.",
    es: "En el mercado " + market + ", un cliente busca en esta categoría: " + category + ". Consultas reales: " + keywordContext + ". Según su conocimiento, ¿qué marcas, proveedores o sitios recomendaría de forma natural? Manténgase en la categoría y no invente URL. Responda en español en JSON {\"answer\": string, \"brands\": string[], \"urls\": string[]}.",
  };
  return prompts[contentLanguage] || prompts.en;
}

/** Parse a model reply. Returns null when there is no usable answer text. */
export function parseProbeContent(content: unknown): ParsedProbe | null {
  const raw = typeof content === "string" ? content.trim() : "";
  if (!raw) return null;
  let obj: any = null;
  const fenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { obj = JSON.parse(fenced); } catch {
    const m = fenced.match(/\{[\s\S]*\}/);
    if (m) { try { obj = JSON.parse(m[0]); } catch { obj = null; } }
  }
  const answer = String(obj && typeof obj === "object" ? obj.answer ?? "" : fenced).replace(/\s+/g, " ").trim().slice(0, 900);
  if (!answer) return null;
  const brands: string[] = Array.isArray(obj?.brands) ? obj.brands.map((x: any) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 8) : [];
  const query_observations: ParsedQueryObservation[] = Array.isArray(obj?.query_observations)
    ? obj.query_observations.slice(0, 5).map((item: any) => ({
        kind: String(item?.kind || "").trim().slice(0, 40),
        answer: String(item?.answer || "").replace(/\s+/g, " ").trim().slice(0, 600),
        brands: Array.isArray(item?.brands) ? item.brands.map((x: any) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 8) : [],
        urls: Array.isArray(item?.urls) ? item.urls.map((x: any) => String(x).trim()).filter((url: string) => /^https?:\/\//i.test(url)).slice(0, 6) : [],
      })).filter((item: ParsedQueryObservation) => item.kind && item.answer)
    : [];
  const fromField: string[] = Array.isArray(obj?.urls) ? obj.urls.map((x: any) => String(x)) : [];
  const fromText = answer.match(/https?:\/\/[^\s)"'< >\]]+/g) || [];
  const nestedUrls = query_observations.flatMap((item) => item.urls);
  const urls = Array.from(new Set([...fromField, ...fromText, ...nestedUrls].map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u)))).slice(0, 8);
  return { answer, brands, urls, query_observations };
}

export function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

/**
 * Link an answer to real sources: a search result is attached when the answer
 * cites its domain/URL, or names a brand that appears in that result's title.
 * Nothing outside `searchItems` can ever be returned.
 */
export function linkSources(p: ParsedProbe, searchItems: ProbeSource[], max = 4): ProbeSource[] {
  const cited = new Set(p.urls.map(hostOf).filter(Boolean));
  const text = `${p.answer} ${p.brands.join(" ")}`.toLowerCase();
  const out: ProbeSource[] = [];
  for (const it of searchItems) {
    const h = hostOf(it.url);
    if (!h) continue;
    const brandHit = p.brands.some((b) => b.length > 2 && it.title.toLowerCase().includes(b.toLowerCase()));
    if (cited.has(h) || text.includes(h) || brandHit) {
      if (!out.some((o) => o.url === it.url)) out.push({ url: it.url, title: it.title });
    }
    if (out.length >= max) break;
  }
  return out;
}

/** Tokens to give back when only some engines answered (charge answered engines only). */
export function probeRefund(chargedTokens: number, asked: number, answered: number): number {
  const c = Math.max(0, Number(chargedTokens) || 0);
  if (asked <= 0 || c === 0) return 0;
  const a = Math.min(Math.max(0, answered), asked);
  return Math.round((c * (asked - a)) / asked);
}

/** Refund uncompleted blind/grounded call units; each successful phase is billable. */
export function probePhaseRefund(
  chargedTokens: number,
  askedUnits: number,
  completedUnits: number,
): number {
  return probeRefund(chargedTokens, askedUnits, completedUnits);
}

/** Visibility inputs the agent may pass. Background mode is never allowed inside a task. */
export function stripAgentOnlyFields<T extends Record<string, any>>(tool: string, input: T): T {
  if (tool !== "visibility" || !input) return input;
  const { background: _b, ...rest } = input as any;
  return rest as T;
}

/** Split engines into small batches so the ten-model probe never fires all at once. */
export function probeBatches<T>(items: T[], size = 3): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}
