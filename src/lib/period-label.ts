// Dynamic billing-period label derived from plan duration in days.
// Supports Arabic / English / Kurdish (ckb) without needing per-key i18n strings.

export type LangCode = "ar" | "en" | "ku";

function arPlural(n: number, one: string, two: string, fewMany: string, plural: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${fewMany}`;
  return `${n} ${plural}`;
}

export function formatPeriod(days: number | null | undefined, lang: LangCode = "en"): string {
  const d = Number(days) || 0;
  if (d <= 0) return "";

  // Snap close-to-canonical periods.
  const snaps: Array<{ days: number; key: string }> = [
    { days: 7, key: "weekly" },
    { days: 14, key: "biweekly" },
    { days: 30, key: "monthly" },
    { days: 60, key: "2months" },
    { days: 90, key: "3months" },
    { days: 120, key: "4months" },
    { days: 180, key: "6months" },
    { days: 270, key: "9months" },
    { days: 365, key: "yearly" },
    { days: 730, key: "2years" },
    { days: 1095, key: "3years" },
  ];
  const match = snaps.find((s) => Math.abs(d - s.days) <= 3);

  const L = {
    ar: {
      weekly: "أسبوعياً",
      biweekly: "كل أسبوعين",
      monthly: "شهرياً",
      "2months": "كل شهرين",
      "3months": "كل 3 أشهر",
      "4months": "كل 4 أشهر",
      "6months": "كل 6 أشهر",
      "9months": "كل 9 أشهر",
      yearly: "سنوياً",
      "2years": "كل سنتين",
      "3years": "كل 3 سنوات",
    },
    en: {
      weekly: "/ week",
      biweekly: "every 2 weeks",
      monthly: "/ month",
      "2months": "every 2 months",
      "3months": "every 3 months",
      "4months": "every 4 months",
      "6months": "every 6 months",
      "9months": "every 9 months",
      yearly: "/ year",
      "2years": "every 2 years",
      "3years": "every 3 years",
    },
    ku: {
      weekly: "هەفتانە",
      biweekly: "هەر دوو هەفتە",
      monthly: "مانگانە",
      "2months": "هەر دوو مانگ",
      "3months": "هەر ٣ مانگ",
      "4months": "هەر ٤ مانگ",
      "6months": "هەر ٦ مانگ",
      "9months": "هەر ٩ مانگ",
      yearly: "ساڵانە",
      "2years": "هەر دوو ساڵ",
      "3years": "هەر ٣ ساڵ",
    },
  } as const;

  if (match) return (L[lang] as any)[match.key];

  // Fallback: express as months when divisible enough, else days.
  if (d % 30 === 0) {
    const months = d / 30;
    if (lang === "ar") return `كل ${arPlural(months, "شهر", "شهرين", "أشهر", "شهراً")}`;
    if (lang === "ku") return `هەر ${months} مانگ`;
    return `every ${months} months`;
  }
  if (lang === "ar") return `كل ${arPlural(d, "يوم", "يومين", "أيام", "يوماً")}`;
  if (lang === "ku") return `هەر ${d} ڕۆژ`;
  return `every ${d} days`;
}
