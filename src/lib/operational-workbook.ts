// Pure: builds the second result (operational workbook) from the file rows and recorded research. No invented values.
import type { SheetData, Cell } from "./spreadsheet-reader";
import { detectColumns } from "./spreadsheet-reader";
import { sheetsForMarket, type Market } from "./market-scope";
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
  /** True only when the page evidence was served from the scoped cache. */
  cacheHit?: boolean;
  additionalPages?: Array<{ url: string; text: string | null; title?: string | null; description?: string | null }>;
};

export type EngineAnswer = { market: string; engine: string; status: "answered" | "no_answer" | "empty" | "timeout" | "http_error" | "error"; answer: string; urls: string[]; query?: string; error?: string; provider_path?: "primary" | "fallback"; model_used?: string; cacheHit?: boolean; probe_kind?: "keyword_visibility" };

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

/** Share of voice counts direct primary answers only; gateway stand-ins are not direct engine observations. */
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

export function allKeywords(sheets: SheetData[], max = Number.POSITIVE_INFINITY): string[] {
  const set = new Set<string>();
  for (const s of sheets) { const i = keywordColumn(s); if (i < 0) continue; for (const r of s.rows) { const v = String(r[i] ?? "").trim(); if (v) set.add(v); if (set.size >= max) return [...set]; } }
  return [...set];
}

const t3 = (l: ExportLang, ar: string, en: string, ku: string) => (l === "ar" ? ar : l === "ku" ? ku : en);
const cell = (v: Cell | null | undefined, l: ExportLang): string | number => (v === null || v === undefined || v === "" ? NA[l] : v);

export type Axis = "SEO" | "AEO" | "GEO" | "SGE" | "GSEO" | "SGEO";

const AXES: Axis[] = ["SEO", "AEO", "GEO", "SGE", "GSEO", "SGEO"];

/**
 * Heuristic axis classification, not a live ranking or visibility measurement.
 * The six axes are kept distinct so reports can explain their basis.
 */
export function keywordAxis(k: string): { axis: Axis; rule: string } {
  const t = k.toLowerCase().trim();
  if (/^(what|how|why|which|where|when|who|is|can|does)\b|\?|ما هو|ما هي|كيف|لماذا|أين|هل/.test(t)) return { axis: "AEO", rule: "question / answer intent" };
  if (/\b(best|top|vs|versus|compare|comparison|alternative|review|near me)\b|أفضل|مقارنة|بديل|تقييم|بالقرب مني/.test(t)) return { axis: "GEO", rule: "recommendation, comparison, or answer-engine intent" };
  if (/\b(ai overview|google ai|generative search|featured snippet)\b|نظرة عامة بالذكاء الاصطناعي/i.test(t)) return { axis: "SGE", rule: "AI search overview intent" };
  if (/\b(organic ranking|search visibility|seo audit|technical seo)\b|ترتيب عضوي|تدقيق seo/i.test(t)) return { axis: "GSEO", rule: "organic search and generative visibility intersection" };
  if (/\b(citation|cited|sources|authoritative|entity|generative engine|ai answer)\b|استشهاد|مصادر موثوقة|كيان موثق|محرك توليدي/i.test(t)) return { axis: "SGEO", rule: "generative citation and cross-search opportunity" };
  return { axis: "SEO", rule: "default organic-search intent; validate against page and SERP evidence" };
}

/** Six transparent heuristic scores (0–100); these are recommendations, never measured performance. */
export function keywordAxisScores(k: string): Record<Axis, number> {
  const { axis } = keywordAxis(k);
  const scores = Object.fromEntries(AXES.map((name) => [name, name === axis ? 70 : 25])) as Record<Axis, number>;
  const t = k.toLowerCase();
  if (/\b(buy|price|shop|near me|best)\b|شراء|سعر|متجر|أفضل/.test(t)) scores.SEO = Math.max(scores.SEO, 65);
  if (/\b(what|how|why|which|where|when|who)\b|\?|ما هو|كيف|لماذا|هل/.test(t)) scores.AEO = Math.max(scores.AEO, 75);
  if (/\b(citation|sources|authoritative|generative|ai answer)\b|استشهاد|مصادر|توليدي/.test(t)) { scores.GEO = Math.max(scores.GEO, 60); scores.SGEO = Math.max(scores.SGEO, 75); }
  if (/\b(ai overview|google ai|featured snippet)\b|نظرة عامة بالذكاء الاصطناعي/i.test(t)) scores.SGE = Math.max(scores.SGE, 75);
  if (/\b(organic ranking|search visibility|seo audit)\b|ترتيب عضوي|تدقيق seo/i.test(t)) scores.GSEO = Math.max(scores.GSEO, 75);
  return scores;
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

function dedupeNegatives(rows: Array<[string, string, string, string]>): Array<[string, string, string, string]> {
  const seen = new Set<string>(); const out: Array<[string, string, string, string]> = [];
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
    for (const s of sheetsForMarket(sheets, markets, m).filter((x) => !/negative|سلبي/i.test(x.name))) {
      const ki = keywordColumn(s); if (ki < 0) continue;
      const vc = (detectColumns(s.columns) as any).volume; const vi = vc ? s.columns.indexOf(vc) : -1;
      for (const r of s.rows) { const k = String(r[ki] ?? "").trim(); const key = k.toLowerCase(); if (!k || seen.has(key)) continue; seen.add(key); kRows.push({ k, m, sheet: s.name, vol: vi >= 0 ? r[vi] : null }); }
    }
  }

  // Negatives
  const negRaw: Array<[string, string, string, string]> = [];
  for (const s of sheets.filter((x) => /negative|سلبي/i.test(x.name))) {
    const i = keywordColumn(s) >= 0 ? keywordColumn(s) : 0;
    s.rows.forEach((r, rowIndex) => {
      const keyword = String(r[i] ?? "").trim();
      if (keyword) negRaw.push([keyword, S("موجودة في المصدر — تحتاج مراجعة", "Existing source entry — review required", "لە سەرچاوە هەیە — پێویستی بە پێداچوونەوەیە"), S("مصنفة في الملف الأصلي؛ لم يُعَد التحقق منها", "Marked in the original workbook; not independently validated", "لە فایلە سەرەکییەکەدا نیشان کراوە؛ دووبارە پشتڕاست نەکراوەتەوە"), SRC_FILE + ": " + s.name + ", row " + (rowIndex + 2)]);
    });
  }
  for (const n of negativeCandidates(keywords)) {
    negRaw.push([n.keyword, S("مرشحة بقاعدة — ليست قرار استبعاد", "Rule-based candidate — not a final exclusion", "پێشنیاری یاسایی — بڕیاری کۆتایی نییە"), S("قاعدة مطابقة", "Matched rule", "یاسای هاوتا") + ": " + n.rule + "; " + S("يلزم التحقق", "Review required", "پێویستی بە پشکنین"), SRC_RULE]);
  }
  const negs = dedupeNegatives(negRaw);

  // Per-engine keyword fit. A keyword is measured only when it was present in the actual query or in a separate cluster probe.
  const winners = new Set<string>();
  for (const s of sheets.filter((x) => /winner|رابح/i.test(x.name))) { const i = keywordColumn(s); if (i >= 0) for (const r of s.rows) winners.add(String(r[i] ?? "").trim().toLowerCase()); }
  const perEngine: (string | number)[][] = [];
  for (const m of markets) {
    const mk = kRows.filter((r) => r.m.code === m.code);
    const pick = [...mk.filter((r) => winners.has(r.k.toLowerCase())), ...mk.filter((r) => !winners.has(r.k.toLowerCase()))];
    for (const r of pick) {
      const ax = keywordAxis(r.k);
      const cs = clusterScore(input.clusterAnswers || [], m.code, r.k);
      const quotedKeyword = '"' + r.k.slice(0, 180).toLowerCase().replace(/"/g, "") + '"';
      const matchingProbes = engineAnswers.filter((answer) => answer.market === m.code && String(answer.query || "").toLowerCase().includes(quotedKeyword));
      const directProbes = matchingProbes;
      const answeredProbes = directProbes.filter((answer) => answer.status === "answered");
      const proxyAnsweredProbes = ([] as typeof matchingProbes);
      const eng = cs
        ? cs.engines
        : [...new Set(answeredProbes.filter((answer) => answer.answer.toLowerCase().includes(r.k.toLowerCase())).map((answer) => answer.engine))];
      const NOT_M = S("لم تُقَس مباشرةً", "Not measured directly", "ڕاستەوخۆ نەپێوراوە");
      const score = cs ? (String(eng.length) + "/" + cs.answered) : answeredProbes.length ? (String(eng.length) + "/" + answeredProbes.length) : NOT_M;
      const engineLabel = eng.join(", ") || (cs || answeredProbes.length
        ? S("لم يرد ذكر حرفي في الإجابات المباشرة", "No literal mention in direct answers", "باسکردنی ڕاستەوخۆ لە وەڵامەکاندا نییە")
        : proxyAnsweredProbes.length
          ? S("أجاب", "Answered", "وەڵامی دایەوە")
          : directProbes.length
            ? S("أُرسلت الكلمة لكن لم تسجل إجابة مباشرة ناجحة", "Keyword was sent but no successful direct answer was recorded", "وشەکە نێردرا بەڵام وەڵامی ڕاستەوخۆی سەرکەوتوو تۆمار نەکرا")
            : S("لم تُختبر هذه الكلمة في سؤال المحرك", "Not tested in engine query", "ئەم وشەیە لە پرسیاری بزوێنەر تاقی نەکراوەتەوە"));
      const provenance = cs
        ? S("سؤال مستقل لمجموعة الكلمة", "Separate cluster question", "پرسیاری جیا بۆ کۆمەڵە وشە")
        : answeredProbes.length
          ? SRC_ENG
          : proxyAnsweredProbes.length
            ? S("استجابة مسار بديل؛ لا تدخل في حصة الظهور المباشر", "Fallback response; excluded from direct visibility share", "وەڵامی ڕێڕەوی جێگرەوە؛ لە بەشی دەرکەوتنی ڕاستەوخۆدا ناژمێردرێت")
            : directProbes.length
              ? S("أُرسلت الكلمة لكن لم تسجل إجابة مباشرة ناجحة", "Keyword was sent but no successful direct answer was recorded", "وشەکە نێردرا بەڵام وەڵامی ڕاستەوخۆی سەرکەوتوو تۆمار نەکرا")
              : S("لم تُرسل الكلمة في سؤال المحرك", "Keyword was not sent in engine query", "وشەکە لە پرسیاری بزوێنەر نەنێردرا");
      perEngine.push([r.k, mName(m), score, engineLabel, ax.axis, ax.rule,
        AXES.map((axis) => axis + ": " + t3(l, "لم تُقَس", "Not measured", "نەپێوراوە")).join(" · "), ENGINE_KEYS.map((e) => e + ": " + ENGINE_FORM[e](r.k, m.en)).join("\n"), provenance]);
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

  // Keyword-level coverage matrix. Coverage is literal text presence in the supplied page text,
  // not an inference that a page ranks for the keyword.
  const coverageRows: (string | number)[][] = [];
  for (const m of markets) {
    const marketRows = kRows.filter((row) => row.m.code === m.code);
    for (const row of marketRows) {
      const brandHasPage = Boolean(brand?.pageText);
      const brandHas = brandHasPage ? publishedKeywords(brand!.pageText, [row.k]).length > 0 : false;
      const competitorPages = comps.filter((p) => Boolean(p.pageText));
      const coveredBy = competitorPages.filter((p) => publishedKeywords(p.pageText, [row.k]).length > 0).map((p) => p.name);
      const unknownCompetitors = comps.filter((p) => !p.pageText).map((p) => p.name);
      const coverageStatus = !brandHasPage
        ? S("تعذر التحقق من تغطية العلامة", "Brand coverage unknown: page text unavailable", "پۆششی براند نەزانراوە")
        : brandHas
          ? S("موجودة حرفيًا في نص العلامة", "Literal keyword found in brand page text", "وشەکە لە دەقی برانددا هەیە")
          : S("فجوة محتملة: لم تظهر حرفيًا في النص المقدم", "Potential gap: not found literally in supplied text", "کەلێنی ئەگەری: لە دەقی پێشکەشکراودا نەدۆزرایەوە");
      const competitorStatus = comps.length === 0
        ? S("لم تُحدد منافسات", "No competitors supplied", "ڕکابەری دیاری نەکراوە")
        : coveredBy.length
          ? coveredBy.join(", ")
          : unknownCompetitors.length
            ? S("لا ظهور حرفي في الصفحات المقروءة؛ صفحات غير مقروءة: ", "No literal match on readable pages; unreadable pages: ", "پەڕە نەخوێندراوەکان: ") + unknownCompetitors.join(", ")
            : S("لا ظهور حرفي في نصوص المنافسين المقدمة", "No literal match in supplied competitor page text", "لە دەقی پێشکەشکراوی ڕکابەراندا نەدۆزرایەوە");
      coverageRows.push([row.k, mName(m), brandHasPage ? (brandHas ? S("نعم", "Yes", "بەڵێ") : S("لا", "No", "نەخێر")) : NA[l],
        competitorStatus, coverageStatus,
        !brandHasPage || unknownCompetitors.length
          ? S("بيانات غير مكتملة؛ لا تُعامل كفجوة مؤكدة", "Incomplete evidence; do not treat as a confirmed gap", "بەڵگە تەواو نییە")
          : !brandHas && coveredBy.length
            ? S("أولوية مراجعة — المنافس يغطيها نصيًا", "Review priority — competitor mentions it literally", "پێویستی بە پێداچوونەوە")
            : brandHas && coveredBy.length
              ? S("تغطية مشتركة نصيًا", "Shared literal coverage", "پۆششی هاوبەش")
              : S("تحقق يدويًا من النتائج والنية قبل القرار", "Validate SERPs and intent before deciding", "پێش بڕیار نیەت و ئەنجامەکان بپشکنە")]);
    }
  }
  const keywordCoverageSection: ExportSection = {
    heading: S("مصفوفة تغطية الكلمات وفجوات المنافسة", "Keyword coverage and competitor gap matrix", "ماتریسی پۆششی وشە و کەلێنی ڕکابەری"),
    kind: "table",
    table: { columns: [S("الكلمة", "Keyword", "وشە"), S("السوق", "Market", "بازاڕ"), S("تغطية العلامة (نصية)", "Brand coverage (text)", "پۆششی براند"), S("المنافسون الذين يذكرون الكلمة", "Competitors with literal mention", "ڕکابەرانی باسکەر"), S("النتيجة", "Finding", "دەرئەنجام"), S("الإجراء المقترح", "Suggested action", "کرداری پێشنیارکراو")], data: coverageRows },
  };

  // Execution plan: what Maaroof did now vs what the team does
  const DONE = S("نُفّذ بواسطة معروف", "Done by Maaroof", "ئەنجامدرا");
  const TEAM = S("يحتاج فريقك", "Needs your team", "تیمەکەت");
  const NOT = S("لم يُنفّذ: لا بيانات كافية", "Not done: not enough data", "ئەنجام نەدرا");
  const plan: (string | number)[][] = [
    [1, S("مرشحات الكلمات السلبية للمراجعة", "Negative keyword candidates for review", "پێشنیاری وشە نەرێنییەکان بۆ پێداچوونەوە"), negs.length ? S("تحتاج مراجعة بشرية", "Human review required", "پێویستی بە پێداچوونەوەی مرۆییە") : NOT, negs.length ? S(String(negs.length) + " مرشحًا؛ ليست قرارات استبعاد نهائية", String(negs.length) + " candidates; not final exclusion decisions", String(negs.length)) : NA[l], S("تحقق من نية البحث والسوق ونوع المطابقة قبل اعتماد أي استبعاد", "Validate search intent, market, and match type before applying exclusions", "پێش جێبەجێکردنی ڕەتکردنەوە، نیەت و بازاڕ و جۆری هاوتایی بپشکنە")],
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
    { heading: S("الكلمات لكل نموذج", "Keywords per engine", "وشە بۆ هەر بزوێنەر"), kind: "table", table: { columns: [S("الكلمة", "Keyword", "وشە"), S("السوق", "Market", "بازاڕ"), S("الذكر الحرفي / الإجابات", "Literal mention / answered", "باسکردنی ڕاستەوخۆ"), S("النماذج التي ذكرتها حرفيًا", "Engines with a literal mention", "بزوێنەرەکانی باسکردنی ڕاستەوخۆ"), S("المحور المقترح", "Suggested axis", "تەوەری پێشنیارکراو"), S("سبب المحور", "Axis rule", "یاسای تەوەر"), S("درجات المحاور الستة", "Six-axis scores", "نمرەی شەش تەوەر"), S("صيغة سؤال مقترحة", "Suggested query phrasing", "داواکاری پێشنیارکراو"), SRC], data: perEngine } },
    { heading: S("العلامة مقابل المنافسين", "Brand vs competitors", "براند و ڕکابەران"), kind: "table", table: { columns: [S("السوق", "Market", "بازاڕ"), S("الطرف", "Party", "لایەن"), S("الدور", "Role", "ڕۆڵ"), S("كيف وُجد", "Found via", "دۆزرایەوە"), S("الرابط", "URL", "بەستەر"), S("حصة الصوت", "Share of voice", "بەشی دەنگ"), S("حقائق/100 كلمة", "Facts/100 words", "ڕاستی"), S("بطاقة السلطة", "Authority card", "کارت"), S("كلمات الملف المنشورة", "File keywords published", "بڵاوکراوە"), S("قوة", "Strength", "هێز"), S("ضعف", "Weakness", "لاوازی"), SRC], data: bench } },
    { heading: S("الكلمات السلبية — للمراجعة", "Negative keywords — review required", "وشە نەرێنییەکان — پێداچوونەوە"), kind: "table", table: { columns: [S("الكلمة", "Keyword", "وشە"), S("التصنيف", "Classification", "پۆلێن"), S("السبب / ملاحظة التحقق", "Reason / validation note", "هۆکار / تێبینی پشکنین"), SRC], data: negs } },
    { heading: S("خطة التنفيذ", "Execution plan", "پلانی جێبەجێکردن"), kind: "table", table: { columns: ["#", S("الخطوة", "Step", "هەنگاو"), S("الحالة", "Status", "دۆخ"), S("الناتج", "Output", "ئەنجام"), S("كيف تُنفذ", "How to do it", "چۆن")], data: plan } },
  ];
  const sourceInventoryRows: (string | number)[][] = sheets.map((sheet) => [
    sheet.name,
    sheet.totalRows,
    sheet.rows.length,
    sheet.truncated ? S("مقتطعة في الذاكرة؛ راجع الملف الأصلي لبقية الصفوف", "Truncated in memory; use the original for remaining rows", "لە بیرگەدا سنووردار کراوە؛ فایلە سەرەکییەکە بپشکنە") : S("كل الصفوف المقروءة متاحة", "All read rows included", "هەموو ڕیزە خوێندراوەکان لەخۆگرتووە"),
  ]);
  const sourceInventory: ExportSection = {
    heading: S("سلامة المصدر وفهرس الأوراق", "Source integrity & sheet inventory", "سەلامەتی سەرچاوە و لیستی پەڕەکان"),
    kind: "table",
    table: { columns: [S("الورقة الأصلية", "Source sheet", "پەڕەی سەرچاوە"), S("صفوف المصدر", "Source rows", "ڕیزەکانی سەرچاوە"), S("صفوف مرفقة", "Rows included", "ڕیزەکان"), S("حالة الاكتمال", "Completeness", "دۆخی تەواوی")], data: sourceInventoryRows },
  };
  const originalDataSections: ExportSection[] = sheets.map((sheet) => ({
    heading: (S("البيانات الأصلية", "Original data", "داتای سەرەکی") + " — " + sheet.name).slice(0, 180),
    kind: "table",
    table: {
      columns: sheet.columns.length ? sheet.columns : [S("الصف", "Row", "ڕیز")],
      data: sheet.rows.map((row) => (sheet.columns.length ? sheet.columns.map((_, i) => row[i] ?? "") : row)),
    },
  }));
  const marketLabel = (code: string) => mName(markets.find((market) => market.code === code) || ({ code, en: code, ar: code, gl: code } as Market));
  const engineStatusRows: (string | number)[][] = engineAnswers.map((answer) => [
    marketLabel(answer.market),
    answer.engine,
    answer.status,
    answer.query || NA[l],
    answer.answer || NA[l],
    answer.urls.join("\n") || NA[l],
    answer.status === "answered" ? S("أجاب", "Answered", "وەڵامی دایەوە") : answer.status === "no_answer" || answer.status === "empty" ? S("لم يجب", "No answer", "وەڵامی نەدایەوە") : S("لم يُقس", "Not measured", "نەپێوراوە"),
    answer.error || NA[l],
    answer.urls.length ? S("روابط أعادها المحرك؛ لم تتحقق مستقلًا", "URLs returned by engine; not independently verified", "بەستەرەکانی بزوێنەر؛ سەربەخۆ پشتڕاست نەکراونەتەوە") : NA[l],
  ]);
  const engineStatusSection: ExportSection = {
    heading: S("سجل إجابات المحركات العشرة", "Ten-engine answer and status log", "تۆماری وەڵام و دۆخی دە بزوێنەر"),
    kind: "table",
    table: { columns: [S("السوق", "Market", "بازاڕ"), S("المحرك", "Engine", "بزوێنەر"), S("الحالة", "Status", "دۆخ"), S("السؤال المرسل فعليًا", "Actual query sent", "پرسیاری ڕاستەقینەی نێردراو"), S("الإجابة المسجلة", "Recorded answer", "وەڵامی تۆمارکراو"), S("النتيجة", "Result", "ئەنجام"), S("الروابط المعادة", "Returned URLs", "بەستەرە گەڕاوەکان"), S("خطأ أو سبب عدم الإجابة", "Error or no-answer reason", "هۆی هەڵە یان بێ وەڵام"), S("ملاحظة التحقق", "Validation note", "تێبینی پشکنین")], data: engineStatusRows },
  };
  const clusterStatusRows: (string | number)[][] = (input.clusterAnswers || []).map((answer) => [
    marketLabel(answer.market),
    answer.keywords.join(" | "),
    answer.engine,
    answer.status,
    answer.query || NA[l],
    answer.answer || NA[l],
    answer.status === "answered" ? S("أجاب", "Answered", "وەڵامی دایەوە") : answer.status === "no_answer" || answer.status === "empty" ? S("لم يجب", "No answer", "وەڵامی نەدایەوە") : S("لم يُقس", "Not measured", "نەپێوراوە"),
    answer.error || NA[l],
    S("استجابة مسجلة لمجموعة كلمات؛ لا تعني قياس ترتيب", "Recorded cluster response; not a ranking measurement", "وەڵامی کۆمەڵە وشەی تۆمارکراو؛ پێوانەی ڕیزبەندی نییە"),
  ]);
  const clusterStatusSection: ExportSection = {
    heading: S("نتائج اختبار مجموعات الكلمات", "Keyword-cluster probe results", "ئەنجامی تاقیکردنەوەی کۆمەڵە وشەکان"),
    kind: "table",
    table: { columns: [S("السوق", "Market", "بازاڕ"), S("الكلمات المختبرة", "Keywords tested", "وشە تاقیکراوەکان"), S("المحرك", "Engine", "بزوێنەر"), S("الحالة", "Status", "دۆخ"), S("السؤال الفعلي", "Actual query", "پرسیاری ڕاستەقینە"), S("الإجابة المسجلة", "Recorded answer", "وەڵامی تۆمارکراو"), S("النتيجة", "Result", "ئەنجام"), S("خطأ أو سبب عدم الإجابة", "Error or no-answer reason", "هۆی هەڵە یان بێ وەڵام"), S("حد القياس", "Measurement limit", "سنووری پێوانە")], data: clusterStatusRows },
  };
  const statusCounts = (items: Array<{ status: string; provider_path?: string }>) => ({
    // "answered" here means a direct observation. Gateway proxy responses are reported separately.
    answered: items.filter((item) => item.status === "answered").length,
    fallback: 0,
    noAnswer: items.filter((item) => item.status === "no_answer").length,
    empty: items.filter((item) => item.status === "empty").length,
    timeout: items.filter((item) => item.status === "timeout").length,
    httpError: items.filter((item) => item.status === "http_error").length,
    error: items.filter((item) => item.status === "error").length,
  });
  const marketProbeCounts = statusCounts(engineAnswers);
  const clusterProbeCounts = statusCounts(input.clusterAnswers || []);
  const partyUrls = parties.filter((party) => Boolean(party.url));
  const pageReadCount = partyUrls.filter((party) => Boolean(party.pageText)).length;
  const socialResults = input.social || [];
  const socialPartyCount = new Set(socialResults.map((item) => item.party)).size;
  const alexandriaAttempted = input.alexandria?.connected || Boolean(input.alexandria?.note) ? 1 : 0;
  const alexandriaSuccess = input.alexandria?.connected ? 1 : 0;
  const executionRows: (string | number)[][] = [
    [S("اختبارات المحركات حسب السوق", "Market engine probes", "تاقیکردنەوەی بزوێنەر بەپێی بازاڕ"), engineAnswers.length, marketProbeCounts.answered, marketProbeCounts.fallback, marketProbeCounts.noAnswer, marketProbeCounts.empty, marketProbeCounts.timeout, marketProbeCounts.httpError, marketProbeCounts.error, S("كل إجابة مسجلة من المحركات العشرة تدخل في القياس.", "Every recorded answer from the ten engines counts.", "هەموو وەڵامێکی تۆمارکراو دەژمێردرێت.")],
    [S("اختبارات مجموعات الكلمات", "Keyword cluster probes", "تاقیکردنەوەی کۆمەڵە وشەکان"), (input.clusterAnswers || []).length, clusterProbeCounts.answered, clusterProbeCounts.fallback, clusterProbeCounts.noAnswer, clusterProbeCounts.empty, clusterProbeCounts.timeout, clusterProbeCounts.httpError, clusterProbeCounts.error, S("العدد لا يمثل ترتيبًا عامًا.", "The count is not a general ranking.", "ژمارە ڕیزبەندی گشتی نییە.")],
    [S("قراءة صفحات العلامة والمنافسين", "Brand and competitor page reads", "خوێندنەوەی پەڕەی براند و ڕکابەران"), partyUrls.length, pageReadCount, 0, partyUrls.length - pageReadCount, 0, 0, 0, 0, S("عدد الصفحات ذات النص المستخرج من بين الروابط المعروفة؛ الرابط وحده لا يعني قراءة الصفحة.", "Pages with extracted text among known URLs; a URL alone does not mean the page was read.", "پەڕەکانی دەقی وەرگیراو لە نێوان بەستەرە ناسراوەکان؛ بەستەر بە تەنها واتای خوێندنەوە نییە.")],
    [S("نتائج البحث الاجتماعي العامة", "Public social search results", "ئەنجامەکانی گەڕانی گشتیی سۆشیال"), Math.min(parties.length, 5), socialPartyCount, 0, Math.max(0, Math.min(parties.length, 5) - socialPartyCount), 0, 0, 0, 0, S("العدد هو حساب الجهات التي ظهر لها رابط واحد على الأقل؛ عدم ظهور رابط لا يثبت عدم وجود محتوى.", "Counts parties with at least one result; no result does not prove no content exists.", "ژمارەی لایەنەکانی هەیە کەمترین یەک بەستەریان هەیە؛ نەبوونی ئەنجام بەڵگەی نەبوونی ناوەڕۆک نییە.")],
    [S("مصدر Alexandria الاختياري", "Optional Alexandria source", "سەرچاوەی هەڵبژاردەی Alexandria"), alexandriaAttempted, alexandriaSuccess, 0, Math.max(0, alexandriaAttempted - alexandriaSuccess), 0, 0, 0, 0, input.alexandria?.note || S("غير مهيأ أو لا توجد أدلة قابلة للاستخدام؛ لا تُستبدل بياناته ببيانات تخمينية.", "Not configured or no usable evidence; no speculative replacement data is used.", "ئامادە نەکراوە یان بەڵگەی بەسوود نییە؛ داتای خەمڵێنراو جێگای ناگرێتەوە.")],
  ];
  const executionSection: ExportSection = {
    heading: S("التنفيذ والأخطاء", "Execution and errors", "جێبەجێکردن و هەڵەکان"),
    kind: "table",
    table: { columns: [S("النشاط", "Activity", "چالاکی"), S("المحاولات / الروابط", "Attempts / URLs", "هەوڵ / بەستەر"), S("الإجابات المباشرة / القراءات", "Direct answers / reads", "وەڵامە ڕاستەوخۆکان / خوێندنەوە"), S("إجابات إضافية", "Additional answers", "وەڵامی زیادە"), S("لا إجابة / غير متاح", "No answer / unavailable", "بێ وەڵام / بەردەست نییە"), S("فارغ", "Empty", "بەتاڵ"), S("انتهاء مهلة", "Timeouts", "کاتی تەواوبوون"), S("أخطاء HTTP", "HTTP errors", "هەڵەی HTTP"), S("أخطاء أخرى", "Other errors", "هەڵەی تر"), S("حدود التفسير", "Interpretation limits", "سنووری لێکدانەوە")], data: executionRows },
  };
  const evidenceRows: (string | number)[][] = [];
  for (const party of parties) if (party.url) evidenceRows.push([party.role, party.name, party.url, party.pageText ? S("تم جلب نص الصفحة", "Page text fetched", "دەقی پەڕە وەرگیرا") : S("رابط فقط؛ الصفحة لم تُقرأ", "URL only; page not read", "تەنها بەستەر؛ پەڕە نەخوێندراوەتەوە"), party.found]);
  for (const answer of engineAnswers) for (const url of answer.urls) evidenceRows.push([S("إجابة محرك", "Engine answer", "وەڵامی بزوێنەر"), answer.engine + " · " + marketLabel(answer.market), url, S("أعاد المحرك الرابط؛ يلزم التحقق المستقل", "Engine returned the URL; independent validation required", "بزوێنەر بەستەرەکەی گەڕاندەوە؛ پێویستی بە پشتڕاستکردنەوەی سەربەخۆیە"), answer.status]);
  for (const item of input.social || []) evidenceRows.push([S("نتيجة بحث اجتماعي", "Social search result", "ئەنجامی گەڕانی سۆشیال"), item.party, item.url, item.text, SRC_WEB]);
  const evidenceSection: ExportSection = {
    heading: S("سجل الأدلة والمصادر", "Evidence and source registry", "تۆماری بەڵگە و سەرچاوە"),
    kind: "table",
    table: { columns: [S("نوع المصدر", "Source type", "جۆری سەرچاوە"), S("الجهة / السياق", "Entity / context", "لایەن / پاشبنەما"), S("الرابط", "URL", "بەستەر"), S("ما الذي تحقق", "What was checked", "چی پشکنرا"), S("منشأ النتيجة", "Provenance", "سەرچاوەی ئەنجام")], data: evidenceRows },
  };
  sections.splice(1, 0, sourceInventory, ...originalDataSections, keywordCoverageSection);
  sections.splice(2 + originalDataSections.length, 0, engineStatusSection, clusterStatusSection, executionSection, evidenceSection);

  return { title: S("المصنف التشغيلي", "Operational workbook", "کتێبی کارپێکردن"), subtitle: input.brand + " · " + markets.map(mName).join(" / "), lang: l, sections };
}
