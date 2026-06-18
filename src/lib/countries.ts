// ISO country code → display name + flag emoji.
// Curated subset (Arabic world + major). Unknown codes fall back gracefully.
export type CountryInfo = { code: string; name_ar: string; name_en: string; name_ku: string; flag: string };

const FLAG_OFFSET = 0x1f1a5; // regional indicator A-Z offset from uppercase letter
function flagFromCode(cc: string): string {
  if (!cc || cc.length !== 2) return "🌐";
  const c = cc.toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🌐";
  return String.fromCodePoint(c.charCodeAt(0) + FLAG_OFFSET, c.charCodeAt(1) + FLAG_OFFSET);
}

export const NAMES: Record<string, { ar: string; en: string; ku?: string }> = {
  IQ: { ar: "العراق", en: "Iraq", ku: "عێراق" },
  SA: { ar: "السعودية", en: "Saudi Arabia" },
  AE: { ar: "الإمارات", en: "UAE" },
  EG: { ar: "مصر", en: "Egypt" },
  JO: { ar: "الأردن", en: "Jordan" },
  KW: { ar: "الكويت", en: "Kuwait" },
  QA: { ar: "قطر", en: "Qatar" },
  BH: { ar: "البحرين", en: "Bahrain" },
  OM: { ar: "عُمان", en: "Oman" },
  YE: { ar: "اليمن", en: "Yemen" },
  SY: { ar: "سوريا", en: "Syria" },
  LB: { ar: "لبنان", en: "Lebanon" },
  PS: { ar: "فلسطين", en: "Palestine" },
  MA: { ar: "المغرب", en: "Morocco" },
  DZ: { ar: "الجزائر", en: "Algeria" },
  TN: { ar: "تونس", en: "Tunisia" },
  LY: { ar: "ليبيا", en: "Libya" },
  SD: { ar: "السودان", en: "Sudan" },
  MR: { ar: "موريتانيا", en: "Mauritania" },
  SO: { ar: "الصومال", en: "Somalia" },
  KM: { ar: "جزر القمر", en: "Comoros" },
  DJ: { ar: "جيبوتي", en: "Djibouti" },
  TR: { ar: "تركيا", en: "Turkey" },
  IR: { ar: "إيران", en: "Iran" },
  US: { ar: "الولايات المتحدة", en: "United States" },
  GB: { ar: "المملكة المتحدة", en: "United Kingdom" },
  DE: { ar: "ألمانيا", en: "Germany" },
  FR: { ar: "فرنسا", en: "France" },
  CA: { ar: "كندا", en: "Canada" },
  AU: { ar: "أستراليا", en: "Australia" },
  IN: { ar: "الهند", en: "India" },
  PK: { ar: "باكستان", en: "Pakistan" },
  ID: { ar: "إندونيسيا", en: "Indonesia" },
  MY: { ar: "ماليزيا", en: "Malaysia" },
  TH: { ar: "تايلاند", en: "Thailand" },
  CN: { ar: "الصين", en: "China" },
  JP: { ar: "اليابان", en: "Japan" },
  KR: { ar: "كوريا الجنوبية", en: "South Korea" },
  BR: { ar: "البرازيل", en: "Brazil" },
  ES: { ar: "إسبانيا", en: "Spain" },
  IT: { ar: "إيطاليا", en: "Italy" },
  NL: { ar: "هولندا", en: "Netherlands" },
  SE: { ar: "السويد", en: "Sweden" },
  NO: { ar: "النرويج", en: "Norway" },
  RU: { ar: "روسيا", en: "Russia" },
  UA: { ar: "أوكرانيا", en: "Ukraine" },
  ZA: { ar: "جنوب أفريقيا", en: "South Africa" },
  NG: { ar: "نيجيريا", en: "Nigeria" },
  KE: { ar: "كينيا", en: "Kenya" },
  ET: { ar: "إثيوبيا", en: "Ethiopia" },
};

export function getCountryInfo(code: string | null | undefined): CountryInfo {
  const cc = (code || "").toUpperCase();
  const entry = NAMES[cc];
  if (entry) {
    return {
      code: cc,
      name_ar: entry.ar,
      name_en: entry.en,
      name_ku: entry.ku || entry.en,
      flag: flagFromCode(cc),
    };
  }
  // Unknown code — show flag if it's a valid 2-letter code, otherwise globe
  return {
    code: cc || "XX",
    name_ar: cc || "غير معروف",
    name_en: cc || "Unknown",
    name_ku: cc || "نەزانراو",
    flag: flagFromCode(cc),
  };
}
