/** Pure: replaces external provider names with Maaroof AI labels in user-facing text. */
const RULES: Array<[RegExp, string, string]> = [
  [/طبقة\s+الإسكندرية|الإسكندرية|الاسكندرية/g, "طبقة الأدلة والبيانات المهيكلة", "طبقة الأدلة والبيانات المهيكلة"],
  [/alexandria(\s+(layer|evidence))?/gi, "Structured Evidence & Data Layer", "طبقة الأدلة والبيانات المهيكلة"],
  [/فاير\s*كرول/g, "محرك استخراج الأدلة الرقمية الموثقة", "محرك استخراج الأدلة الرقمية الموثقة"],
  [/fire\s*crawl/gi, "Verified Digital Evidence Engine", "محرك استخراج الأدلة الرقمية الموثقة"],
  [/أوبن\s*راوتر/g, "مجلس محركات الذكاء الاصطناعي", "مجلس محركات الذكاء الاصطناعي"],
  [/open\s*router/gi, "AI Engine Council", "مجلس محركات الذكاء الاصطناعي"],
];

export function sanitizeProviderNames(text: string, lang: "ar" | "en" = "en"): string {
  let out = String(text ?? "");
  for (const [re, en, ar] of RULES) out = out.replace(re, lang === "ar" ? ar : en);
  return out;
}

/** Deep-sanitizes every string inside a JSON-safe value; URLs are kept untouched. */
export function sanitizeDeep<T>(value: T, lang: "ar" | "en" = "en"): T {
  const walk = (v: any): any => {
    if (typeof v === "string") return /^https?:\/\//i.test(v) ? v : sanitizeProviderNames(v, lang);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o: any = {};
      for (const k of Object.keys(v)) o[k] = walk(v[k]);
      return o;
    }
    return v;
  };
  return walk(value);
}

export function hasProviderNames(text: string): boolean {
  return RULES.some(([re]) => new RegExp(re.source, re.flags).test(text));
}
