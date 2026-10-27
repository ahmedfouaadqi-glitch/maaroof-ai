// Pure: builds the second result (operational workbook) from the file rows and recorded research. No invented values.
import type { SheetData, Cell } from "./spreadsheet-reader";
import { detectColumns } from "./spreadsheet-reader";
import { sheetMatchesMarket, type Market } from "./market-scope";
import { clusterScore, type ClusterAnswer } from "./keyword-clusters";
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
  /** Public social posts/pages found by search (url + snippet). */
  social?: Array<{ party: string; url: string; text: string }>;
  /** Whether an Alexandria evidence source is connected. Unknown = not connected. */
  alexandria?: { connected: boolean; note?: string };
  /** llms.txt produced for the brand ("" when there was nothing real to put in it). */
  llms?: string;
  /** Separate per-cluster engine answers; keywords without one show "not measured". */
  clusterAnswers?: ClusterAnswer[];
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

export type Axis = "GEO" | "SGE" | "AEO" | "SEO" | "Social";

/** Rule-based axis per keyword, with the rule that matched (labelled "recommended", not measured). */
export function keywordAxis(k: string): { axis: Axis; rule: string } {
  const t = k.toLowerCase();
  if (/instagram|tiktok|facebook|snapchat|youtube|انستغرام|تيك ?توك/.test(t)) return { axis: "Social", rule: "social platform word" };
  if (/^(what|how|why|which|where|when|who|is|can|does)\b|\?|ما هو|ما هي|كيف|لماذا|أين|هل/.test(t)) return { axis: "AEO", rule: "question form" };
  if (/\b(best|top|vs|versus|compare|alternative|review)s?\b|أفضل|مقارنة|بديل/.test(t)) return { axis: "GEO", rule: "comparison/recommendation" };
  if (t.split(/\s+/).length >= 5) return { axis: "SGE", rule: "long descriptive query" };
  return { axis: "SEO", rule: "short commercial term" };
}

/** Suggested phrasing of a keyword per engine retrieval style. Always labelled as suggestion. */
const ENGINE_FORM: Record<string, (k: string, m: string) => string> = {
  chatgpt: (k, m) => `What are the best options for ${k} in ${m}?`,
  gemini: (k, m) => `${k} ${m} price and where to buy`,
  claude: (k, m) => `How do I choose ${k} in ${m}?`,
  perplexity: (k, m) => `${k} ${m} sources`,
  copilot: (k, m) => `${k} ${m} compare`,
  grok: (k, m) => `${k} ${m} trending`,
  mistral: (k, m) => `${k} ${m}`,
  deepseek: (k, m) => `${k} ${m} specifications`,
  kimi: (k, m) => `${k} ${m} guide`,
  qwen: (k, m) => `${k} ${m} buy online`,
};
export const ENGINE_KEYS = Object.keys(ENGINE_FORM);

/** Engines (of answered ones in that market) whose answer literally contains the keyword. */
export function enginesMentioning(answers: EngineAnswer[], market: string, k: string): string[] {
  const kw = k.toLowerCase().trim();
  if (kw.length < 3) return [];
  return [...new Set(answers.filter((a) => a.market === market && a.status === "answered" && a.answer.toLowerCase().includes(kw)).map((a) => a.engine))];
}

function dedupeNegatives(rows: Array<[string, string, string]>): Array<[string, string, string]> {
  const seen = new Set<string>(); const out: Array<[string, string, string]> = [];
  for (const r of rows) { const k = r[0].toLowerCase().replace(/\s+/g, " ").trim(); if (!k || seen.has(k)) continue; seen.add(k); out.push(r); }
  return out;
}

export function buildOperationalPayload(input: ResearchInput): ExportPayload {
  const { lang: l, markets, sheets, parties, engineAnswers } = input;
  const S = (ar: string, en: string, ku: string) => t3(l, ar, en, ku);
  const SRC = S("المصدر", "Source", "سەرچاوە");
  const SRC_FILE = S("من الملف", "From file", "لە فایل");
  const SRC_WEB = S("من صفحة ويب", "From web page", "لە پەڕەی وێب");
  const SRC_ENG = S("من إجابات المحركات", "From engine answers", "لە وەڵامی بزوێنەرەکان");
  const SRC_RULE = S("قاعدة مكتوبة (مقترح)", "Written rule (suggested)", "یاسا (پێشنیار)");
  const mName = (m: Market) => (l === "ar" ? m.ar : m.en);
  const keywords = allKeywords(sheets);
  const brand = parties.find((p) => p.role === "brand");
  const comps = parties.filter((p) => p.role === "competitor");

  // Market keyword rows (deduped per market)
  type KRow = { k: string; m: Market; sheet: string; vol: Cell | null };
  const kRows: KRow[] = [];
  for (const m of markets) {
    const seen = new Set<string>();
    for (const s of sheets.filter((x) => sheetMatchesMarket(x.name, m))) {
      const ki = keywordColumn(s); if (ki < 0) continue;
      const vc = (detectColumns(s.columns) as any).volume; const vi = vc ? s.columns.indexOf(vc) : -1;
      for (const r of s.rows) { const k = String(r[ki] ?? "").trim(); const key = k.toLowerCase(); if (!k || seen.has(key)) continue; seen.add(key); kRows.push({ k, m, sheet: s.name, vol: vi >= 0 ? r[vi] : null }); }
    }
  }

  // Negatives
  const negRaw: Array<[string, string, string]> = [];
  for (const s of sheets.filter((x) => /negative|سلبي/i.test(x.name))) { const i = keywordColumn(s) >= 0 ? keywordColumn(s) : 0; for (const r of s.rows) negRaw.push([String(r[i] ?? "").trim(), s.name, SRC_FILE]); }
  for (const n of negativeCandidates(keywords)) negRaw.push([n.keyword, n.rule, SRC_RULE]);
  const negs = dedupeNegatives(negRaw);

  // Per-engine keyword fit: winners first, else first keywords of each market (max 30 per market)
  const winners = new Set<string>();
  for (const s of sheets.filter((x) => /winner|رابح/i.test(x.name))) { const i = keywordColumn(s); if (i >= 0) for (const r of s.rows) winners.add(String(r[i] ?? "").trim().toLowerCase()); }
  const perEngine: (string | number)[][] = [];
  for (const m of markets) {
    const mk = kRows.filter((r) => r.m.code === m.code);
    const pick = [...mk.filter((r) => winners.has(r.k.toLowerCase())), ...mk.filter((r) => !winners.has(r.k.toLowerCase()))].slice(0, 30);
    const answered = engineAnswers.filter((a) => a.market === m.code && a.status === "answered").length;
    for (const r of pick) {
      const ax = keywordAxis(r.k);
      const cs = clusterScore(input.clusterAnswers || [], m.code, r.k);
      const eng = cs ? cs.engines : enginesMentioning(engineAnswers, m.code, r.k);
      const NOT_M = S("لم تُقس", "Not measured", "نەپێوراوە");
      const score = cs ? `${eng.length}/${cs.answered}` : eng.length ? `${eng.length}/${answered}` : NOT_M;
      perEngine.push([r.k, mName(m), score, eng.join(", ") || (cs ? "0" : NOT_M), ax.axis, ax.rule,
        ENGINE_KEYS.map((e) => `${e}: ${ENGINE_FORM[e](r.k, m.en)}`).join("\n"), cs ? S("سؤال مستقل لمجموعة الكلمة", "Separate cluster question", "پرسیاری جیا") : eng.length ? SRC_ENG : NA[l]]);
    }
  }

  // Brand vs competitors per market
  const bench: (string | number)[][] = [];
  for (const m of markets) {
    const ans = engineAnswers.filter((a) => a.market === m.code);
    for (const p of parties) {
      const v = shareOfVoice(ans, p.name); const fd = factDensity(p.pageText); const a = authoritySignals(p);
      const signals = [a.title && "title", a.description && "description", a.phone && "phone", a.email && "email", a.about && "about", a.faq && "faq"].filter(Boolean) as string[];
      const pub = publishedKeywords(p.pageText, keywords);
      const strong: string[] = []; const weak: string[] = [];
      if (v.percent !== null) (v.percent >= 30 ? strong : weak).push(S(`حصة صوت ${v.percent}%`, `Share of voice ${v.percent}%`, `${v.percent}%`));
      if (fd) (fd.per100 >= 2 ? strong : weak).push(S(`${fd.per100} حقيقة/100 كلمة`, `${fd.per100} facts/100 words`, `${fd.per100}`));
      if (p.pageText) (a.faq ? strong : weak).push(S(a.faq ? "صفحة أسئلة موجودة" : "لا صفحة أسئلة", a.faq ? "Has FAQ" : "No FAQ", "FAQ"));
      bench.push([mName(m), p.name, p.role === "brand" ? S("العلامة", "Brand", "براند") : S("منافس", "Competitor", "ڕکابەر"),
        p.found === "user" ? S("أدخله المستخدم", "Entered by user", "بەکارهێنەر") : p.found === "file" ? SRC_FILE : S("اكتُشف ببحث الويب", "Found by web search", "گەڕان"),
        p.url || NA[l], v.percent === null ? NA[l] : `${v.percent}% (${v.mentioned}/${v.answered})`, fd ? fd.per100 : NA[l], p.pageText ? `${signals.length}/6 (${signals.join(", ") || "-"})` : NA[l],
        p.pageText ? (pub.slice(0, 15).join(", ") || "0") : NA[l], strong.join("، ") || NA[l], weak.join("، ") || NA[l], [p.pageText && SRC_WEB, v.answered && SRC_ENG].filter(Boolean).join(" + ") || NA[l]]);
    }
  }
  for (const s of input.social || []) bench.push([S("تواصل اجتماعي", "Social", "سۆشیال"), s.party, S("منشور عام", "Public post", "پۆست"), S("بحث ويب", "Web search", "گەڕان"), s.url, NA[l], NA[l], NA[l], publishedKeywords(s.text, keywords).slice(0, 15).join(", ") || "0", NA[l], NA[l], SRC_WEB]);

  // Execution plan: what Maaroof did now vs what the team does
  const DONE = S("نُفّذ بواسطة معروف", "Done by Maaroof", "ئەنجامدرا");
  const TEAM = S("يحتاج فريقك", "Needs your team", "تیمەکەت");
  const NOT = S("لم يُنفّذ: لا بيانات كافية", "Not done: not enough data", "ئەنجام نەدرا");
  const plan: (string | number)[][] = [
    [1, S("قائمة كلمات سلبية منظفة", "Clean negative keyword list", "لیستی نەرێنی"), negs.length ? DONE : NOT, negs.length ? S(`${negs.length} كلمة في تبويب الكلمات السلبية`, `${negs.length} keywords in the Negative sheet`, `${negs.length}`) : NA[l], S("انسخها إلى Google Ads ← الأدوات ← قوائم الكلمات السلبية ← اربطها بالحملات", "Copy into Google Ads → Tools → Negative keyword lists → apply to campaigns", "Google Ads")],
    [2, "llms.txt", input.llms ? DONE : NOT, input.llms ? S("جاهز في نهاية هذا الملف ويمكن نسخه من الدردشة", "Ready at the end of this file and copyable in chat", "ئامادەیە") : S("أكمل بطاقة هوية العلامة أولاً", "Complete the brand identity card first", "کارتی ناسنامە"), S("ارفع الملف إلى جذر الموقع: /llms.txt", "Upload to the site root as /llms.txt", "/llms.txt")],
    [3, S("كلمات لكل نموذج", "Keywords per engine", "وشە بۆ هەر بزوێنەر"), perEngine.length ? DONE : NOT, S(`${perEngine.length} كلمة مع درجة التطابق`, `${perEngine.length} keywords with match score`, `${perEngine.length}`), S("اكتب صفحة أو سؤالاً شائعاً لكل كلمة درجتها منخفضة", "Write a page or FAQ answer for each low-score keyword", "پەڕە بنووسە")],
    [4, S("سد فجوات GEO", "Close GEO gaps", "GEO"), TEAM, S(`${bench.filter((r) => r[2] !== S("العلامة", "Brand", "براند") && typeof r[5] === "string" && /^[1-9]/.test(String(r[5]))).length} حالة ذكر فيها محرك منافساً`, "Cases where an engine named a competitor", ""), S("أضف حقائق بأرقام ومصادر في أول 150 كلمة من الصفحات الأساسية", "Add numbered, sourced facts in the first 150 words of key pages", "")],
    [5, S("بيانات Schema (Organization/FAQ)", "Schema data (Organization/FAQ)", "Schema"), input.llms ? DONE : NOT, S("تُنتج مع حزمة قراءة الآلة", "Produced with the machine-readable pack", ""), S("ضع الكود داخل <head> في الموقع", "Paste the code inside the site <head>", "<head>")],
    [6, S("طبقة الأدلة والبيانات المهيكلة", "Structured Evidence & Data Layer", "چینی بەڵگە و داتای ڕێکخراو"), input.alexandria?.connected ? DONE : NOT, input.alexandria?.connected ? (input.alexandria.note || "") : S("غير متصلة حالياً؛ لم تُستخدم أي بيانات منها", "Not connected; no data was used from it", "پەیوەست نییە"), S("تحتاج ربطاً قبل الاعتماد عليها", "Needs connecting before use", "")],
  ];

  const answeredTotal = engineAnswers.filter((a) => a.status === "answered").length;
  const brandVoice = brand ? markets.map((m) => { const v = shareOfVoice(engineAnswers.filter((a) => a.market === m.code), brand.name); return `${mName(m)}: ${v.percent === null ? NA[l] : `${v.percent}%`}`; }).join(" · ") : NA[l];
  const sections: ExportSection[] = [
    { heading: S("ابدأ هنا", "Start here", "لێرە دەستپێبکە"), kind: "table", table: { columns: [S("البند", "Item", "بڕگە"), S("القيمة", "Value", "بەها"), SRC], data: [
      [S("العلامة", "Brand", "براند"), input.brand, S("أدخله المستخدم", "Entered by user", "بەکارهێنەر")],
      [S("الأسواق", "Markets", "بازاڕەکان"), markets.map(mName).join(" / ") || NA[l], SRC_FILE],
      [S("كلمات الملف (بلا تكرار)", "File keywords (unique)", "وشەکان"), kRows.length, SRC_FILE],
      [S("المنافسون", "Competitors", "ڕکابەران"), comps.map((c) => c.name).join(", ") || NA[l], comps.some((c) => c.found === "web_search") ? S("بحث ويب", "Web search", "گەڕان") : S("أدخله المستخدم", "Entered by user", "")],
      [S("إجابات المحركات", "Engine answers", "وەڵامەکان"), `${answeredTotal}/${engineAnswers.length}`, SRC_ENG],
      [S("حصة صوت العلامة", "Brand share of voice", "بەشی دەنگ"), brandVoice, SRC_ENG],
      [S("الكلمات السلبية", "Negative keywords", "نەرێنی"), negs.length, `${SRC_FILE} + ${SRC_RULE}`],
      [S("الخطوة التالية", "Next step", "هەنگاوی داهاتوو"), S("افتح تبويب «خطة التنفيذ»", "Open the “Execution plan” sheet", "پلان"), "-"],
    ] } },
    { heading: S("الكلمات حسب الأسواق", "Keywords by market", "وشە بەپێی بازاڕ"), kind: "table", table: { columns: [S("الكلمة", "Keyword", "وشە"), S("السوق", "Market", "بازاڕ"), S("التبويب", "Sheet", "پەڕە"), S("حجم البحث", "Volume", "قەبارە"), S("المحور المقترح", "Suggested axis", "تەوەر"), SRC], data: kRows.map((r) => [r.k, mName(r.m), r.sheet, cell(r.vol, l), keywordAxis(r.k).axis, SRC_FILE]) } },
    { heading: S("الكلمات لكل نموذج", "Keywords per engine", "وشە بۆ هەر بزوێنەر"), kind: "table", table: { columns: [S("الكلمة", "Keyword", "وشە"), S("السوق", "Market", "بازاڕ"), S("درجة التطابق", "Match score", "پلە"), S("النماذج التي ذكرتها", "Engines that mentioned it", "بزوێنەرەکان"), S("المحور", "Axis", "تەوەر"), S("سبب المحور", "Axis reason", "هۆکار"), S("الصيغة المقترحة لكل نموذج", "Suggested phrasing per engine", "پێشنیار"), SRC], data: perEngine } },
    { heading: S("العلامة مقابل المنافسين", "Brand vs competitors", "براند و ڕکابەران"), kind: "table", table: { columns: [S("السوق", "Market", "بازاڕ"), S("الطرف", "Party", "لایەن"), S("الدور", "Role", "ڕۆڵ"), S("كيف وُجد", "Found via", "دۆزرایەوە"), S("الرابط", "URL", "بەستەر"), S("حصة الصوت", "Share of voice", "بەشی دەنگ"), S("حقائق/100 كلمة", "Facts/100 words", "ڕاستی"), S("بطاقة السلطة", "Authority card", "کارت"), S("كلمات الملف المنشورة", "File keywords published", "بڵاوکراوە"), S("قوة", "Strength", "هێز"), S("ضعف", "Weakness", "لاوازی"), SRC], data: bench } },
    { heading: S("الكلمات السلبية", "Negative keywords", "وشە نەرێنییەکان"), kind: "table", table: { columns: [S("الكلمة", "Keyword", "وشە"), S("السبب", "Reason", "هۆکار"), SRC], data: negs } },
    { heading: S("خطة التنفيذ", "Execution plan", "پلانی جێبەجێکردن"), kind: "table", table: { columns: ["#", S("الخطوة", "Step", "هەنگاو"), S("الحالة", "Status", "دۆخ"), S("الناتج", "Output", "ئەنجام"), S("كيف تُنفذ", "How to do it", "چۆن")], data: plan } },
  ];
  return { title: S("المصنف التشغيلي", "Operational workbook", "کتێبی کارپێکردن"), subtitle: `${input.brand} · ${markets.map(mName).join(" / ")}`, lang: l, sections };
}
