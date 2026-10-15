// Architecture & Concept: Ahmed Maaroof
// Pure natural-language timeframe parser (ar / en / ku). No fixed durations.

export type TimeUnit = "hours" | "days" | "weeks" | "months" | "years";
export type Timeframe = { raw: string; count: number; unit: TimeUnit; hours: number };

const WORD_NUM: Record<string, number> = {
  "واحد": 1, "واحدة": 1, "اثنين": 2, "اثنان": 2, "ثلاث": 3, "ثلاثة": 3, "اربع": 4, "أربع": 4, "اربعة": 4, "أربعة": 4,
  "خمس": 5, "خمسة": 5, "ست": 6, "ستة": 6, "سبع": 7, "سبعة": 7, "ثمان": 8, "ثمانية": 8, "تسع": 9, "تسعة": 9,
  "عشر": 10, "عشرة": 10, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
  "eight": 8, "nine": 9, "ten": 10, "twelve": 12, "يەک": 1, "دوو": 2, "سێ": 3, "چوار": 4, "پێنج": 5, "شەش": 6,
};

const UNITS: Array<[RegExp, TimeUnit]> = [
  [/(ساعة|ساعات|ساعه|hours?|hrs?|کاتژمێر)/i, "hours"],
  [/(يوم|أيام|ايام|days?|ڕۆژ)/i, "days"],
  [/(أسبوع|اسبوع|أسابيع|اسابيع|weeks?|هەفتە)/i, "weeks"],
  [/(شهر|أشهر|اشهر|شهور|months?|مانگ)/i, "months"],
  [/(سنة|سنوات|سنه|عام|years?|ساڵ)/i, "years"],
];

const DUAL: Array<[RegExp, number, TimeUnit]> = [
  [/ساعتين|ساعتان/, 2, "hours"], [/يومين|يومان/, 2, "days"], [/أسبوعين|اسبوعين/, 2, "weeks"],
  [/شهرين|شهران/, 2, "months"], [/سنتين|عامين/, 2, "years"],
];

const PER_HOUR: Record<TimeUnit, number> = { hours: 1, days: 24, weeks: 168, months: 730, years: 8760 };

function toAsciiDigits(s: string) {
  return s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

export function parseTimeframe(text: string | null | undefined): Timeframe | null {
  if (!text) return null;
  const s = toAsciiDigits(String(text));
  for (const [re, n, unit] of DUAL) {
    const m = s.match(re);
    if (m) return { raw: m[0], count: n, unit, hours: n * PER_HOUR[unit] };
  }
  for (const [ure, unit] of UNITS) {
    const um = s.match(new RegExp(`(\\d+(?:\\.\\d+)?|[\\p{L}]+)\\s*${ure.source}`, "iu"));
    if (!um) continue;
    const tok = um[1].toLowerCase();
    const n = /^\d/.test(tok) ? Number(tok) : WORD_NUM[tok];
    if (n && n > 0) return { raw: um[0], count: n, unit, hours: n * PER_HOUR[unit] };
    // bare unit ("شهر", "a week") = 1
    if (ure.test(s) && !/\d/.test(tok)) return { raw: um[0], count: 1, unit, hours: PER_HOUR[unit] };
  }
  return null;
}

/** Phase bucket to use for a plan calendar, so 5 months is never shown as "weeks 9–12". */
export function calendarUnit(tf: Timeframe): { unit: TimeUnit; steps: number } {
  if (tf.hours <= 48) return { unit: "hours", steps: Math.max(1, Math.round(tf.hours)) };
  if (tf.hours <= 24 * 21) return { unit: "days", steps: Math.round(tf.hours / 24) };
  if (tf.hours <= 730 * 4) return { unit: "weeks", steps: Math.round(tf.hours / 168) };
  return { unit: "months", steps: Math.round(tf.hours / 730) };
}

/** Honest feasibility note for very short horizons (GEO effects take time). */
export function realismNote(tf: Timeframe, lang: string = "ar"): string | null {
  if (tf.hours >= 24 * 14) return null;
  return lang === "en"
    ? "Note: AI engines usually need several weeks to reflect changes; this short plan focuses on quick, measurable steps."
    : lang === "ku"
      ? "تێبینی: بزوێنەرەکان چەند هەفتەیەک پێویستیان هەیە بۆ دەرخستنی گۆڕانکاری؛ ئەم پلانە هەنگاوی خێرا دەگرێتە خۆ."
      : "ملاحظة: محركات الذكاء الاصطناعي تحتاج عادة أسابيع لتعكس التغييرات؛ هذه الخطة القصيرة تركز على خطوات سريعة قابلة للقياس.";
}
