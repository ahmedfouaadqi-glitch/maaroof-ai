// Pure client-side heuristics — ZERO AI calls.
// Detects what a GEO-citable text needs but is missing for the selected geographic scope.

export type GeoScope = { scope: "world" | "country" | "city" | "province"; country?: string; city?: string };

export type AuditCheck = {
  key: string;
  label: { ar: string; en: string; ku: string };
  hint: { ar: string; en: string; ku: string };
  passed: boolean;
};

const GLOBAL_MARKERS = [
  "global", "worldwide", "international", "multi-region", "أوروبا", "آسيا", "أمريكا", "العالم", "عالمي",
  "دولي", "جمهور عالمي", "جیهانی", "نێودەوڵەتی",
];

const IRAQ_MARKERS = [
  "العراق", "عراقي", "بغداد", "البصرة", "بصرة", "الموصل", "موصل", "أربيل", "اربيل", "هولير", "السليمانية", "سليمانية",
  "كركوك", "النجف", "نجف", "كربلاء", "الأنبار", "الرمادي", "تكريت", "الديوانية", "ديوانية", "الكوت",
  "العمارة", "الناصرية", "ناصرية", "السماوة", "سماوة", "بابل", "الحلة", "حلة", "دهوك", "ديالى", "بعقوبة",
  "Iraq", "Iraqi", "Baghdad", "Basra", "Mosul", "Erbil", "Hewler", "Sulaymaniyah", "Slemani", "Kirkuk", "Najaf",
  "Karbala", "Anbar", "Ramadi", "Tikrit", "Diwaniya", "Kut", "Amara", "Nasiriyah", "Samawa", "Babylon", "Hilla", "Duhok", "Diyala",
];

const CURRENCY_TOKENS = [
  "دينار", "د.ع", "IQD", "iqd", "Dinar", "ألف دينار", "مليون دينار",
  "USD", "$", "EUR", "€", "GBP", "£", "SAR", "ريال", "AED", "درهم", "TRY", "ليرة",
];

const DATE_RE = /(20\d{2}|19\d{2}|٢٠\d{2})|(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
const NUMBER_RE = /\d+([.,]\d+)?\s*(%|٪|kg|كم|km|m²|متر|دقيقة|ساعة|يوم|شهر|سنة|عميل|مستخدم|فرع|طلب)?/;
const ENTITY_HINT_RE = /[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}|شركة\s+\S+|مؤسسة\s+\S+|جامعة\s+\S+|وزارة\s+\S+|منظمة\s+\S+|علامة\s+\S+/;
const SOURCE_RE = /(https?:\/\/|www\.|المصدر|مصدر:|Source:|source:|وفقاً|بحسب|according to|cited by|رابط)/i;

function normalize(s?: string) {
  return (s || "").trim().toLowerCase();
}

function scopeLabel(scope?: GeoScope) {
  if (!scope || !scope.scope) return { ar: "النطاق الجغرافي", en: "geographic scope", ku: "سنوری جوگرافی" };
  const place = [scope.city, scope.country].filter(Boolean).join("، ") || scope.country || scope.city || "";
  if (scope.scope === "world") return { ar: "الجمهور العالمي", en: "global audience", ku: "بینەری جیهانی" };
  if (scope.scope === "country") return { ar: place || "الدولة المختارة", en: place || "selected country", ku: place || "وڵاتی هەڵبژێردراو" };
  if (scope.scope === "province") return { ar: place || "المحافظة/الإقليم المختار", en: place || "selected province/region", ku: place || "پارێزگا/هەرێمی هەڵبژێردراو" };
  return { ar: place || "المدينة المختارة", en: place || "selected city", ku: place || "شاری هەڵبژێردراو" };
}

function hasScopeSignal(text: string, scope?: GeoScope) {
  const hay = normalize(text);
  if (!scope || !scope.scope) return IRAQ_MARKERS.some((m) => hay.includes(normalize(m)));
  if (scope.scope === "world") return GLOBAL_MARKERS.some((m) => hay.includes(normalize(m))) || /(north america|europe|middle east|gcc|mena|global|worldwide)/i.test(text);

  const wanted = [scope.country, scope.city].filter(Boolean).map(normalize);
  if (wanted.length && wanted.some((w) => hay.includes(w))) return true;

  if (scope.country && normalize(scope.country).includes("iraq")) {
    return IRAQ_MARKERS.some((m) => hay.includes(normalize(m)));
  }
  return false;
}

export function auditText(text: string, scope?: GeoScope): AuditCheck[] {
  const t = text || "";
  const place = scopeLabel(scope);
  return [
    {
      key: "scope",
      label: { ar: `إشارة واضحة إلى ${place.ar}`, en: `Clear signal for ${place.en}`, ku: `ئاماژەی ڕوون بۆ ${place.ku}` },
      hint:  { ar: `أضف اسماً واضحاً مرتبطاً بـ ${place.ar} (دولة/مدينة/منطقة/جمهور).`, en: `Add a clear location/audience signal tied to ${place.en}.`, ku: `ئاماژەی شوێن/بینەر زیاد بکە بۆ ${place.ku}.` },
      passed: hasScopeSignal(t, scope),
    },
    {
      key: "number",
      label: { ar: "أرقام حقيقية من النص", en: "Real numbers from the text", ku: "ژمارەی ڕاست لە دەقەکە" },
      hint:  { ar: "أضف رقماً موثقاً تعرفه فعلاً (نسبة، عدد عملاء، مدة، مساحة...).", en: "Add a verified number you actually know (percentage, count, duration, size).", ku: "ژمارەی پشتڕاستکراوە زیاد بکە." },
      passed: NUMBER_RE.test(t),
    },
    {
      key: "currency",
      label: { ar: "سعر/تكلفة بعملة النطاق", en: "Price/cost in scope currency", ku: "نرخ/تێچوو بە دراوی سنوور" },
      hint:  { ar: "اذكر سعراً أو نطاق تكلفة حقيقياً بالعملة المناسبة للنطاق الجغرافي.", en: "Mention a real price or cost range in the currency relevant to the selected scope.", ku: "نرخ یان مەودای تێچووی ڕاست زیاد بکە." },
      passed: CURRENCY_TOKENS.some((d) => t.includes(d)),
    },
    {
      key: "date",
      label: { ar: "تاريخ/سنة موثقة", en: "Verified date / year", ku: "بەروار / ساڵی پشتڕاستکراو" },
      hint:  { ar: "أضف تاريخاً أو سنة حقيقية مرتبطة بالمعلومة.", en: "Add a real date or year tied to the claim.", ku: "بەروار یان ساڵێکی ڕاست زیاد بکە." },
      passed: DATE_RE.test(t),
    },
    {
      key: "entity",
      label: { ar: "كيان مسمّى حقيقي", en: "Real named entity", ku: "ناوی ڕاستی دامەزراوە/کەس" },
      hint:  { ar: "اذكر اسم شركة/علامة/شخصية/مؤسسة حقيقية مرتبطة بالنطاق.", en: "Mention a real company, brand, person, or institution tied to the scope.", ku: "ناوی کۆمپانیا/نیشان/کەسێکی ڕاست بنووسە." },
      passed: ENTITY_HINT_RE.test(t),
    },
    {
      key: "source",
      label: { ar: "مصدر / رابط قابل للتحقق", en: "Verifiable source / link", ku: "سەرچاوە / بەستەری پشتڕاستکراو" },
      hint:  { ar: "أضف مصدراً أو رابطاً يدعم الادعاءات؛ لا تعتمد على أرقام غير موثقة.", en: "Add a source or link backing the claims; do not rely on unverified numbers.", ku: "سەرچاوەیەک زیاد بکە؛ پشت بە ژمارەی بێ سەرچاوە مەبەستە." },
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

  const localKw = ["محل","نطاق","جغرافي","دولة","مدين","حي","عملة","iraq","local","country","region","city","neighborhood","scope","market"];
  const citationKw = ["استشهاد","اقتباس","مصدر","رابط","موثق","cit","source","quote","reference","link","fact","verified","evidence"];
  const authorityKw = ["كيان","رقم","تاريخ","سلطة","حقيقي","auth","number","date","entity","expert","credential","depth","detail","real"];

  const bucket = (kws: string[]) =>
    all.filter((s) => kws.some((k) => txt(s).includes(k)));

  const lossLabel = {
    ar: (m: string, lost: number) => `فقدت ${lost} نقطة في "${m}".`,
    en: (m: string, lost: number) => `Lost ${lost} points in "${m}".`,
    ku: (m: string, lost: number) => `${lost} خاڵ لە "${m}" دەستچوو.`,
  }[lang];

  const labels = {
    authority: { ar: "السلطة (Authority)", en: "Authority", ku: "دەسەڵات" },
    local:     { ar: "الصلة الجغرافية (Local)", en: "Geographic relevance", ku: "پەیوەندی جوگرافی" },
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
