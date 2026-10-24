// Multi-currency catalog + helpers for picking and formatting prices.
// Prices live in the DB as a JSON map { "USD": 9.99, "IQD": 15000, "SAR": 37 }.

export type CurrencyCode =
  | "USD" | "EUR" | "GBP" | "IQD" | "SAR" | "AED" | "EGP" | "JOD"
  | "KWD" | "QAR" | "BHD" | "OMR" | "LBP" | "SYP" | "YER" | "ILS"
  | "MAD" | "DZD" | "TND" | "LYD" | "SDG" | "TRY" | "CAD" | "AUD"
  | "IRR" | "PKR" | "INR";

export type CurrencyDef = {
  code: CurrencyCode;
  symbol: string;
  name_ar: string;
  name_en: string;
  decimals: number;
};

export const CURRENCIES: CurrencyDef[] = [
  { code: "USD", symbol: "$",   name_ar: "دولار أمريكي",  name_en: "US Dollar",         decimals: 2 },
  { code: "EUR", symbol: "€",   name_ar: "يورو",          name_en: "Euro",              decimals: 2 },
  { code: "GBP", symbol: "£",   name_ar: "جنيه إسترليني", name_en: "British Pound",     decimals: 2 },
  { code: "IQD", symbol: "د.ع", name_ar: "دينار عراقي",   name_en: "Iraqi Dinar",       decimals: 0 },
  { code: "SAR", symbol: "﷼",   name_ar: "ريال سعودي",    name_en: "Saudi Riyal",       decimals: 2 },
  { code: "AED", symbol: "د.إ", name_ar: "درهم إماراتي",  name_en: "UAE Dirham",        decimals: 2 },
  { code: "EGP", symbol: "ج.م", name_ar: "جنيه مصري",     name_en: "Egyptian Pound",    decimals: 2 },
  { code: "JOD", symbol: "د.أ", name_ar: "دينار أردني",   name_en: "Jordanian Dinar",   decimals: 2 },
  { code: "KWD", symbol: "د.ك", name_ar: "دينار كويتي",   name_en: "Kuwaiti Dinar",     decimals: 2 },
  { code: "QAR", symbol: "ر.ق", name_ar: "ريال قطري",     name_en: "Qatari Riyal",      decimals: 2 },
  { code: "BHD", symbol: "د.ب", name_ar: "دينار بحريني",  name_en: "Bahraini Dinar",    decimals: 3 },
  { code: "OMR", symbol: "ر.ع", name_ar: "ريال عماني",    name_en: "Omani Rial",        decimals: 3 },
  { code: "LBP", symbol: "ل.ل", name_ar: "ليرة لبنانية",  name_en: "Lebanese Pound",    decimals: 0 },
  { code: "SYP", symbol: "ل.س", name_ar: "ليرة سورية",    name_en: "Syrian Pound",      decimals: 0 },
  { code: "YER", symbol: "ر.ي", name_ar: "ريال يمني",     name_en: "Yemeni Rial",       decimals: 0 },
  { code: "ILS", symbol: "₪",   name_ar: "شيكل",          name_en: "Israeli Shekel",    decimals: 2 },
  { code: "MAD", symbol: "د.م", name_ar: "درهم مغربي",    name_en: "Moroccan Dirham",   decimals: 2 },
  { code: "DZD", symbol: "د.ج", name_ar: "دينار جزائري",  name_en: "Algerian Dinar",    decimals: 2 },
  { code: "TND", symbol: "د.ت", name_ar: "دينار تونسي",   name_en: "Tunisian Dinar",    decimals: 3 },
  { code: "LYD", symbol: "د.ل", name_ar: "دينار ليبي",    name_en: "Libyan Dinar",      decimals: 3 },
  { code: "SDG", symbol: "ج.س", name_ar: "جنيه سوداني",   name_en: "Sudanese Pound",    decimals: 2 },
  { code: "TRY", symbol: "₺",   name_ar: "ليرة تركية",    name_en: "Turkish Lira",      decimals: 2 },
  { code: "CAD", symbol: "C$",  name_ar: "دولار كندي",    name_en: "Canadian Dollar",   decimals: 2 },
  { code: "AUD", symbol: "A$",  name_ar: "دولار أسترالي", name_en: "Australian Dollar", decimals: 2 },
  { code: "IRR", symbol: "﷼",   name_ar: "ريال إيراني",   name_en: "Iranian Rial",      decimals: 0 },
  { code: "PKR", symbol: "₨",   name_ar: "روبية باكستان", name_en: "Pakistani Rupee",   decimals: 0 },
  { code: "INR", symbol: "₹",   name_ar: "روبية هندية",   name_en: "Indian Rupee",      decimals: 2 },
];

export const CURRENCY_BY_CODE: Record<string, CurrencyDef> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c]),
);

// Country (ISO-2) → preferred display currency. Anything else falls back to USD.
export const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  IQ: "IQD", SA: "SAR", AE: "AED", EG: "EGP", JO: "JOD", KW: "KWD",
  QA: "QAR", BH: "BHD", OM: "OMR", LB: "LBP", SY: "SYP", YE: "YER",
  PS: "ILS", MA: "MAD", DZ: "DZD", TN: "TND", LY: "LYD", SD: "SDG",
  TR: "TRY", GB: "GBP", US: "USD", CA: "CAD", AU: "AUD",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR",
  AT: "EUR", IE: "EUR", FI: "EUR", PT: "EUR", GR: "EUR",
  IR: "IRR", PK: "PKR", IN: "INR",
};

export type PriceMap = Record<string, number> | null | undefined;

export function pickPrice(
  prices: PriceMap,
  userCountry: string | null | undefined,
  defaultCurrency: string | null | undefined,
): { amount: number; currency: string } | null {
  const map = (prices && typeof prices === "object") ? prices : {};
  const keys = Object.keys(map).filter((k) => Number(map[k]) > 0);
  if (keys.length === 0) return null;

  const preferred = userCountry ? COUNTRY_CURRENCY[userCountry.toUpperCase()] : null;
  const candidates = [preferred, defaultCurrency, "USD", keys[0]].filter(Boolean) as string[];
  for (const c of candidates) {
    if (map[c] != null && Number(map[c]) > 0) {
      return { amount: Number(map[c]), currency: c };
    }
  }
  return { amount: Number(map[keys[0]]), currency: keys[0] };
}

export function formatMoney(
  amount: number,
  currency: string,
  locale: "ar" | "en" | "ku" = "en",
): string {
  const def = CURRENCY_BY_CODE[currency];
  const decimals = def?.decimals ?? 2;
  const intlLocale = locale === "ar" ? "ar" : locale === "ku" ? "ckb" : "en-US";
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    const formatted = new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
    return `${formatted} ${def?.symbol || currency}`;
  }
}

// Normalize an arbitrary prices payload into { CODE: number } with positive values only.
export function normalizePrices(input: any): Record<string, number> {
  const out: Record<string, number> = {};
  if (!input || typeof input !== "object") return out;
  for (const k of Object.keys(input)) {
    const code = String(k).toUpperCase();
    const n = Number(input[k]);
    if (CURRENCY_BY_CODE[code] && Number.isFinite(n) && n > 0) out[code] = n;
  }
  return out;
}
