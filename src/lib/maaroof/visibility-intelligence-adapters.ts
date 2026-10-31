/**
 * Adapters for the existing operational workbook/probe data.
 * These helpers do not issue network requests; they preserve the provenance
 * already recorded by the current workflow and mark unsupported records as unmeasured.
 */
import type { VisibilityObservation, ObservationStatus, VisibilityScope } from "./visibility-intelligence";

export type RecordedEngineAnswer = {
  market: string;
  engine: string;
  status: "answered" | "no_answer" | "empty" | "timeout" | "http_error" | "error";
  answer: string;
  urls: string[];
  query?: string;
  error?: string;
  provider_path?: "primary" | "fallback";
  model_used?: string;
  cacheHit?: boolean;
};

export type VisibilityQueryKind =
  | "blind_discovery"
  | "brand_recognition"
  | "recommendation"
  | "comparison"
  | "fact_verification"
  | "purchase_intent";

export type VisibilityQuery = {
  id: string;
  kind: VisibilityQueryKind;
  prompt: string;
  stable: boolean;
  audienceLanguage: string;
  geography: string;
};

const normalize = (s: string) => String(s ?? "").trim().replace(/\s+/g, " ");

const templates: Record<VisibilityQueryKind, Record<string, (brand: string, category: string, market: string, site: string) => string>> = {
  blind_discovery: {
    en: (_b,c,m) => `In ${m}, what brands or providers would you naturally recommend for ${c}? Do not assume any brand; explain the basis and do not invent sources.`,
    ar: (_b,c,m) => `في سوق ${m}، ما العلامات أو الجهات التي توصي بها طبيعيًا ضمن فئة ${c}؟ لا تفترض علامة مسبقًا، ووضح أساس التوصية ولا تختلق مصادر.`,
    ku: (_b,c,m) => `لە بازاڕی ${m}، بۆ بواری ${c} کام براند یان دابینکەر بە شێوەیەکی سروشتی پێشنیار دەکەیت؟ سەرچاوە دروست مەکە.`,
  },
  brand_recognition: {
    en: (b,_c,m,s) => `What can you verify about ${b} (official website: ${s}) for the ${m} market? Separate verified facts from unknowns and do not infer availability.`,
    ar: (b,_c,m,s) => `ما المعلومات التي يمكن التحقق منها عن ${b} (الموقع الرسمي: ${s}) في سوق ${m}؟ افصل الحقائق المتحققة عن المجهول ولا تفترض التوافر.`,
    ku: (b,_c,m,s) => `دەربارەی ${b} (ماڵپەڕی فەرمی: ${s}) لە بازاڕی ${m} چی دەتوانرێت پشتڕاست بکرێتەوە؟ زانیاریی پشتڕاستکراو لە نەزانراو جیا بکەرەوە.`,
  },
  recommendation: {
    en: (b,c,m) => `For a customer in ${m} looking for ${c}, would you recommend ${b}? Explain the fit and limitations; do not claim facts without evidence.`,
    ar: (b,c,m) => `لعميل في سوق ${m} يبحث عن ${c}، هل توصي بـ${b}؟ وضّح مدى الملاءمة والقيود، ولا تعرض ادعاءات بلا دليل.`,
    ku: (b,c,m) => `بۆ کڕیارێک لە بازاڕی ${m} کە بەدوای ${c} دەگەڕێت، ئایا ${b} پێشنیار دەکەیت؟ گونجاوی و سنوورەکان ڕوون بکەرەوە.`,
  },
  comparison: {
    en: (b,c,m) => `Compare ${b} with relevant alternatives for ${c} in ${m}. State the criteria and identify unknown or unverified facts.`,
    ar: (b,c,m) => `قارن ${b} بالبدائل المناسبة لفئة ${c} في سوق ${m}. اذكر معايير المقارنة وحدد المعلومات المجهولة أو غير المتحققة.`,
    ku: (b,c,m) => ` ${b} لەگەڵ هەڵبژاردە گونجاوەکان بۆ ${c} لە بازاڕی ${m} بەراورد بکە و زانیاریی پشتڕاستنەکراو دیاری بکە.`,
  },
  fact_verification: {
    en: (b,_c,m,s) => `For ${b} in ${m}, assess which claims about its products, official presence, shipping and availability can be verified from ${s}. Mark missing evidence explicitly.`,
    ar: (b,_c,m,s) => `بالنسبة إلى ${b} في سوق ${m}، حدد ما يمكن التحقق منه عن المنتجات والحضور الرسمي والشحن والتوافر بالاستناد إلى ${s}. اذكر الأدلة الناقصة صراحة.`,
    ku: (b,_c,m,s) => `بۆ ${b} لە بازاڕی ${m}، ئەو زانیارییانە دیاری بکە کە لە ${s} دەربارەی بەرهەم، بوونی فەرمی، گەیاندن و بەردەستبوون پشتڕاست دەکرێنەوە.`,
  },
  purchase_intent: {
    en: (b,c,m) => `A customer in ${m} intends to buy ${c}. What evidence supports or weakens considering ${b}? Do not assume it serves this market.`,
    ar: (b,c,m) => `عميل في سوق ${m} ينوي شراء ${c}. ما الأدلة التي تدعم أو تضعف اختيار ${b}؟ لا تفترض أن العلامة تخدم هذا السوق.`,
    ku: (b,c,m) => `کڕیارێک لە بازاڕی ${m} دەیەوێت ${c} بکڕێت. چ بەڵگەیەک پشتگیری یان لاوازیی هەڵبژاردنی ${b} دەکات؟ گومان مەکە کە براندەکە ئەم بازاڕە دەخاتە خزمەت.`,
  },
};

export function buildVisibilityQueries(scopeInput: VisibilityScope, categoryInput: string): VisibilityQuery[] {
  const brand = normalize(scopeInput.brandName);
  const market = normalize(scopeInput.geography);
  const site = normalize(scopeInput.officialWebsite);
  const language = normalize(scopeInput.audienceLanguage).toLowerCase().split("-")[0];
  const category = normalize(categoryInput);
  if (!brand || !site || !market || !language) throw new Error("A normalized visibility scope is required.");
  if (!category) throw new Error("A verified or user-provided category is required; do not guess it.");
  if (!["ar", "en", "ku"].includes(language)) throw new Error("Visibility query templates are currently supported only for ar, en, and ku; refusing to silently run English prompts for another audience language.");
  const lang = language;
  const kinds: VisibilityQueryKind[] = ["blind_discovery","brand_recognition","recommendation","comparison","fact_verification","purchase_intent"];
  return kinds.map((kind) => ({
    id: `visibility:${kind}:v1:${lang}`,
    kind,
    prompt: templates[kind][lang](brand, category, market, site),
    stable: true,
    audienceLanguage: language,
    geography: market,
  }));
}

/**
 * Adapt existing operational workbook records. Fallback-provider answers are
 * deliberately not marked as direct engine observations; callers may separately
 * report them as auxiliary analysis. No URL is treated as independently verified.
 */
export function adaptRecordedEngineAnswers(
  answers: RecordedEngineAnswer[],
  options: { planned: number; queryIdFor: (answer: RecordedEngineAnswer, index: number) => string },
): { observations: VisibilityObservation[]; planned: number; excludedFallback: number } {
  const observations: VisibilityObservation[] = [];
  let excludedFallback = 0;
  answers.forEach((answer, index) => {
    if (answer.provider_path === "fallback") {
      excludedFallback += 1;
      return;
    }
    const status: ObservationStatus =
      answer.status === "answered" && answer.answer.trim() ? "answered" :
      answer.status === "timeout" ? "timeout" :
      answer.status === "empty" || answer.status === "no_answer" ? "empty" :
      answer.status === "http_error" || answer.status === "error" ? "error" : "not_run";
    observations.push({
      engine: answer.engine,
      queryId: options.queryIdFor(answer, index),
      status,
      answer: status === "answered" ? answer.answer : null,
      recommended: null,
      rankPosition: null,
      brands: [],
      observedAt: "not-recorded",
      provider: answer.provider_path === "primary" ? "primary-route" : null,
      model: answer.model_used ?? null,
    });
  });
  return { observations, planned: Math.max(0, Math.floor(options.planned)), excludedFallback };
}
