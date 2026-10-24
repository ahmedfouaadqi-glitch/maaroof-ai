// Entity Truth Card consistency check. Pure, rule-based, zero external calls.
// Compares a text against the user's declared entity (type, HQ, markets, specialty)
// and returns calm, honest alerts. Never invents facts: only flags what it can see.

export type EntityCard = {
  brand_name?: string | null;
  entity_type?: string | null; // organization | person
  hq_country?: string | null;
  target_markets?: string[] | null;
  specialty_scope?: string | null;
  brand_keywords?: string | null;
};

export type EntityAlert = { kind: "geo" | "topic" | "missing"; text: { ar: string; en: string; ku: string } };

const COUNTRIES: Record<string, string[]> = {
  IQ: ["العراق", "عراق", "بغداد", "أربيل", "اربيل", "البصرة", "iraq", "baghdad", "erbil", "عێراق", "هەولێر"],
  LB: ["لبنان", "بيروت", "lebanon", "beirut", "لوبنان"],
  SA: ["السعودية", "الرياض", "جدة", "saudi", "riyadh"],
  AE: ["الإمارات", "الامارات", "دبي", "أبوظبي", "uae", "dubai", "emirates"],
  EG: ["مصر", "القاهرة", "egypt", "cairo"],
  JO: ["الأردن", "الاردن", "عمّان", "jordan", "amman"],
  SY: ["سوريا", "دمشق", "syria", "damascus"],
  KW: ["الكويت", "kuwait"],
  QA: ["قطر", "الدوحة", "qatar", "doha"],
  TR: ["تركيا", "اسطنبول", "turkey", "istanbul"],
  US: ["أمريكا", "الولايات المتحدة", "usa", "united states"],
  GB: ["بريطانيا", "لندن", "uk", "london"],
};

export const COUNTRY_NAMES: Record<string, { ar: string; en: string; ku: string }> = {
  IQ: { ar: "العراق", en: "Iraq", ku: "عێراق" }, LB: { ar: "لبنان", en: "Lebanon", ku: "لوبنان" },
  SA: { ar: "السعودية", en: "Saudi Arabia", ku: "سعودیە" }, AE: { ar: "الإمارات", en: "UAE", ku: "ئیمارات" },
  EG: { ar: "مصر", en: "Egypt", ku: "میسر" }, JO: { ar: "الأردن", en: "Jordan", ku: "ئوردن" },
  SY: { ar: "سوريا", en: "Syria", ku: "سووریا" }, KW: { ar: "الكويت", en: "Kuwait", ku: "کوەیت" },
  QA: { ar: "قطر", en: "Qatar", ku: "قەتەر" }, TR: { ar: "تركيا", en: "Turkey", ku: "تورکیا" },
  US: { ar: "الولايات المتحدة", en: "USA", ku: "ئەمریکا" }, GB: { ar: "بريطانيا", en: "UK", ku: "بەریتانیا" },
};

const cn = (c: string, l: "ar" | "en" | "ku") => COUNTRY_NAMES[c]?.[l] || c;

function tokens(s: string): string[] {
  return String(s || "").toLowerCase().normalize("NFKC")
    .replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا")
    .split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);
}

export function detectCountries(text: string): string[] {
  const t = String(text || "").toLowerCase();
  return Object.entries(COUNTRIES).filter(([, ws]) => ws.some((w) => t.includes(w.toLowerCase()))).map(([c]) => c);
}

export function checkEntityConsistency(text: string, card: EntityCard | null | undefined): EntityAlert[] {
  if (!card || !text || text.trim().length < 40) return [];
  const out: EntityAlert[] = [];
  const hq = String(card.hq_country || "").toUpperCase();
  const markets = (card.target_markets || []).map((m) => String(m).toUpperCase());
  const brand = String(card.brand_name || "").trim();
  const mentioned = detectCountries(text);

  // Geo: text targets a country that is neither HQ nor a declared market.
  if (hq || markets.length) {
    const known = new Set([hq, ...markets].filter(Boolean));
    const foreign = mentioned.filter((c) => !known.has(c));
    if (foreign.length) {
      const f = foreign.map((c) => ({ ar: cn(c, "ar"), en: cn(c, "en"), ku: cn(c, "ku") }));
      const h = hq ? { ar: cn(hq, "ar"), en: cn(hq, "en"), ku: cn(hq, "ku") } : null;
      out.push({ kind: "geo", text: {
        ar: `نصك يستهدف ${f.map((x) => x.ar).join("، ")} وهو غير مذكور ضمن أسواقك المعلنة${h ? ` (المقر: ${h.ar})` : ""}. النماذج قد لا تربطك بهذا السوق؛ أضفه لأسواقك إن كنت تخدمه فعلاً، أو اذكر صراحةً علاقتك به في أول النص.`,
        en: `Your text targets ${f.map((x) => x.en).join(", ")}, which is not among your declared markets${h ? ` (HQ: ${h.en})` : ""}. Engines may not link you to it; add it to your markets if you truly serve it, or state the link early in the text.`,
        ku: `دەقەکەت ${f.map((x) => x.ku).join("، ")} دەکاتە ئامانج کە لە بازاڕە ڕاگەیەندراوەکانتدا نییە${h ? ` (بارەگا: ${h.ku})` : ""}. ئەگەر بەڕاستی خزمەتی دەکەیت زیادی بکە.`,
      } });
    }
  }

  // Topic: no overlap between text and declared specialty/keywords.
  const scopeWords = new Set(tokens(`${card.specialty_scope || ""} ${card.brand_keywords || ""}`));
  if (scopeWords.size >= 2) {
    const tw = tokens(text);
    const hit = tw.some((w) => scopeWords.has(w) || [...scopeWords].some((s) => s.length >= 4 && (w.startsWith(s) || s.startsWith(w))));
    if (!hit) {
      const sc = String(card.specialty_scope || card.brand_keywords || "").slice(0, 80);
      out.push({ kind: "topic", text: {
        ar: `موضوع النص لا يظهر فيه تخصصك المعلن («${sc}»). النماذج تستشهد بالمصدر في مجاله؛ اربط الموضوع بخبرتك (مثلاً: أثر هذا الموضوع على عملاء مجالك).`,
        en: `The text doesn't touch your declared specialty ("${sc}"). Engines cite sources within their field; connect the topic to your expertise (e.g. its impact on your clients).`,
        ku: `بابەتی دەقەکە پسپۆڕیی ڕاگەیەندراوت («${sc}») تێدا دیار نییە. بابەتەکە بە شارەزاییەکەتەوە ببەستەوە.`,
      } });
    }
  }

  // Missing brand mention early in the text.
  if (brand && !text.slice(0, 700).toLowerCase().includes(brand.toLowerCase())) {
    out.push({ kind: "missing", text: {
      ar: `اسم علامتك «${brand}» غير موجود في بداية النص؛ ذكره في أول 100 كلمة يساعد النماذج على نسبة المعلومة إليك.`,
      en: `Your brand "${brand}" is not in the opening; naming it in the first 100 words helps engines attribute the facts to you.`,
      ku: `ناوی براندەکەت «${brand}» لە سەرەتای دەقدا نییە؛ لە یەکەم ١٠٠ وشەدا بینووسە.`,
    } });
  }
  return out;
}

/** Short factual context line for AI prompts (declared facts only, labelled as declared). */
export function entityContextLine(card: EntityCard | null | undefined): string {
  if (!card) return "";
  const parts: string[] = [];
  if (card.brand_name) parts.push(`name=${card.brand_name}`);
  if (card.entity_type) parts.push(`type=${card.entity_type}`);
  if (card.hq_country) parts.push(`hq=${card.hq_country}`);
  if (card.target_markets?.length) parts.push(`markets=${card.target_markets.join(",")}`);
  if (card.specialty_scope) parts.push(`specialty=${String(card.specialty_scope).slice(0, 160)}`);
  return parts.length ? `Declared entity (user-provided, not independently verified): ${parts.join("; ")}` : "";
}

/** Normalize a user-typed link: adds https:// when missing; returns null if not a URL-like value. */
export function normalizeUrl(input: string): string | null {
  let s = String(input || "").trim();
  if (!s || s.startsWith("@") || /\s/.test(s)) return null;
  if (s.startsWith("//")) s = "https:" + s;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  try {
    const u = new URL(s);
    if (!u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch { return null; }
}
