// Pure: builds the eight-section keyword intelligence result from recorded evidence only.
// Anything not measured reads "not measured"; no invented numbers.
import type { ExportSection, ExportLang } from "./exports";
import type { ResearchInput, EngineAnswer, PartyEvidence } from "./operational-workbook";
import { allKeywords, authoritySignals, factDensity, keywordAxisScores, negativeCandidates } from "./operational-workbook";
import { clusterScore } from "./keyword-clusters";
import { extractSiteKeywords } from "./site-keyword-extractor";
import { ingestionFor } from "./keyword-ingestion-timeline";
import { sanitizeDeep } from "./brand-sanitize";

export const AXES_ORDER = ["SEO", "AEO", "GEO", "SGE", "GSEO", "SGEO"] as const;

export type KiInput = ResearchInput & {
  /** True when the user attached a keyword file; false = keywords came from the site scan. */
  hasFile: boolean;
};

const t3 = (l: ExportLang, ar: string, en: string, ku: string) => (l === "ar" ? ar : l === "ku" ? ku : en);
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Occurrences of a keyword per 100 words of a text; null when there is no text. */
export function keywordDensity(text: string | null | undefined, k: string): number | null {
  if (!text) return null;
  const words = (text.match(/[\p{L}\p{N}]+/gu) || []).length;
  if (!words) return null;
  const kw = norm(k); if (kw.length < 2) return 0;
  const hay = norm(text); let n = 0, i = 0;
  while ((i = hay.indexOf(kw, i)) >= 0) { n++; i += kw.length; }
  return Math.round((n / words) * 1000) / 10;
}

/** Engines whose answered replies mention the keyword, out of answered replies. */
export function engineMentions(answers: EngineAnswer[], k: string): { engines: string[]; answered: number } {
  const a = answers.filter((x) => x.status === "answered");
  const kw = norm(k);
  const engines = kw.length < 3 ? [] : [...new Set(a.filter((x) => norm(x.answer).includes(kw)).map((x) => x.engine))];
  return { engines, answered: new Set(a.map((x) => x.engine + "|" + x.market)).size };
}

/** New keywords = phrases competitors' pages or engine answers use that the brand list lacks. */
export function newKeywordCandidates(brandList: string[], competitors: PartyEvidence[], answers: EngineAnswer[], max = 40): Array<{ keyword: string; from: "competitor" | "engines"; party?: string }> {
  const have = new Set(brandList.map(norm));
  const out: Array<{ keyword: string; from: "competitor" | "engines"; party?: string }> = [];
  const seen = new Set<string>();
  const push = (k: string, from: "competitor" | "engines", party?: string) => { const n = norm(k); if (have.has(n) || seen.has(n)) return; seen.add(n); out.push({ keyword: k, from, party }); };
  for (const c of competitors) for (const k of extractSiteKeywords({ text: c.pageText, title: c.title, description: c.description }, 20)) if (k.keyword.includes(" ")) push(k.keyword, "competitor", c.name);
  const answerText = answers.filter((a) => a.status === "answered").map((a) => a.answer).join("\n");
  for (const k of extractSiteKeywords({ text: answerText }, 30)) if (k.keyword.includes(" ")) push(k.keyword, "engines");
  return out.slice(0, max);
}

export function buildKeywordIntelligenceSections(input: KiInput): ExportSection[] {
  const l = input.lang;
  const S = (ar: string, en: string, ku: string) => t3(l, ar, en, ku);
  const NM = S("لم تُقس", "Not measured", "نەپێوراوە");
  const brand = input.parties.find((p) => p.role === "brand");
  const comps = input.parties.filter((p) => p.role === "competitor");
  const answers = input.engineAnswers;
  const brandList = input.hasFile
    ? allKeywords(input.sheets).slice(0, 300)
    : extractSiteKeywords({ text: brand?.pageText, title: brand?.title, description: brand?.description }, 60).map((k) => k.keyword);
  const fresh = newKeywordCandidates(brandList, comps, answers);
  const authority = (p?: PartyEvidence) => {
    if (!p?.pageText) return NM;
    const a = authoritySignals(p);
    return `${[a.title, a.description, a.phone, a.email, a.about, a.faq].filter(Boolean).length}/6`;
  };
  const facts = (p?: PartyEvidence) => { const f = factDensity(p?.pageText || null); return f ? f.per100 : NM; };
  const opinion = (k: string) => {
    const cs = input.clusterAnswers?.length ? input.markets.map((m) => clusterScore(input.clusterAnswers!, m.code, k)).find(Boolean) : null;
    const m = cs ? { engines: cs.engines, answered: cs.answered } : engineMentions(answers, k);
    if (!m.answered) return { share: NM, engines: NM };
    return { share: `${m.engines.length}/${m.answered}`, engines: m.engines.join(", ") || S("لم تذكرها النماذج", "Not mentioned by models", "باس نەکراوە") };
  };
  const density = (p: PartyEvidence | undefined, k: string) => { const d = keywordDensity(p?.pageText, k); return d === null ? NM : d; };

  // 1. Brand keywords (current + new)
  const SRC_CUR = input.hasFile ? S("من الملف", "From file", "لە فایل") : S("من فحص الموقع", "From site scan", "لە پشکنینی ماڵپەڕ");
  const brandCols = [S("الكلمة", "Keyword", "وشە"), S("النوع", "Type", "جۆر"), S("المصدر", "Source", "سەرچاوە"), S("حصة الصوت في النماذج", "Share of voice in models", "بەشی دەنگ"), S("الكثافة في صفحة العلامة (/100 كلمة)", "Density on brand page (/100 words)", "چڕی"), S("كثافة الحقائق", "Fact density", "چڕی ڕاستییەکان"), S("السلطة", "Authority", "دەسەڵات"), S("رأي النماذج", "Model opinion", "ڕای مۆدێلەکان")];
  if (input.hasFile) brandCols.push(S("مقارنة القديم بالجديد", "Old vs new", "کۆن و نوێ"));
  const brandRows: (string | number)[][] = [];
  for (const k of brandList) { const o = opinion(k); const r: (string | number)[] = [k, S("حالية", "Current", "ئێستا"), SRC_CUR, o.share, density(brand, k), facts(brand), authority(brand), o.engines]; if (input.hasFile) r.push(S("موجودة في الملف", "In file", "لە فایلدا")); brandRows.push(r); }
  for (const n of fresh) { const o = opinion(n.keyword); const r: (string | number)[] = [n.keyword, S("جديدة", "New", "نوێ"), n.from === "competitor" ? S("من صفحة منافس", "From competitor page", "لە ڕکابەر") + (n.party ? `: ${n.party}` : "") : S("من إجابات النماذج", "From model answers", "لە وەڵامی مۆدێل"), o.share, density(brand, n.keyword), NM, NM, o.engines]; if (input.hasFile) r.push(S("غير موجودة في الملف — فرصة", "Not in file — opportunity", "لە فایلدا نییە — دەرفەت")); brandRows.push(r); }

  // 2. Competitors
  const compKw = new Map<string, string[]>();
  const compRows: (string | number)[][] = [];
  for (const c of comps) {
    const list = extractSiteKeywords({ text: c.pageText, title: c.title, description: c.description }, 25).map((k) => k.keyword);
    compKw.set(c.name, list);
    if (!list.length) compRows.push([c.name, c.url || NM, NM, NM, NM, NM, NM, NM]);
    for (const k of list) { const o = opinion(k); compRows.push([c.name, c.url || NM, k, o.share, density(c, k), facts(c), authority(c), o.engines]); }
  }

  // 3. Comparison
  const brandSet = new Set(brandList.map(norm));
  const cmpRows: (string | number)[][] = [];
  const allComp = new Map<string, string[]>();
  for (const [name, list] of compKw) for (const k of list) { const n = norm(k); allComp.set(n, [...(allComp.get(n) || []), name]); }
  for (const [k, names] of allComp) cmpRows.push([k, brandSet.has(k) ? S("مشتركة", "Shared", "هاوبەش") : S("فجوة: لدى المنافس فقط", "Gap: competitor only", "بۆشایی"), names.join(", "), brandSet.has(k) ? S("تشابه", "Similarity", "لێکچوون") : S("ضعف لدى العلامة", "Brand weakness", "لاوازی")]);
  for (const k of brandList) if (!allComp.has(norm(k)) && comps.some((c) => c.pageText)) cmpRows.push([k, S("لدى العلامة فقط", "Brand only", "تەنها براند"), "-", S("قوة لدى العلامة", "Brand strength", "هێز")]);

  // 4. Social
  const socialRows: (string | number)[][] = [];
  const socialKw: string[] = [];
  for (const s of input.social || []) {
    const found = [...brandList, ...fresh.map((f) => f.keyword), ...allComp.keys()].filter((k) => k.length >= 3 && norm(s.text).includes(norm(k)));
    socialKw.push(...found);
    socialRows.push([s.party, s.url, found.slice(0, 15).join(", ") || S("لا كلمات مطابقة", "No matching keywords", "هیچ"), keywordDensity(s.text, s.party) ?? NM]);
  }

  // 5. Six axes (rule-based estimate, labelled)
  const axisList = [...brandList.slice(0, 80), ...fresh.map((f) => f.keyword)];
  const axisRows = axisList.map((k) => { const sc = keywordAxisScores(k); return [k, ...AXES_ORDER.map((a) => sc[a])]; });

  // 6. Ingestion
  const ingRows = [...fresh.map((f) => [f.keyword, ingestionFor(true, l).initial, ingestionFor(true, l).full]), ...brandList.slice(0, 30).map((k) => [k, ingestionFor(false, l).initial, ingestionFor(false, l).full])];

  // 7. Negatives in four groups
  const G = [
    [S("العلامة", "Brand", "براند"), [...brandList, ...fresh.map((f) => f.keyword)]],
    [S("المنافسون", "Competitors", "ڕکابەران"), [...allComp.keys()]],
    [S("المقارنة", "Comparison", "بەراورد"), [...allComp.keys()].filter((k) => brandSet.has(k))],
    [S("التواصل الاجتماعي", "Social", "سۆشیال"), [...new Set(socialKw)]],
  ] as const;
  const negRows: (string | number)[][] = [];
  for (const [g, list] of G) {
    const n = negativeCandidates(list as string[]);
    if (!n.length) negRows.push([g, S("لا توجد", "None found", "نییە"), "-"]);
    for (const x of n) negRows.push([g, x.keyword, S("قاعدة: ", "Rule: ", "یاسا: ") + x.rule]);
  }

  // 8. Sources (real links only)
  const src = new Set<string>();
  for (const p of input.parties) if (p.url) src.add(p.url);
  for (const a of answers) for (const u of a.urls || []) if (/^https?:\/\//.test(u)) src.add(u);
  for (const s of input.social || []) if (/^https?:\/\//.test(s.url)) src.add(s.url);
  const srcRows: (string | number)[][] = [...src].map((u) => [u]);
  if (input.hasFile) for (const s of input.sheets) srcRows.push([S("الملف المرفق: ", "Attached file: ", "فایل: ") + s.name]);

  const table = (heading: string, columns: string[], data: (string | number)[][]): ExportSection => ({ heading, kind: "table", table: { columns, data: data.length ? data : [columns.map((_, i) => (i === 0 ? NM : "-"))] } });
  const sections: ExportSection[] = [
    table(S("1. كلمات العلامة: الحالية والجديدة", "1. Brand keywords: current and new", "1. وشەکانی براند"), brandCols, brandRows),
    table(S("2. المنافسون وكلماتهم", "2. Competitors and their keywords", "2. ڕکابەران"), [S("المنافس", "Competitor", "ڕکابەر"), S("الرابط", "URL", "بەستەر"), S("الكلمة", "Keyword", "وشە"), S("حصة الصوت", "Share of voice", "بەشی دەنگ"), S("الكثافة", "Density", "چڕی"), S("كثافة الحقائق", "Fact density", "ڕاستی"), S("السلطة", "Authority", "دەسەڵات"), S("رأي النماذج", "Model opinion", "ڕا")], compRows),
    table(S("3. المقارنة بين العلامة والمنافسين", "3. Brand vs competitors", "3. بەراورد"), [S("الكلمة", "Keyword", "وشە"), S("الحالة", "Status", "دۆخ"), S("لدى", "Held by", "لای"), S("التقييم", "Assessment", "هەڵسەنگاندن")], cmpRows),
    table(S("4. التواصل الاجتماعي", "4. Social media", "4. سۆشیال"), [S("الطرف", "Party", "لایەن"), S("الرابط", "URL", "بەستەر"), S("الكلمات الموجودة", "Keywords found", "وشەکان"), S("كثافة ذكر الاسم", "Name mention density", "چڕی ناو")], socialRows),
    table(S("5. المحاور الستة (تقدير بقاعدة مكتوبة، ليس قياساً حياً)", "5. Six axes (rule-based estimate, not a live measurement)", "5. شەش تەوەر (خەمڵاندن)"), [S("الكلمة", "Keyword", "وشە"), ...AXES_ORDER], axisRows),
    table(S("6. مدة تغذية النماذج بالكلمات", "6. Time for models to absorb keywords", "6. ماوەی تێگەیشتن"), [S("الكلمة", "Keyword", "وشە"), S("الفهرسة الأولية", "Initial indexing", "سەرەتایی"), S("الاستيعاب الشامل", "Full absorption", "تەواو")], ingRows),
    table(S("7. الكلمات السلبية", "7. Negative keywords", "7. وشە نەرێنییەکان"), [S("المجموعة", "Group", "گروپ"), S("الكلمة", "Keyword", "وشە"), S("السبب", "Reason", "هۆکار")], negRows),
    table(S("8. المصادر", "8. Sources", "8. سەرچاوەکان"), [S("المصدر", "Source", "سەرچاوە")], srcRows),
  ];
  return sanitizeDeep(sections, l === "ar" ? "ar" : "en");
}
