// Pure: target markets named in a workbook (sheet/column names) or the request text. Never assumed.
export type Market = { code: string; en: string; ar: string; gl: string };

const MARKETS: Array<Market & { rx: RegExp }> = [
  { code: "us", en: "United States", ar: "الولايات المتحدة", gl: "us", rx: /\b(usa|u\.s\.a|united states|america)\b|أمريكا|امريكا|الولايات المتحدة/i },
  { code: "lb", en: "Lebanon", ar: "لبنان", gl: "lb", rx: /\blebanon\b|لبنان/i },
  { code: "au", en: "Australia", ar: "أستراليا", gl: "au", rx: /\baustralia\b|أستراليا|استراليا/i },
  { code: "iq", en: "Iraq", ar: "العراق", gl: "iq", rx: /\biraq\b|العراق/i },
  { code: "ae", en: "United Arab Emirates", ar: "الإمارات", gl: "ae", rx: /\b(uae|emirates|dubai)\b|الإمارات|الامارات|دبي/i },
  { code: "sa", en: "Saudi Arabia", ar: "السعودية", gl: "sa", rx: /\b(ksa|saudi)\b|السعودية/i },
  { code: "kw", en: "Kuwait", ar: "الكويت", gl: "kw", rx: /\bkuwait\b|الكويت/i },
  { code: "qa", en: "Qatar", ar: "قطر", gl: "qa", rx: /\bqatar\b|قطر/i },
  { code: "jo", en: "Jordan", ar: "الأردن", gl: "jo", rx: /\bjordan\b|الأردن|الاردن/i },
  { code: "eg", en: "Egypt", ar: "مصر", gl: "eg", rx: /\begypt\b|مصر/i },
  { code: "tr", en: "Turkey", ar: "تركيا", gl: "tr", rx: /\b(turkey|türkiye)\b|تركيا/i },
  { code: "gb", en: "United Kingdom", ar: "المملكة المتحدة", gl: "gb", rx: /\b(uk|united kingdom|britain)\b|بريطانيا|المملكة المتحدة/i },
  { code: "ca", en: "Canada", ar: "كندا", gl: "ca", rx: /\bcanada\b|كندا/i },
  { code: "fr", en: "France", ar: "فرنسا", gl: "fr", rx: /\bfrance\b|فرنسا/i },
  { code: "de", en: "Germany", ar: "ألمانيا", gl: "de", rx: /\bgermany\b|ألمانيا|المانيا/i },
];

/** Markets found in the given texts, in first-seen order. Empty when none is named. */
export function detectMarkets(texts: string[]): Market[] {
  const out: Market[] = [];
  for (const t of texts) for (const m of MARKETS) if (m.rx.test(String(t || "")) && !out.some((o) => o.code === m.code)) out.push({ code: m.code, en: m.en, ar: m.ar, gl: m.gl });
  return out;
}

export function marketByCode(code: string): Market | null {
  const m = MARKETS.find((x) => x.code === String(code || "").toLowerCase());
  return m ? { code: m.code, en: m.en, ar: m.ar, gl: m.gl } : null;
}

/** True when a sheet name belongs to that market. */
export function sheetMatchesMarket(sheetName: string, m: Market): boolean {
  return detectMarkets([sheetName]).some((x) => x.code === m.code);
}

/**
 * Assign generic workbook tabs to a single target market only when no tab is
 * explicitly market-labelled. With multiple markets, never duplicate one tab
 * across markets without evidence.
 */
export function sheetsForMarket<T extends { name: string }>(sheets: T[], markets: Market[], market: Market): T[] {
  const matched = sheets.filter((sheet) => sheetMatchesMarket(sheet.name, market));
  if (matched.length > 0 || markets.length !== 1) return matched;
  return sheets;
}
