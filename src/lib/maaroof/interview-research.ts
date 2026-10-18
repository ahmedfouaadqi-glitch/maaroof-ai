import type { InterviewDomain, InterviewState, InterviewTargetType } from "@/lib/maaroof/interview-engine";

export type InterviewResearchInput = {
  targetType: InterviewTargetType;
  targetName: string;
  goal?: string | null;
  domains: InterviewDomain[];
  locale: "ar" | "en" | "ku";
  state: InterviewState;
};

const SEARCHABLE_ANSWER_IDS = new Set([
  "audience",
  "company_offering",
  "agency_services",
  "brand_offering",
  "client_outcome",
  "seo_property",
  "seo_search_goal",
  "aeo_questions",
  "aeo_facts",
  "geo_queries",
  "geo_engines",
]);

const DOMAIN_TERMS: Record<InterviewDomain, Record<InterviewResearchInput["locale"], string>> = {
  general: { ar: "معلومات عامة ومصادر موثوقة", en: "overview and reliable sources", ku: "زانیاری گشتی و سەرچاوەی باوەڕپێکراو" },
  seo: { ar: "تدقيق SEO وتحسين الظهور في البحث", en: "SEO audit and organic search visibility", ku: "پشکنینی SEO و دەرکەوتن لە گەڕانی ئۆرگانیک" },
  aeo: { ar: "أسئلة الجمهور والإجابات الموثوقة AEO", en: "audience questions and reliable AEO answers", ku: "پرسیارەکانی جەماوەر و وەڵامی باوەڕپێکراوی AEO" },
  geo: { ar: "ظهور العلامة التجارية في إجابات الذكاء الاصطناعي GEO", en: "brand visibility in AI-generated answers GEO", ku: "دەرکەوتنی براند لە وەڵامە زایەندەکانی AI GEO" },
  gseo: { ar: "رحلة البحث وتجربة البحث التوليدي", en: "search journey and generative search experience", ku: "ڕێڕەوی گەڕان و ئەزموونی گەڕانی زایەندە" },
};

function asSearchText(value: unknown, max = 180): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Build a bounded query from completed interview context without sending the full answer history. */
export function buildInterviewResearchQuery(input: InterviewResearchInput): string {
  const parts: string[] = [];
  if (["company", "agency", "client", "brand", "creator"].includes(input.targetType)) {
    parts.push(asSearchText(input.targetName, 100));
  }
  if (input.goal) parts.push(asSearchText(input.goal, 100));
  for (const id of SEARCHABLE_ANSWER_IDS) {
    const answer = input.state.answers[id];
    if (answer?.status !== "answered") continue;
    const value = Array.isArray(answer.value) ? answer.value.join(", ") : answer.value;
    const text = asSearchText(value, 100);
    if (text && !parts.includes(text)) parts.push(text);
    if (parts.join(" ").length > 210) break;
  }
  const selectedDomains = input.domains.length ? input.domains : ["general"];
  parts.push(...selectedDomains.slice(0, 3).map((domain) => DOMAIN_TERMS[domain][input.locale]));
  parts.push(input.locale === "en" ? "official sources" : input.locale === "ku" ? "سەرچاوە فەرمییەکان" : "مصادر رسمية");
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 300);
}

export type InterviewResearchSource = {
  title: string;
  url: string;
  domain: string;
  description: string;
  snippet: string;
};

/** Normalize Firecrawl's current and legacy search response shapes and discard unsafe URLs. */
export function normalizeInterviewResearchSources(payload: unknown, limit = 8): InterviewResearchSource[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const data = root.data;
  const candidates: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? [ ...((Array.isArray((data as Record<string, unknown>).web) ? (data as Record<string, unknown>).web : []) as unknown[]), ...((Array.isArray((data as Record<string, unknown>).news) ? (data as Record<string, unknown>).news : []) as unknown[]) ]
      : Array.isArray(root.results) ? root.results : Array.isArray(root.web) ? root.web as unknown[] : [];
  const seen = new Set<string>();
  const sources: InterviewResearchSource[] = [];
  for (const item of candidates) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    let parsed: URL;
    try { parsed = new URL(String(row.url || "")); } catch { continue; }
    if (parsed.protocol !== "https:" || seen.has(parsed.href)) continue;
    seen.add(parsed.href);
    sources.push({
      title: asSearchText(row.title, 240) || parsed.hostname,
      url: parsed.href,
      domain: parsed.hostname.replace(/^www\./, ""),
      description: asSearchText(row.description, 500),
      snippet: asSearchText(row.markdown, 1200),
    });
    if (sources.length >= Math.max(1, Math.min(limit, 8))) break;
  }
  return sources;
}
