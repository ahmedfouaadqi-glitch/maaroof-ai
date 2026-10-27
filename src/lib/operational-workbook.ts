// Pure: builds the second result (operational workbook) from the file rows and recorded research. No invented values.
import type { SheetData, Cell } from "./spreadsheet-reader";
import { detectColumns } from "./spreadsheet-reader";
import { sheetMatchesMarket, type Market } from "./market-scope";
import type { ExportPayload, ExportSection, ExportLang } from "./exports";

export const NA = { ar: "غير متوفر", en: "Not available", ku: "بەردەست نییە" } as const;

export type PartyEvidence = {
  name: string;
  role: "brand" | "competitor";
  url: string | null;
  /** How the competitor was found: given by the user, or a web search result (with its url). */
  found: "user" | "web_search" | "file";
  pageText: string | null;
  title?: string | null;
  description?: string | null;
};

export type EngineAnswer = { market: string; engine: string; status: "answered" | "no_answer"; answer: string; urls: string[] };

export type ResearchInput = {
  brand: string;
  lang: ExportLang;
  markets: Market[];
  sheets: SheetData[];
  parties: PartyEvidence[];
  engineAnswers: EngineAnswer[];
};

const NEG_RX = /\b(free|cheap(est)?|used|second ?hand|fake|replica|copy|jobs?|careers?|diy|download|pdf|wholesale|rent(al)?|repair|meaning|tutorial)\b|مجان|مستعمل|تقليد|وظائف|وظيفة|تحميل|ايجار|إيجار|تصليح/i;

/** Numbers, percentages, years and currency amounts per 100 words. */
export function factDensity(text: string | null): { words: number; facts: number; per100: number } | null {
  if (!text) return null;
  const words = (text.match(/[\p{L}\p{N}]+/gu) || []).length;
  if (!words) return null;
  const facts = (text.match(/(\$|€|£|USD|AED|IQD)?\s?\d[\d,.]*\s?(%|k|m|bn)?/gi) || []).filter((x) => /\d/.test(x)).length;
  return { words, facts, per100: Math.round((facts / words) * 1000) / 10 };
}

/** Which of the file's keywords literally appear on a page. */
export function publishedKeywords(text: string | null, keywords: string[]): string[] {
  if (!text) return [];
  const t = text.toLowerCase();
  return keywords.filter((k) => k.length >= 3 && t.includes(k.toLowerCase()));
}

/** Rule-based negative keyword candidates (explicit exclusion words only). */
export function negativeCandidates(keywords: string[]): Array<{ keyword: string; rule: string }> {
  const out: Array<{ keyword: string; rule: string }> = [];
  for (const k of keywords) { const m = k.match(NEG_RX); if (m) out.push({ keyword: k, rule: m[0].toLowerCase() }); }
  return out;
}

/** Simple authority signals read from page text; missing ones stay "not available". */
export function authoritySignals(p: PartyEvidence) {
  const t = p.pageText || "";
  return {
    url: p.url,
    title: p.title || null,
    description: p.description || null,
    phone: t.match(/\+?\d[\d\s-]{7,}\d/)?.[0]?.trim() || null,
    email: t.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] || null,
    about: /\b(about us|our story)\b|من نحن|قصتنا/i.test(t) ? true : null,
    faq: /\bfaq\b|frequently asked|الأسئلة الشائعة/i.test(t) ? true : null,
  };
}

/** Share of voice: share of answering engines whose answer names the party. */
export function shareOfVoice(answers: EngineAnswer[], name: string): { answered: number; mentioned: number; percent: number | null } {
  const a = answers.filter((x) => x.status === "answered");
  const n = name.toLowerCase().trim();
  const mentioned = n ? a.filter((x) => x.answer.toLowerCase().includes(n)).length : 0;
  return { answered: a.length, mentioned, percent: a.length ? Math.round((mentioned / a.length) * 100) : null };
}

export function keywordColumn(s: SheetData): number {
  const col = detectColumns(s.columns).keyword;
  return col ? s.columns.indexOf(col) : -1;
}

export function allKeywords(sheets: SheetData[], max = 20000): string[] {
  const set = new Set<string>();
  for (const s of sheets) { const i = keywordColumn(s); if (i < 0) continue; for (const r of s.rows) { const v = String(r[i] ?? "").trim(); if (v) set.add(v); if (set.size >= max) return [...set]; } }
  return [...set];
}

const t3 = (l: ExportLang, ar: string, en: string, ku: string) => (l === "ar" ? ar : l === "ku" ? ku : en);
const cell = (v: Cell | null | undefined, l: ExportLang): string | number => (v === null || v === undefined || v === "" ? NA[l] : v);

export function buildOperationalPayload(input: ResearchInput): ExportPayload {
  const { lang: l, markets, sheets, parties, engineAnswers } = input;
  const S = (ar: string, en: string, ku: string) => t3(l, ar, en, ku);
  const SRC_FILE = S("من الملف", "From file", "لە فایل");
  const SRC_WEB = S("من صفحة ويب", "From web page", "لە پەڕەی وێب");
  const SRC_ENG = S("من إجابات المحركات", "From engine answers", "لە وەڵامی بزوێنەرەکان");
  const SRC_RULE = S("قاعدة استبعاد", "Exclusion rule", "یاسای دەرکردن");
  const keywords = allKeywords(sheets);
  const sections: ExportSection[] = [];

  // Summary per market
  sections.push({
    heading: S("ملخص الأسواق", "Market summary", "پوختەی بازاڕەکان"), kind: "table",
    table: {
      columns: [S("السوق", "Market", "بازاڕ"), S("تبويبات الملف", "File sheets", "پەڕەکان"), S("صفوف", "Rows", "ڕیز"), S("محركات أجابت", "Engines answered", "وەڵامدەرەوە"), ...parties.map((p) => `${S("حصة صوت", "Share of voice", "بەشی دەنگ")}: ${p.name}`), S("المصدر", "Source", "سەرچاوە")],
      data: markets.map((m) => {
        const ms = sheets.filter((s) => sheetMatchesMarket(s.name, m));
        const ans = engineAnswers.filter((a) => a.market === m.code);
        return [l === "ar" ? m.ar : m.en, ms.map((s) => s.name).join(", ") || NA[l], ms.reduce((a, s) => a + s.totalRows, 0), `${ans.filter((a) => a.status === "answered").length}/${ans.length}`,
          ...parties.map((p) => { const v = shareOfVoice(ans, p.name); return v.percent === null ? NA[l] : `${v.percent}% (${v.mentioned}/${v.answered})`; }), `${SRC_FILE} + ${SRC_ENG}`];
      }),
    },
  });

  // Full keyword rows per market (no sampling beyond the reader's per-sheet cap)
  for (const m of markets) for (const s of sheets.filter((x) => sheetMatchesMarket(x.name, m))) {
    sections.push({ heading: `${l === "ar" ? m.ar : m.en} — ${s.name}`, kind: "table", table: { columns: [...s.columns, S("المصدر", "Source", "سەرچاوە")], data: s.rows.map((r) => [...s.columns.map((_, i) => cell(r[i], l)), SRC_FILE]) } });
  }

  // Competitor benchmark: published keywords + fact density
  sections.push({
    heading: S("مقارنة المنافسين", "Competitor benchmark", "بەراوردی ڕکابەران"), kind: "table",
    table: {
      columns: [S("الطرف", "Party", "لایەن"), S("الدور", "Role", "ڕۆڵ"), S("الرابط", "URL", "بەستەر"), S("كيف وُجد", "Found via", "دۆزرایەوە"), S("كلمات الملف المنشورة", "File keywords published", "وشە بڵاوکراوەکان"), S("عدد الكلمات", "Words", "وشە"), S("حقائق رقمية", "Numeric facts", "ڕاستی"), S("حقائق/100 كلمة", "Facts/100 words", "ڕاستی/100"), S("المصدر", "Source", "سەرچاوە")],
      data: parties.map((p) => {
        const fd = factDensity(p.pageText); const pub = publishedKeywords(p.pageText, keywords);
        return [p.name, p.role === "brand" ? S("العلامة", "Brand", "براند") : S("منافس", "Competitor", "ڕکابەر"), p.url || NA[l], p.found === "user" ? S("أدخله المستخدم", "User", "بەکارهێنەر") : p.found === "file" ? SRC_FILE : S("بحث ويب", "Web search", "گەڕان"),
          p.pageText ? (pub.slice(0, 40).join(", ") || "0") : NA[l], fd?.words ?? NA[l], fd?.facts ?? NA[l], fd?.per100 ?? NA[l], p.pageText ? SRC_WEB : NA[l]];
      }),
    },
  });

  // Authority card per party
  sections.push({
    heading: S("بطاقة السلطة", "Authority card", "کارتی دەسەڵات"), kind: "table",
    table: {
      columns: [S("الطرف", "Party", "لایەن"), S("الرابط", "URL", "بەستەر"), S("العنوان", "Title", "ناونیشان"), S("الوصف", "Description", "وەسف"), S("هاتف", "Phone", "تەلەفۆن"), S("بريد", "Email", "ئیمەیڵ"), S("من نحن", "About", "دەربارە"), S("أسئلة شائعة", "FAQ", "پرسیار"), S("المصدر", "Source", "سەرچاوە")],
      data: parties.map((p) => { const a = authoritySignals(p); const yn = (v: true | null) => (v ? S("موجود", "Present", "هەیە") : NA[l]);
        return [p.name, cell(a.url, l), cell(a.title, l), cell(a.description, l), cell(a.phone, l), cell(a.email, l), yn(a.about), yn(a.faq), p.pageText ? SRC_WEB : NA[l]]; }),
    },
  });

  // Negative keywords: from file NEGATIVE sheets + exclusion rule
  const negSheets = sheets.filter((s) => /negative|سلبي/i.test(s.name));
  const negRows: (string | number)[][] = [];
  for (const s of negSheets) { const i = keywordColumn(s) >= 0 ? keywordColumn(s) : 0; for (const r of s.rows) { const v = String(r[i] ?? "").trim(); if (v) negRows.push([v, s.name, SRC_FILE]); } }
  const seen = new Set(negRows.map((r) => String(r[0]).toLowerCase()));
  for (const n of negativeCandidates(keywords)) if (!seen.has(n.keyword.toLowerCase())) { seen.add(n.keyword.toLowerCase()); negRows.push([n.keyword, n.rule, SRC_RULE]); }
  sections.push({ heading: S("الكلمات السلبية", "Negative keywords", "وشە نەرێنییەکان"), kind: "table", table: { columns: [S("الكلمة", "Keyword", "وشە"), S("السبب", "Reason", "هۆکار"), S("المصدر", "Source", "سەرچاوە")], data: negRows } });

  // GEO opportunities: market where an engine named a competitor but not the brand
  const geo: (string | number)[][] = [];
  const brandName = input.brand.toLowerCase();
  for (const a of engineAnswers.filter((x) => x.status === "answered")) {
    const txt = a.answer.toLowerCase();
    if (txt.includes(brandName)) continue;
    const comps = parties.filter((p) => p.role === "competitor" && txt.includes(p.name.toLowerCase())).map((p) => p.name);
    if (comps.length) geo.push([a.market.toUpperCase(), a.engine, comps.join(", "), S("المحرك ذكر المنافس ولم يذكر العلامة", "Engine named competitor, not the brand", "ڕکابەری ناوبرد نەک براند"), SRC_ENG]);
  }
  sections.push({ heading: S("فرص GEO", "GEO opportunities", "دەرفەتەکانی GEO"), kind: "table", table: { columns: [S("السوق", "Market", "بازاڕ"), S("المحرك", "Engine", "بزوێنەر"), S("المنافسون المذكورون", "Competitors named", "ڕکابەران"), S("الفرصة", "Opportunity", "دەرفەت"), S("المصدر", "Source", "سەرچاوە")], data: geo } });

  // Engine answers + sources
  sections.push({ heading: S("إجابات المحركات", "Engine answers", "وەڵامی بزوێنەرەکان"), kind: "table", table: { columns: [S("السوق", "Market", "بازاڕ"), S("المحرك", "Engine", "بزوێنەر"), S("الحالة", "Status", "دۆخ"), S("الإجابة", "Answer", "وەڵام"), S("الروابط", "Links", "بەستەر")], data: engineAnswers.map((a) => [a.market.toUpperCase(), a.engine, a.status === "answered" ? S("أجاب", "Answered", "وەڵامی دایەوە") : S("لم يجب", "No answer", "وەڵام نییە"), a.answer || NA[l], a.urls.join(" ") || NA[l]]) } });
  sections.push({ heading: S("المصادر", "Sources", "سەرچاوەکان"), kind: "list", list: [...parties.filter((p) => p.url).map((p) => `${p.name}: ${p.url}`), ...new Set(engineAnswers.flatMap((a) => a.urls))] });

  return { title: S("المصنف التشغيلي", "Operational workbook", "کتێبی کارپێکردن"), subtitle: `${input.brand} · ${markets.map((m) => (l === "ar" ? m.ar : m.en)).join(" / ")}`, lang: l, sections };
}
