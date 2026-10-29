// Pure: builds the eight-section keyword intelligence result from recorded evidence only.
// Anything not measured reads "not measured"; no invented numbers.
import type { ExportSection, ExportLang } from "./exports";
import type { ResearchInput, EngineAnswer, PartyEvidence } from "./operational-workbook";
import { allKeywords, authoritySignals, factDensity, negativeCandidates } from "./operational-workbook";
import { measureKeywordAxes, LIVE_AXES, type LiveAxis, type LiveSearchEvidence } from "./live-keyword-axes";
import { extractSiteKeywords } from "./site-keyword-extractor";
import { ingestionFor } from "./keyword-ingestion-timeline";
import { sanitizeDeep } from "./brand-sanitize";

export const AXES_ORDER = ["SEO", "AEO", "GEO", "SGE", "GSEO", "SGEO"] as const;

export type KiInput = ResearchInput & {
  /** True when the user attached a keyword file; false = keywords came from the site scan. */
  hasFile: boolean;
  /** Live provider results, present only when the user explicitly opted into live search. */
  liveSearchEvidence?: LiveSearchEvidence[];
  liveSerpRequested?: boolean;
  contentLanguage?: string;
  competitorValidation?: Array<{ name: string; url: string | null; category: string; status: "verified" | "sector_mismatch" | "insufficient_evidence" }>;
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
    ? allKeywords(input.sheets)
    : extractSiteKeywords({ text: brand?.pageText, title: brand?.title, description: brand?.description }, 60).map((k) => k.keyword);
  const fresh = newKeywordCandidates(brandList, comps, answers);
  const authority = (p?: PartyEvidence) => {
    if (!p?.pageText) return NM;
    const a = authoritySignals(p);
    return `${[a.title, a.description, a.phone, a.email, a.about, a.faq].filter(Boolean).length}/6`;
  };
  const facts = (p?: PartyEvidence) => { const f = factDensity(p?.pageText || null); return f ? f.per100 : NM; };
  const opinion = (k: string) => {
    const keyword = norm(k);
    const clusterProbes = (input.clusterAnswers || []).filter((answer) =>
      answer.keywords.some((phrase) => norm(phrase) === keyword)
    );
    const marketProbes = clusterProbes.length
      ? clusterProbes
      : answers.filter((answer) => norm(answer.query || "").includes(keyword));
    // Only primary replies from the named engines are eligible for direct mention reporting.
    // Fallback/gateway responses are useful context but are not direct observations of that engine.
    const direct = marketProbes.filter((answer) => answer.status === "answered" && answer.provider_path === "primary");
    if (!marketProbes.length || !direct.length) return { share: NM, engines: NM };
    const mentioned = [...new Set(direct.filter((answer) => norm(answer.answer).includes(keyword)).map((answer) => answer.engine))];
    return {
      share: `${mentioned.length}/${direct.length}`,
      engines: mentioned.join(", ") || S("لم تذكرها الإجابات المباشرة", "No literal mention in direct replies", "لە وەڵامە ڕاستەوخۆکاندا باس نەکراوە"),
    };
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
  for (const excluded of input.competitorValidation || []) {
    if (excluded.status === "sector_mismatch") cmpRows.push([
      excluded.name,
      S("مستبعد: قطاع مختلف", "Excluded: sector mismatch", "بوار جیاواز — لابراو"),
      excluded.category || NM,
      S("لم يُستخدم في المقارنة؛ تحقّق الموقع الرسمي", "Not used in comparison; official-site evidence", "لە بەراورددا بەکارنەهاتووە"),
    ]);
  }

  // 4. Social
  const socialRows: (string | number)[][] = [];
  const socialKw: string[] = [];
  for (const s of input.social || []) {
    const found = [...brandList, ...fresh.map((f) => f.keyword), ...allComp.keys()].filter((k) => k.length >= 3 && norm(s.text).includes(norm(k)));
    socialKw.push(...found);
    socialRows.push([s.party, s.url, found.slice(0, 15).join(", ") || S("لا كلمات مطابقة", "No matching keywords", "هیچ"), keywordDensity(s.text, s.party) ?? NM]);
  }

  // 5. Six axes (evidence-only; missing evidence stays unmeasured)
  const axisList = [...new Set([...brandList, ...fresh.map((f) => f.keyword)])];
  const markets = input.markets.length ? input.markets : [{ code: "unknown", en: "Unspecified market", ar: "سوق غير محدد", gl: "" }];
  const explainReason = (axis: LiveAxis, reason: string) => {
    const ar: Record<string, string> = {
      live_search_not_requested: "لم يُطلب فحص ترتيب مباشر (SERP) لهذه الكلمة في هذا الطلب",
      live_search_unavailable: "تعذر الوصول إلى نتائج البحث المباشرة لهذا السوق الجغرافي",
      live_search_not_completed: "لم يكتمل فحص نتائج البحث المباشرة لهذه الكلمة",
      target_site_missing: "لم يُحدد نطاق الموقع المستهدف للتحقق من ترتيبه",
      fewer_than_ten_results: "لم يقدم مزود البحث عشرة نتائج صالحة لإثبات الترتيب ضمن أول عشرة",
      keyword_not_probed_by_ten_engines: "الكلمة مستخلصة من المصدر ولم تُمرر في فحص مستقل مناسب للمحركات العشرة",
      fallback_answers_excluded: "الإجابات جاءت عبر مسار بديل ولا تُحتسب كقياس مباشر للمحركات المسماة",
      incomplete_ten_engine_evidence: "لم تتوفر إجابات مباشرة مكتملة من المحركات العشرة",
      brand_not_configured: "اسم العلامة غير محدد لقياس الذكر",
      aeo_requires_a_dedicated_answer_engine_measurement: "يتطلب هذا المحور قياساً مستقلاً لمحرك الإجابات؛ لا تتوفر أدلة كافية",
      answer_box_not_exposed_by_provider: "مزود البحث الحالي لا يكشف أدلة مقتبسات Answer Box",
      ai_overview_and_answer_box_not_exposed_by_provider: "مزود البحث الحالي لا يكشف اقتباسات Google AI Overviews أو Answer Boxes",
      gseo_requires_verified_dedicated_measurement: "لم يُنفذ قياس مستقل موثوق لمحور GSEO",
      sgeo_requires_verified_ai_citation_measurement: "لم يُنفذ قياس مستقل موثوق للاستشهادات التوليدية عبر البحث",
    };
    const en: Record<string, string> = {
      live_search_not_requested: "Direct SERP checking was not requested for this keyword in this run",
      live_search_unavailable: "Direct search results for this geographic market could not be retrieved",
      live_search_not_completed: "Live search checking did not complete for this keyword",
      target_site_missing: "No target website domain was supplied for ranking verification",
      fewer_than_ten_results: "The search provider returned fewer than ten valid results to verify top-ten position",
      keyword_not_probed_by_ten_engines: "The keyword was extracted from source data but was not independently probed by the ten engines",
      fallback_answers_excluded: "Responses used a fallback route and are excluded from direct named-engine measurement",
      incomplete_ten_engine_evidence: "A complete set of direct answers from all ten engines was not available",
      brand_not_configured: "No brand name was configured for mention measurement",
      aeo_requires_a_dedicated_answer_engine_measurement: "AEO requires a dedicated answer-engine measurement; sufficient evidence is unavailable",
      answer_box_not_exposed_by_provider: "The current search provider does not expose Answer Box citations",
      ai_overview_and_answer_box_not_exposed_by_provider: "The current search provider does not expose Google AI Overview or Answer Box citations",
      gseo_requires_verified_dedicated_measurement: "No dedicated, verified GSEO measurement was performed",
      sgeo_requires_verified_ai_citation_measurement: "No dedicated measurement of generative citations across search was performed",
    };
    const messages = l === "ar" ? ar : en;
    return messages[reason] || reason;
  };
  const axisRows: (string | number)[][] = [];
  for (const market of markets) {
    for (const k of axisList) {
      const measured = measureKeywordAxes({
        keyword: k,
        market: market.code,
        brand,
        site: input.parties.find((p) => p.role === "brand")?.url,
        engineAnswers: answers,
        clusterAnswers: input.clusterAnswers,
        liveSearchEvidence: input.liveSearchEvidence,
        liveSerpRequested: input.liveSerpRequested === true,
      });
      const reasons = LIVE_AXES.filter((axis) => measured[axis].value === null)
        .map((axis) => `${axis}: ${explainReason(axis, measured[axis].reason || "measurement_unavailable")}`)
        .join(" | ");
      const engines = measured.GEO.engines?.join(", ") || NM;
      const position = measured.SEO.position ? String(measured.SEO.position) : NM;
      const seoEvidence = measured.SEO.evidenceUrl || NM;
      const seoProvider = measured.SEO.provider || NM;
      axisRows.push([
        k,
        l === "ar" ? market.ar : market.en,
        ...AXES_ORDER.map((axis) => measured[axis].value === null ? NM : measured[axis].value),
        reasons || S("اكتملت القياسات المتاحة لهذه الكلمة", "All requested available measurements completed for this keyword", "پێوانە بەردەستەکان تەواو بوون"),
        position,
        seoEvidence,
        seoProvider,
        engines,
      ]);
    }
  }

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
  for (const validation of input.competitorValidation || []) {
    const status = validation.status === "verified"
      ? S("قطاع متحقق", "Sector verified", "بوار پشتڕاستکراوە")
      : validation.status === "sector_mismatch"
        ? S("قطاع غير مطابق — مستبعد", "Sector mismatch — excluded", "بوار ناگونجاو — لابراو")
        : S("أدلة غير كافية", "Insufficient evidence", "بەڵگەی کەم");
    srcRows.push([S("تدقيق المنافس: ", "Competitor validation: ", "پشکنینی ڕکابەر: ") + validation.name + " | " + status + " | " + (validation.category || NM) + " | " + (validation.url || NM)]);
  }

  const table = (heading: string, columns: string[], data: (string | number)[][]): ExportSection => ({ heading, kind: "table", table: { columns, data: data.length ? data : [columns.map((_, i) => (i === 0 ? NM : "-"))] } });
  const sections: ExportSection[] = [
    table(S("1. كلمات العلامة: الحالية والجديدة", "1. Brand keywords: current and new", "1. وشەکانی براند"), brandCols, brandRows),
    table(S("2. المنافسون وكلماتهم", "2. Competitors and their keywords", "2. ڕکابەران"), [S("المنافس", "Competitor", "ڕکابەر"), S("الرابط", "URL", "بەستەر"), S("الكلمة", "Keyword", "وشە"), S("حصة الصوت", "Share of voice", "بەشی دەنگ"), S("الكثافة", "Density", "چڕی"), S("كثافة الحقائق", "Fact density", "ڕاستی"), S("السلطة", "Authority", "دەسەڵات"), S("رأي النماذج", "Model opinion", "ڕا")], compRows),
    table(S("3. المقارنة بين العلامة والمنافسين", "3. Brand vs competitors", "3. بەراورد"), [S("الكلمة", "Keyword", "وشە"), S("الحالة", "Status", "دۆخ"), S("لدى", "Held by", "لای"), S("التقييم", "Assessment", "هەڵسەنگاندن")], cmpRows),
    table(S("4. التواصل الاجتماعي", "4. Social media", "4. سۆشیال"), [S("الطرف", "Party", "لایەن"), S("الرابط", "URL", "بەستەر"), S("الكلمات الموجودة", "Keywords found", "وشەکان"), S("كثافة ذكر الاسم", "Name mention density", "چڕی ناو")], socialRows),
    table(S("5. المحاور الستة (قياس قائم على الأدلة فقط)", "5. Six axes (evidence-only measurement)", "5. شەش تەوەر (پێوانەی بەڵگەدار)"), [S("الكلمة", "Keyword", "وشە"), S("السوق", "Market", "بازاڕ"), ...AXES_ORDER, S("سبب عدم القياس", "Unmeasured reason", "هۆکاری نەپێوانە"), S("موضع SEO", "SEO position", "شوێنی SEO"), S("رابط دليل SEO", "SEO evidence URL", "بەستەری بەڵگە"), S("مزود البحث", "Search provider", "دابینکەری گەڕان"), S("المحركات التي ذكرت العلامة", "Engines mentioning brand", "بزوێنەرەکانی باسکردنی براند")], axisRows),
    table(S("6. مدة تغذية النماذج بالكلمات", "6. Time for models to absorb keywords", "6. ماوەی تێگەیشتن"), [S("الكلمة", "Keyword", "وشە"), S("الفهرسة الأولية", "Initial indexing", "سەرەتایی"), S("الاستيعاب الشامل", "Full absorption", "تەواو")], ingRows),
    table(S("7. الكلمات السلبية", "7. Negative keywords", "7. وشە نەرێنییەکان"), [S("المجموعة", "Group", "گروپ"), S("الكلمة", "Keyword", "وشە"), S("السبب", "Reason", "هۆکار")], negRows),
    table(S("8. المصادر", "8. Sources", "8. سەرچاوەکان"), [S("المصدر", "Source", "سەرچاوە")], srcRows),
  ];
  return sanitizeDeep(sections, l === "ar" ? "ar" : "en");
}
