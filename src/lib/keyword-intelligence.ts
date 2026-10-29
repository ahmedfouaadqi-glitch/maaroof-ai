// Pure: builds the six-sheet keyword intelligence result from recorded evidence only.
// Anything not measured reads "not measured"; no invented numbers.
import { isPlatformUrl } from "./site-keyword-extractor";
import type { ExportSection, ExportLang } from "./exports";
import type { ResearchInput, EngineAnswer, PartyEvidence } from "./operational-workbook";
import { allKeywords, authoritySignals, factDensity, negativeCandidates } from "./operational-workbook";
import { measureKeywordAxes, LIVE_AXES, type LiveAxis, type LiveSearchEvidence } from "./live-keyword-axes";
import { extractSiteKeywords } from "./site-keyword-extractor";
import { sanitizeDeep } from "./brand-sanitize";

export const AXES_ORDER = ["SEO", "AEO", "GEO", "SGE", "GSEO", "SGEO"] as const;

export type KiInput = ResearchInput & {
  /** True when the user attached a keyword file; false = keywords came from the site scan. */
  hasFile: boolean;
  /** Live provider results, present only when the user explicitly opted into live search. */
  liveSearchEvidence?: LiveSearchEvidence[];
  liveSerpRequested?: boolean;
  contentLanguage?: string;
  /** New keywords proposed literally by the ten engines (keyword-discovery.ts). */
  discovered?: import("./keyword-discovery").DiscoveredKeyword[];
  /** When set, only these file keywords were measured live in this run. */
  sampleKeywords?: string[];
  /** Exact market+keyword pairs measured live in this run. */
  sampledMarketKeywords?: Array<{ market: string; keyword: string }>;
  totalKeywords?: number;
  charged?: number;
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
export function newKeywordCandidates(brandList: string[], competitors: PartyEvidence[], answers: EngineAnswer[], max = 40): Array<{ keyword: string; from: "competitor" | "engines"; party?: string; sourceUrl?: string; snippet?: string }> {
  const have = new Set(brandList.map(norm));
  const out: Array<{ keyword: string; from: "competitor" | "engines"; party?: string; sourceUrl?: string; snippet?: string }> = [];
  const seen = new Set<string>();
  const excerpt = (text: string | null | undefined, keyword: string) => {
    const source = String(text || "");
    const at = norm(source).indexOf(norm(keyword));
    return at < 0 ? "" : source.slice(Math.max(0, at - 100), Math.min(source.length, at + keyword.length + 180)).replace(/\s+/g, " ").trim();
  };
  const push = (k: string, from: "competitor" | "engines", party?: string, sourceUrl?: string, sourceText?: string) => {
    const n = norm(k);
    if (have.has(n) || seen.has(n)) return;
    seen.add(n);
    out.push({ keyword: k, from, party, sourceUrl, snippet: excerpt(sourceText, k) });
  };
  for (const c of competitors) {
    const sourcePages = [
      { url: c.url || undefined, text: c.pageText, title: c.title, description: c.description },
      ...(c.additionalPages || []),
    ];
    for (const page of sourcePages) {
      for (const k of extractSiteKeywords({ text: page.text, title: page.title || c.title || undefined, description: page.description || c.description || undefined }, 20)) {
        if (k.keyword.includes(" ")) push(k.keyword, "competitor", c.name, page.url, page.text);
      }
    }
  }
  const answerText = answers.filter((a) => a.status === "answered").map((a) => a.answer).join("\n");
  for (const k of extractSiteKeywords({ text: answerText }, 30)) if (k.keyword.includes(" ")) push(k.keyword, "engines", undefined, undefined, answerText);
  return out.slice(0, max);
}

export function buildKeywordIntelligenceSections(input: KiInput): ExportSection[] {
  const l = input.lang;
  const S = (ar: string, en: string, ku: string) => t3(l, ar, en, ku);
  const NM = S("لم تُقس", "Not measured", "نەپێوراوە");
  const brand = input.parties.find((p) => p.role === "brand");
  // Social/publishing platforms are never commercial competitors; they belong in the social section.
  const comps = input.parties.filter((p) => p.role === "competitor" && !isPlatformUrl(p.url));
  const answers = input.engineAnswers;
  const brandList = input.hasFile
    ? allKeywords(input.sheets)
    : extractSiteKeywords({ text: brand?.pageText, title: brand?.title, description: brand?.description }, 60).map((k) => k.keyword);
  const discoveredMap = new Map((input.discovered || []).map((d) => [norm(d.keyword), d]));
  const competitorCandidates = newKeywordCandidates(brandList, comps, [], Math.min(200, 40 * Math.max(1, input.markets.length)));
  const discoveryCandidates = (input.discovered || []).map((d) => ({
    keyword: d.keyword, from: "engines" as const, sourceUrl: undefined, snippet: d.snippet,
  }));
  // Keep competitor-derived opportunities even when engine discovery is available.
  // Deduplicate by normalized phrase, preferring a literal competitor-page source when present.
  const fresh: Array<{ keyword: string; from: "competitor" | "engines"; party?: string; sourceUrl?: string; snippet?: string }> =
    [...new Map([...discoveryCandidates, ...competitorCandidates].map((item) => [norm(item.keyword), item])).values()].slice(0, Math.min(400, 80 * Math.max(1, input.markets.length)));
  const sampleSet = input.sampleKeywords ? new Set(input.sampleKeywords.map(norm)) : null;
  const sampledPairSet = input.sampledMarketKeywords
    ? new Set(input.sampledMarketKeywords.map((item) => item.market + "|" + norm(item.keyword)))
    : null;
  const authority = (p?: PartyEvidence) => {
    if (!p?.pageText) return NM;
    const a = authoritySignals(p);
    const count = [a.title, a.description, a.phone, a.email, a.about, a.faq].filter(Boolean).length;
    return String(count) + "/6 " + S(
      "(إشارات داخل الصفحة؛ سلطة الروابط الخلفية لم تُقَس لغياب بيانات روابط مرجعية)",
      "(on-page signals; backlink authority not measured because verified backlink data is unavailable)",
      "(نیشانەی ناو پەڕە؛ دەسەڵاتی بەستەری دەرەوە نەپێوراوە)"
    );
  };
  const partyText = (p?: PartyEvidence) => [p?.pageText, ...(p?.additionalPages || []).map((page) => page.text)].filter(Boolean).join("\n");
  const facts = (p?: PartyEvidence) => { const f = factDensity(partyText(p) || null); return f ? f.per100 : NM; };
  const opinion = (k: string) => {
    const keyword = norm(k);
    const clusterProbes = (input.clusterAnswers || []).filter((answer) =>
      answer.keywords.some((phrase) => norm(phrase) === keyword)
    );
    const keywordSpecificProbes = answers.filter((answer) =>
      answer.probe_kind === "keyword_visibility" && norm(answer.query || "").includes(keyword)
    );
    const marketProbes = keywordSpecificProbes.length
      ? keywordSpecificProbes
      : clusterProbes.length
        ? clusterProbes
        : answers.filter((answer) => norm(answer.query || "").includes(keyword));
    // Every successful answer counts, whichever route delivered it.
    const direct = marketProbes.filter((answer) => answer.status === "answered");
    if (!marketProbes.length || !direct.length) return { share: NM, engines: NM };
    const mentioned = [...new Set(direct.filter((answer) => norm(answer.answer).includes(norm(input.brand))).map((answer) => answer.engine))];
    return {
      share: `${mentioned.length}/${direct.length}`,
      engines: mentioned.join(", ") || S("لم تذكرها إجابات المحركات", "No literal mention in engine answers", "لە وەڵامە ڕاستەوخۆکاندا باس نەکراوە"),
    };
  };
  const density = (p: PartyEvidence | undefined, k: string) => { const d = keywordDensity(partyText(p), k); return d === null ? NM : d; };

  // 1. Brand keywords (current + new)
  const SRC_CUR = input.hasFile ? S("من الملف", "From file", "لە فایل") : S("من فحص الموقع", "From site scan", "لە پشکنینی ماڵپەڕ");
  const brandCols = [S("الكلمة", "Keyword", "وشە"), S("النوع", "Type", "جۆر"), S("المصدر", "Source", "سەرچاوە"), S("حصة الصوت في النماذج", "Share of voice in models", "بەشی دەنگ"), S("الكثافة في صفحة العلامة (/100 كلمة)", "Density on brand page (/100 words)", "چڕی"), S("كثافة الحقائق", "Fact density", "چڕی ڕاستییەکان"), S("إشارات السلطة داخل الصفحة", "On-page authority signals", "نیشانەی دەسەڵاتی ناو پەڕە"), S("رأي النماذج", "Model opinion", "ڕای مۆدێلەکان")];
  if (input.hasFile) brandCols.push(S("مقارنة القديم بالجديد", "Old vs new", "کۆن و نوێ"));
  brandCols.push(S("المحركات التي اقترحتها", "Engines that proposed it", "مۆدێلە پێشنیارکەرەکان"), S("مقتطف الإجابة", "Answer excerpt", "پارچەی وەڵام"));
  const brandRows: (string | number)[][] = [];
  for (const k of brandList) { const o = opinion(k); const r: (string | number)[] = [k, S("حالية", "Current", "ئێستا"), SRC_CUR, o.share, density(brand, k), facts(brand), authority(brand), o.engines]; if (input.hasFile) r.push(S("موجودة في الملف", "In file", "لە فایلدا")); r.push("-", "-"); brandRows.push(r); }
  for (const n of fresh) { const o = opinion(n.keyword); const d = discoveredMap.get(norm(n.keyword)); const r: (string | number)[] = [n.keyword, d ? (d.confirmed ? S("جديدة", "New", "نوێ") : S("جديدة — إشارة من محرك واحد", "New — single-engine signal", "نوێ — یەک مۆدێل")) : S("جديدة", "New", "نوێ"), n.from === "competitor" ? S("من صفحة منافس", "From competitor page", "لە ڕکابەر") + (n.party ? `: ${n.party}` : "") + (n.sourceUrl ? " · " + n.sourceUrl : "") : S("من إجابات النماذج", "From model answers", "لە وەڵامی مۆدێل"), o.share, density(brand, n.keyword), NM, NM, o.engines]; if (input.hasFile) r.push(S("غير موجودة في الملف — فرصة", "Not in file — opportunity", "لە فایلدا نییە — دەرفەت")); r.push(d ? `${d.engines.length}/${d.answered || 10}: ${d.engines.join(", ")}` : (n.party || "-"), [d?.snippet, n.snippet].filter(Boolean).join(" | ") || "-"); brandRows.push(r); }

  // 2. Competitors
  const compKw = new Map<string, string[]>();
  const compRows: (string | number)[][] = [];
  for (const c of comps) {
    const sourcePages = [
      { url: c.url || undefined, text: c.pageText, title: c.title, description: c.description },
      ...(c.additionalPages || []),
    ];
    const list = [...new Set(sourcePages.flatMap((page) =>
      extractSiteKeywords({ text: page.text, title: page.title || c.title, description: page.description || c.description }, 25).map((item) => item.keyword)
    ))];
    compKw.set(c.name, list);
    if (!list.length) compRows.push([c.name, c.url || NM, NM, NM, NM, NM, NM, NM]);
    for (const k of list) {
      const sourcePage = sourcePages.find((page) =>
        extractSiteKeywords({ text: page.text, title: page.title || c.title, description: page.description || c.description }, 25)
          .some((item) => norm(item.keyword) === norm(k))
      );
      const o = opinion(k);
      compRows.push([c.name, sourcePage?.url || c.url || NM, k, o.share, density(c, k), facts(c), authority(c), o.engines]);
    }
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
      not_in_top_ten: "فُحصت أول عشر نتائج بحث فعلياً ولم يظهر موقع العلامة بينها",
      engine_citations_not_recorded: "لم تسجل إجابات المحركات روابط استشهاد لهذه الكلمة",
      gseo_requires_both_seo_and_geo_observations: "يتطلب هذا المحور قياس الترتيب (SEO) وذكر المحركات (GEO) معاً، وأحدهما لم يُقس",
      live_search_not_requested: "لم يُطلب فحص ترتيب مباشر (SERP) لهذه الكلمة في هذا الطلب",
      live_search_unavailable: "تعذر الوصول إلى نتائج البحث المباشرة لهذا السوق الجغرافي",
      live_search_not_completed: "لم يكتمل فحص نتائج البحث المباشرة لهذه الكلمة",
      target_site_missing: "لم يُحدد نطاق الموقع المستهدف للتحقق من ترتيبه",
      fewer_than_ten_results: "لم يقدم مزود البحث عشرة نتائج صالحة لإثبات الترتيب ضمن أول عشرة",
      keyword_not_probed_by_ten_engines: "الكلمة مستخلصة من المصدر ولم تُمرر في فحص مستقل مناسب للمحركات العشرة",
      fallback_answers_excluded: "لم تكتمل إجابات المحركات لهذه الكلمة",
      incomplete_ten_engine_evidence: "لم تُجب أي من المحركات العشرة على سؤال هذه الكلمة",
      brand_not_configured: "اسم العلامة غير محدد لقياس الذكر",
      aeo_requires_a_dedicated_answer_engine_measurement: "يتطلب هذا المحور قياساً مستقلاً لمحرك الإجابات؛ لا تتوفر أدلة كافية",
      answer_box_not_exposed_by_provider: "مزود البحث الحالي لا يكشف أدلة مقتبسات Answer Box",
      ai_overview_and_answer_box_not_exposed_by_provider: "مزود البحث الحالي لا يكشف اقتباسات Google AI Overviews أو Answer Boxes",
      gseo_requires_verified_dedicated_measurement: "لم يُنفذ قياس مستقل موثوق لمحور GSEO",
      sgeo_requires_verified_ai_citation_measurement: "لم يُنفذ قياس مستقل موثوق للاستشهادات التوليدية عبر البحث",
    };
    const en: Record<string, string> = {
      not_in_top_ten: "The top ten live results were checked and the brand site was not among them",
      engine_citations_not_recorded: "Engine answers recorded no citation links for this keyword",
      gseo_requires_both_seo_and_geo_observations: "GSEO needs both an SEO rank check and a GEO engine check; one was not measured",
      live_search_not_requested: "Direct SERP checking was not requested for this keyword in this run",
      live_search_unavailable: "Direct search results for this geographic market could not be retrieved",
      live_search_not_completed: "Live search checking did not complete for this keyword",
      target_site_missing: "No target website domain was supplied for ranking verification",
      fewer_than_ten_results: "The search provider returned fewer than ten valid results to verify top-ten position",
      keyword_not_probed_by_ten_engines: "The keyword was extracted from source data but was not independently probed by the ten engines",
      fallback_answers_excluded: "Engine answers for this keyword were incomplete",
      incomplete_ten_engine_evidence: "None of the ten engines answered the question for this keyword",
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
      if ((sampledPairSet && !sampledPairSet.has(market.code + "|" + norm(k))) ||
          (!sampledPairSet && sampleSet && !sampleSet.has(norm(k)))) {
        axisRows.push([
          k, l === "ar" ? market.ar : market.en,
          ...AXES_ORDER.map(() => NM),
          S("خارج العينة المختارة لهذا التشغيل", "Outside the sample selected for this run", "لە دەرەوەی نموونەی ئەم جارە"),
          S("لم تُقَس هذه الكلمة في التشغيل الحالي؛ لم تُنفذ لها فحوص حية ضمن العينة المختارة.", "This keyword was not measured in the current run because it was not included in the selected live sample.", "ئەم وشەیە لە نموونەی هەڵبژێردراوی پشکنینی ڕاستەوخۆدا نەبوو."),
          NM, NM, NM, NM
        ]);
        continue;
      }
      const measured = measureKeywordAxes({
        keyword: k,
        market: market.code,
        brand: input.brand,
        site: input.parties.find((p) => p.role === "brand")?.url,
        engineAnswers: answers,
        clusterAnswers: input.clusterAnswers,
        liveSearchEvidence: input.liveSearchEvidence,
        liveSerpRequested: input.liveSerpRequested === true,
      });
      const reasons = LIVE_AXES.filter((axis) => measured[axis].value === null)
        .map((axis) => `${axis}: ${explainReason(axis, measured[axis].reason || "measurement_unavailable")}`)
        .join(" | ");
      const evidenceDetailsText = LIVE_AXES.map((axis) => {
        const measurement = measured[axis];
        const reason = measurement.value === null ? explainReason(axis, measurement.reason || "measurement_unavailable") : "";
        const url = measurement.evidenceUrl ? ` URL: ${measurement.evidenceUrl}` : "";
        const pos = axis === "SEO" && measurement.position ? ` SERP position #${measurement.position}.` : "";
        const engineNames = measurement.engines?.length ? ` Engines: ${measurement.engines.join(", ")}.` : "";
        return `${axis}=${measurement.value === null ? NM : measurement.value}.${pos} ${reason}${url}${engineNames}`.trim();
      });
      const relatedAnswers = answers.filter((answer) =>
        answer.market === market.code && answer.status === "answered" &&
        norm(answer.query || "").includes(norm(k)) &&
        norm(answer.answer).includes(norm(input.brand))
      );
      const literalEngineEvidence = relatedAnswers.slice(0, 10).map((answer) => {
        const kwAt = norm(answer.answer).indexOf(norm(input.brand));
        const excerpt = kwAt < 0 ? answer.answer.slice(0, 240) : answer.answer.slice(Math.max(0, kwAt - 100), Math.min(answer.answer.length, kwAt + input.brand.length + 160));
        const links = (answer.urls || []).filter((url) => /^https?:\/\//i.test(url)).join(", ");
        return `${answer.engine}: “${excerpt.replace(/\s+/g, " ").trim()}”${links ? ` · ${links}` : ""}`;
      });
      const evidenceDetails = [...evidenceDetailsText ? [evidenceDetailsText] : [], ...literalEngineEvidence.map((item) => `Literal answer evidence: ${item}`)].join(" | ");
      const engines = measured.GEO.engines?.join(", ") || NM;
      const position = measured.SEO.position ? String(measured.SEO.position) : NM;
      const seoEvidence = measured.SEO.evidenceUrl || NM;
      const seoProvider = measured.SEO.value === null ? NM : S("نتيجة بحث حي", "Live search result", "ئەنجامی گەڕانی ڕاستەوخۆ");
      axisRows.push([
        k,
        l === "ar" ? market.ar : market.en,
        ...AXES_ORDER.map((axis) => measured[axis].value === null ? NM : measured[axis].value),
        reasons || S("اكتملت القياسات المتاحة لهذه الكلمة", "All requested available measurements completed for this keyword", "پێوانە بەردەستەکان تەواو بوون"),
        evidenceDetails,
        position,
        seoEvidence,
        seoProvider,
        engines,
      ]);
    }
  }

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
  for (const p of input.parties) {
    if (p.url) src.add(p.url);
    for (const page of p.additionalPages || []) if (page.url) src.add(page.url);
  }
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
  const measuredAxisCells = axisRows.reduce((count, row) => count + row.slice(2, 8).filter((value) => typeof value === "number").length, 0);
  const liveObserved = (input.liveSearchEvidence || []).filter((item) => item.status === "measured").length;
  const analysisRows: (string | number)[][] = [
    [S("العلامة", "Brand", "براند"), input.brand],
    [S("الأسواق المستهدفة", "Target markets", "بازاڕە ئامانجەکان"), markets.map((market) => l === "ar" ? market.ar : market.en).join(" / ") || NM],
    [S("الكلمات الحالية", "Current keywords", "وشەکانی ئێستا"), brandList.length],
    [S("فرص الكلمات الجديدة", "New keyword opportunities", "دەرفەتی وشە نوێیەکان"), fresh.length],
    [S("المنافسون", "Competitors", "ڕکابەران"), comps.length],
    [S("إجابات ناجحة من المحركات العشرة", "Successful answers from the ten engines", "وەڵامی سەرکەوتوو"), answers.filter((answer) => answer.status === "answered").length],
    [S("حجم العينة المقاسة من الكلي", "Measured sample of total", "قەبارەی نموونە"), sampleSet ? `${sampleSet.size}/${input.totalKeywords ?? brandList.length}` : `${brandList.length}/${brandList.length}`],
    [S("كلمات جديدة اقترحها محركان أو أكثر", "New keywords proposed by 2+ engines", "وشەی نوێ لە ٢+ مۆدێل"), (input.discovered || []).filter((d) => d.confirmed).length],
    [S("التكلفة الفعلية المخصومة", "Actual tokens charged", "تێچووی ڕاستەقینە"), input.charged ?? NM],
    [S("عمليات بحث حي ذات نتائج", "Live search checks with results", "پشکنینی گەڕانی ڕاستەوخۆ"), liveObserved],
    [S("قيم محاور مقاسة فعلياً", "Axis values actually measured", "بەها پێوراوە ڕاستەقینەکان"), measuredAxisCells],
    [S("قاعدة القياس", "Measurement rule", "یاسای پێوانە"), S("لا تُحتسب الدرجة دون دليل مسجل؛ غياب الدليل يظهر «لم تُقَس».", "Scores require recorded evidence; absent evidence remains “Not measured.”", "بەها بەبێ بەڵگەی تۆمارکراو ناژمێردرێت؛ بەڵگەی نەبوو بە «نەپێوراوە» دەردەکەوێت.")],
  ];
  const competitorAndComparisonRows: (string | number)[][] = [
    ...compRows,
    ...cmpRows.map((row) => [
      S("مقارنة الكلمات", "Keyword comparison", "بەراوردی وشەکان"),
      NM,
      row[0],
      row[1],
      NM,
      NM,
      NM,
      String(row[2]) + " · " + String(row[3]),
    ]),
    ...socialRows.map((row) => [
      row[0],
      row[1],
      S("نتيجة بحث اجتماعي", "Social search result", "ئەنجامی گەڕانی سۆشیال"),
      NM,
      row[2],
      row[3],
      NM,
      S("رابط ونتيجة بحث؛ لا يثبت غياب المنشورات عدم وجودها", "Observed search link; absence of results does not prove absence of posts", "بەستەر و ئەنجامی گەڕان؛ نەبوونی ئەنجام نەبوونی پۆست ناسەلمێنێت"),
    ]),
  ];
  const competitorColumns = [
    S("الجهة / نوع السجل", "Entity / record type", "لایەن / جۆری تۆمار"),
    S("الرابط", "URL", "بەستەر"),
    S("الكلمة / البند", "Keyword / item", "وشە / بڕگە"),
    S("الحصة / الحالة", "Share / status", "بەش / دۆخ"),
    S("الكثافة / الكلمات", "Density / keywords", "چڕی / وشەکان"),
    S("كثافة الحقائق", "Fact density", "چڕی ڕاستی"),
    S("إشارات السلطة داخل الصفحة", "On-page authority signals", "نیشانەی دەسەڵاتی ناو پەڕە"),
    S("الأدلة والملاحظات", "Evidence and notes", "بەڵگە و تێبینی"),
  ];
  const sections: ExportSection[] = [
    table(S("1. ملخص التحليل وحالة الأدلة", "1. Analysis summary and evidence status", "1. پوختەی شیکاری و دۆخی بەڵگە"), [S("المؤشر", "Indicator", "پێوەر"), S("القيمة", "Value", "بەها")], analysisRows),
    table(S("2. الكلمات الحالية والجديدة", "2. Current and new keywords", "2. وشەکانی ئێستا و نوێ"), brandCols, brandRows),
    table(S("3. المنافسون والمقارنات والإشارات الاجتماعية", "3. Competitors, comparisons and social signals", "3. ڕکابەران و بەراورد و نیشانە کۆمەڵایەتییەکان"), competitorColumns, competitorAndComparisonRows),
    table(S("4. مصفوفة المحاور الستة", "4. Six-axis measurement matrix", "4. تۆڕی پێوانەی شەش تەوەر"), [S("الكلمة", "Keyword", "وشە"), S("السوق", "Market", "بازاڕ"), ...AXES_ORDER, S("سبب عدم القياس", "Unmeasured reason", "هۆکاری نەپێوانە"), S("تفسير الدرجة والدليل الحرفي والرابط", "Score explanation, literal evidence and URL", "ڕوونکردنەوەی بەها و بەڵگەی وشەبەوشە و بەستەر"), S("موضع SEO", "SEO position", "شوێنی SEO"), S("رابط دليل SEO", "SEO evidence URL", "بەستەری بەڵگە"), S("مصدر القياس", "Measurement source", "سەرچاوەی پێوانە"), S("المحركات التي ذكرت العلامة", "Engines mentioning brand", "بزوێنەرەکانی باسکردنی براند")], axisRows),
    table(S("5. الكلمات السلبية — أربع مجموعات", "5. Negative keywords — four groups", "5. وشە نەرێنییەکان — چوار گروپ"), [S("المجموعة", "Group", "گروپ"), S("الكلمة", "Keyword", "وشە"), S("السبب", "Reason", "هۆکار")], negRows),
    table(S("6. سجل المصادر والروابط الحقيقية", "6. Real source-link registry", "6. تۆماری سەرچاوە و بەستەری ڕاستەقینە"), [S("الرابط أو ملاحظة المصدر", "URL or source note", "بەستەر یان تێبینی سەرچاوە")], srcRows),
  ];
  return sanitizeDeep(sections, l === "ar" ? "ar" : "en");
}
