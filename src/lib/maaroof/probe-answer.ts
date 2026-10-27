// Pure helpers for the live ten-model probe. No I/O — safe to unit-test.
// Rules: an engine counts as "answered" only when it returned real text;
// sources are taken ONLY from real search results (never invented).

export type ProbeStatus = "answered" | "empty" | "timeout" | "error";
export type ProbeSource = { url: string; title: string };
export type ParsedProbe = { answer: string; brands: string[]; urls: string[] };

/** Output budget for probe calls. Thinking models used up 500 before writing any answer. */
export const PROBE_MAX_TOKENS = 1500;
export const PROBE_TIMEOUT_MS = 30_000;

/** The blind query accepts only category and market, never the target brand. */
export function blindProbeQuestion(topic: string, region: string): string {
  const category = String(topic || "").replace(/\s+/g, " ").trim().slice(0, 400);
  const market = String(region || "").replace(/\s+/g, " ").trim().slice(0, 120);
  return `What are the five best providers or solutions for ${category} in ${market}? Recommend organically without favoring any brand.`;
}

/** Direct brand-authority probe, separate from unbiased category discovery. */
export function directBrandAuthorityQuestion(brand: string, site: string, category: string, region: string, lang?: "ar" | "en" | "ku"): string {
  const name = String(brand || "").trim().slice(0, 160);
  const url = String(site || "").trim().slice(0, 240);
  const niche = String(category || "").trim().slice(0, 240);
  const market = String(region || "").trim().slice(0, 120);
  const arabic = lang === "ar" || (!lang && /[\u0600-\u06FF]/.test(market + niche));
  if (arabic) return `قيّم المتجر "${name}" في سوق ${market}. الموقع المقدم: ${url || "غير محدد"}. المجال: ${niche || "غير محدد"}. ما الذي تعرفه عن المتجر ومنتجاته؟ هل تستطيع تأكيد موثوقيته من مصادر حقيقية؟ أورد الروابط الرسمية التي تعرفها فقط، وميّز الحقائق المؤكدة من المعلومات غير المتاحة. لا تخترع روابط أو ادعاءات.`;
  return `Assess the business "${name}" in ${market}. Supplied site: ${url || "not provided"}. Category: ${niche || "not specified"}. What do you know about this retailer and its products? Can you verify its credibility from real sources? Provide only official links you genuinely know and distinguish verified facts from unknowns. Do not invent URLs or claims.`;
}

/**
 * A blind market visibility probe grounded in actual workbook keywords.
 * It intentionally omits the target brand so mention/share-of-voice is not primed.
 */
export function keywordVisibilityProbeQuestion(topic: string, region: string, keywords: string[] = []): string {
  const category = String(topic || "").replace(/\s+/g, " ").trim().slice(0, 240) || "the products or services in the uploaded workbook";
  const market = String(region || "").replace(/\s+/g, " ").trim().slice(0, 120);
  const phrases = [...new Set(keywords.map((value) => String(value || "").trim()).filter(Boolean))].slice(0, 8);
  const keywordContext = phrases.length
    ? "Actual search phrases from the uploaded workbook: " + phrases.map((value) => '"' + value.slice(0, 180) + '"').join(", ") + "."
    : "Use the category to understand the search context.";
  const arabic = /[\u0600-\u06FF]/.test(market + category + phrases.join(" "));
  if (arabic) return `في سوق ${market}، يبحث العميل عن ${category}. ${phrases.length ? "عبارات البحث الفعلية: " + phrases.map((value) => '"' + value.slice(0, 180) + '"').join("، ") + "." : "استخدم المجال لفهم سياق البحث."} ما العلامات التجارية والمتاجر المتخصصة ذات الصلة بهذه المنتجات تحديداً التي توصي بها، ولماذا؟ لا تنتقل إلى أدوات SEO أو وكالات التسويق ما لم تكن عبارات البحث تتعلق بها صراحةً. أجب بصيغة JSON تتضمن answer وbrands وurls، ولا تخترع روابط.`;
  return "In " + market + ", a customer is searching in this product/service category: " + category + ". " + keywordContext + " Based only on your existing knowledge, which relevant brands, product providers, retailers, or websites would you naturally recommend? Keep recommendations relevant to these products or services; do not switch to SEO tools or marketing agencies unless the search phrases are explicitly about those services. Reply as JSON {\\"answer\\": string, \\"brands\\": string[], \\"urls\\": string[]}. Do not invent URLs; include URLs only when you know them to be real.";
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
  const fromField: string[] = Array.isArray(obj?.urls) ? obj.urls.map((x: any) => String(x)) : [];
  const fromText = answer.match(/https?:\/\/[^\s)"'<>\]]+/g) || [];
  const urls = Array.from(new Set([...fromField, ...fromText].map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u)))).slice(0, 8);
  return { answer, brands, urls };
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
