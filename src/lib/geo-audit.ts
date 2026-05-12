// Pure client-side heuristics — ZERO AI calls.
// Detects what a GEO-citable text needs but is missing.

export type AuditCheck = {
  key: string;
  label: { ar: string; en: string; ku: string };
  hint: { ar: string; en: string; ku: string };
  passed: boolean;
};

const IRAQI_CITIES = [
  "بغداد","البصرة","بصرة","الموصل","موصل","أربيل","اربيل","هولير","السليمانية","سليمانية",
  "كركوك","النجف","نجف","كربلاء","الأنبار","الرمادي","تكريت","الديوانية","ديوانية","الكوت",
  "العمارة","الناصرية","ناصرية","السماوة","سماوة","بابل","الحلة","حلة","دهوك","ديالى","بعقوبة",
  "Baghdad","Basra","Mosul","Erbil","Hewler","Sulaymaniyah","Slemani","Kirkuk","Najaf","Karbala",
  "Anbar","Ramadi","Tikrit","Diwaniya","Kut","Amara","Nasiriyah","Samawa","Babylon","Hilla","Duhok","Diyala",
];

const DINAR_TOKENS = ["دينار","د.ع","IQD","iqd","Dinar","ألف دينار","مليون دينار","ID "];
const DATE_RE = /(20\d{2}|19\d{2}|٢٠\d{2})|(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
const NUMBER_RE = /\d+([.,]\d+)?\s*(%|٪|kg|كم|km|m²|متر|دقيقة|ساعة|يوم|شهر|سنة)?/;
const ENTITY_HINT_RE = /[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}|شركة\s+\S+|مؤسسة\s+\S+|جامعة\s+\S+|وزارة\s+\S+/;
const SOURCE_RE = /(https?:\/\/|www\.|المصدر|مصدر:|Source:|source:|وفقاً|according to)/i;

export function auditText(text: string): AuditCheck[] {
  const t = text || "";
  return [
    {
      key: "city",
      label: { ar: "مدينة/منطقة عراقية", en: "Iraqi city/area", ku: "شار/ناوچەی عێراقی" },
      hint:  { ar: "أضف اسم مدينة أو حي عراقي (مثال: الكرادة - بغداد).", en: "Add an Iraqi city/neighborhood name (e.g. Karrada, Baghdad).", ku: "ناوی شارێکی عێراقی زیاد بکە." },
      passed: IRAQI_CITIES.some((c) => t.includes(c)),
    },
    {
      key: "number",
      label: { ar: "أرقام ملموسة", en: "Concrete numbers", ku: "ژمارەی دیاریکراو" },
      hint:  { ar: "أضف رقماً (نسبة، عدد عملاء، مدة، مساحة...).", en: "Add a number (a percentage, count, duration, size).", ku: "ژمارەیەک زیاد بکە." },
      passed: NUMBER_RE.test(t),
    },
    {
      key: "dinar",
      label: { ar: "سعر بالدينار", en: "Price in IQD", ku: "نرخ بە دینار" },
      hint:  { ar: "اذكر سعراً واضحاً بالدينار العراقي (مثال: 25,000 د.ع).", en: "Mention a clear price in Iraqi Dinar (e.g. 25,000 IQD).", ku: "نرخێک بە دیناری عێراقی بنووسە." },
      passed: DINAR_TOKENS.some((d) => t.includes(d)),
    },
    {
      key: "date",
      label: { ar: "تاريخ/سنة", en: "Date / year", ku: "بەروار / ساڵ" },
      hint:  { ar: "أضف تاريخاً أو سنة (مثال: 2025).", en: "Add a date or year (e.g. 2025).", ku: "بەروار یان ساڵێک زیاد بکە." },
      passed: DATE_RE.test(t),
    },
    {
      key: "entity",
      label: { ar: "كيان مسمّى", en: "Named entity", ku: "ناوی پاراستراو" },
      hint:  { ar: "اذكر اسم شركة/علامة/شخصية/مؤسسة عراقية.", en: "Mention a company/brand/person/Iraqi institution by name.", ku: "ناوی کۆمپانیا/بازرگانی/کەسێک بنووسە." },
      passed: ENTITY_HINT_RE.test(t),
    },
    {
      key: "source",
      label: { ar: "مصدر / رابط", en: "Source / link", ku: "سەرچاوە / بەستەر" },
      hint:  { ar: "أضف مصدراً أو رابطاً يدعم الادعاءات.", en: "Add a source or link that backs your claims.", ku: "سەرچاوەیەک زیاد بکە." },
      passed: SOURCE_RE.test(t),
    },
  ];
}

export type ScoreReason = {
  metric: "authority" | "local" | "citation";
  weight: number;
  reasons: string[];
};

/** Map existing weaknesses/recommendations into the 3 metrics, locally — no AI. */
export function explainScoreDrops(args: {
  authority: number;
  local: number;
  citation: number;
  weaknesses?: string[];
  recommendations?: string[];
  lang: "ar" | "en" | "ku";
}): ScoreReason[] {
  const { authority, local, citation, weaknesses = [], recommendations = [], lang } = args;
  const txt = (s: string) => s.toLowerCase();
  const all = [...weaknesses, ...recommendations];

  const localKw = ["محل","عراق","مدين","حي","دينار","iraq","local","baghdad","basra","erbil","city","neighborhood"];
  const citationKw = ["استشهاد","اقتباس","مصدر","رابط","cit","source","quote","reference","link","fact"];
  const authorityKw = ["كيان","رقم","تاريخ","سلطة","auth","number","date","entity","expert","credential","depth","detail"];

  const bucket = (kws: string[]) =>
    all.filter((s) => kws.some((k) => txt(s).includes(k)));

  const lossLabel = {
    ar: (m: string, lost: number) => `فقدت ${lost} نقطة في "${m}".`,
    en: (m: string, lost: number) => `Lost ${lost} points in "${m}".`,
    ku: (m: string, lost: number) => `${lost} خاڵ لە "${m}" دەستچوو.`,
  }[lang];

  const labels = {
    authority: { ar: "السلطة (Authority)", en: "Authority", ku: "دەسەڵات" },
    local:     { ar: "الصلة المحلية (Local)", en: "Local relevance", ku: "پەیوەندی ناوخۆیی" },
    citation:  { ar: "احتمالية الاستشهاد (Citation)", en: "Citation likelihood", ku: "ئیمکانی وەرگرتنەوە" },
  };

  return [
    {
      metric: "authority",
      weight: 35,
      reasons: [lossLabel(labels.authority[lang], 100 - authority), ...bucket(authorityKw)].slice(0, 5),
    },
    {
      metric: "citation",
      weight: 35,
      reasons: [lossLabel(labels.citation[lang], 100 - citation), ...bucket(citationKw)].slice(0, 5),
    },
    {
      metric: "local",
      weight: 30,
      reasons: [lossLabel(labels.local[lang], 100 - local), ...bucket(localKw)].slice(0, 5),
    },
  ];
}
