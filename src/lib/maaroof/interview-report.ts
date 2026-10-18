import type { InterviewDomain, InterviewState, InterviewTargetType } from "@/lib/maaroof/interview-engine";
import type { InterviewResearchSource } from "@/lib/maaroof/interview-research";

export type InterviewReportLocale = "ar" | "en" | "ku";
export type InterviewReportSection = {
  id: string;
  title: string;
  findings: string[];
  gaps: string[];
  recommendations: string[];
  measurementNote: string;
};
export type InterviewReport = {
  title: string;
  generatedAt: string;
  targetName: string;
  targetType: InterviewTargetType;
  locale: InterviewReportLocale;
  evidenceLevel: "insufficient" | "initial" | "multi_source";
  evidenceSummary: string;
  objective: string;
  sections: InterviewReportSection[];
  sources: Array<Pick<InterviewResearchSource, "title" | "url" | "domain" | "description" | "snippet">>;
};

const LABELS: Record<InterviewReportLocale, Record<string, string>> = {
  ar: {
    report: "تقرير تحسين الظهور والبحث",
    insufficient: "الأدلة الخارجية غير كافية؛ هذا تقرير سياق أولي",
    initial: "تقرير أولي يستند إلى سياق المقابلة ومصادر خارجية",
    multi: "تقرير أولي مدعوم بعدة مصادر خارجية مستقلة",
    seo: "تحسين محركات البحث (SEO)",
    aeo: "تحسين محركات الإجابات (AEO)",
    geo: "الظهور في الإجابات التوليدية (GEO)",
    general: "السياق والأهداف",
    gseo: "تجربة البحث التوليدي (GSEO)",
    objective: "الهدف",
    audience: "الجمهور",
    success: "مؤشر النجاح",
    website: "الموقع",
    searchGoal: "هدف البحث",
    questions: "أسئلة الجمهور",
    facts: "مصادر الحقائق",
    queries: "استعلامات GEO",
    engines: "المنصات المستهدفة",
    missing: "لم تُجمع إجابة مؤكدة خلال المقابلة.",
    noSources: "لم تُحفظ مصادر خارجية لهذا التقرير.",
    seoNote: "لم يُنفّذ تدقيق زحف أو فهرسة أو تحليل Search Console ضمن هذا التقرير؛ لا تُعد هذه النقاط نتائج تدقيق تقني.",
    aeoNote: "هذا تقييم لتغطية الأسئلة والمصادر المصرّح بها، وليس قياسًا آليًا لظهور إجابات الموقع.",
    geoNote: "لم يُنفّذ اختبار ظهور فعلي على محركات الذكاء الاصطناعي؛ لا يمكن استنتاج الحضور أو الحصة من الإجابات وحدها.",
    generalNote: "تُعرض إجابات المقابلة كمدخلات صرّح بها المستخدم، وليست حقائق مستقلة تم التحقق منها.",
    sourceAction: "تحقق من المصادر قبل اعتماد الادعاءات، وسجّل أي تعارض بينها.",
    crawlAction: "نفّذ فحصًا تقنيًا للموقع وافحص بيانات Search Console قبل تقرير ترتيب أو فهرسة.",
    aeoAction: "أنشئ إجابات مباشرة للأسئلة ذات الأولوية، واربط الادعاءات بمصادر أولية واضحة.",
    geoAction: "شغّل اختبارات ظهور منفصلة لكل منصة ولغة وسوق، واحفظ الأسئلة وتاريخ القياس.",
  },
  en: {
    report: "Search and AI Visibility Report",
    insufficient: "External evidence is insufficient; this is a context baseline",
    initial: "Initial report based on interview context and external sources",
    multi: "Initial report supported by multiple independent external sources",
    seo: "Search Engine Optimization (SEO)",
    aeo: "Answer Engine Optimization (AEO)",
    geo: "Generative Engine Optimization (GEO)",
    general: "Context and objectives",
    gseo: "Generative Search Experience (GSEO)",
    objective: "Objective",
    audience: "Audience",
    success: "Success metric",
    website: "Website",
    searchGoal: "Search goal",
    questions: "Audience questions",
    facts: "Fact sources",
    queries: "GEO queries",
    engines: "Target engines",
    missing: "No confirmed answer was collected during the interview.",
    noSources: "No external sources have been saved for this report.",
    seoNote: "No crawl, indexation, or Search Console audit was run for this report; these are not technical audit findings.",
    aeoNote: "This assesses declared question coverage and sources, not measured answer visibility.",
    geoNote: "No live AI-engine visibility probe was run; presence or share of voice cannot be inferred from interview answers alone.",
    generalNote: "Interview responses are user-provided inputs, not independently verified facts.",
    sourceAction: "Verify sources before relying on claims and record any contradictions.",
    crawlAction: "Run a technical site crawl and inspect Search Console before making ranking or indexation claims.",
    aeoAction: "Create direct answers to priority questions and link claims to clear primary sources.",
    geoAction: "Run separate visibility probes per engine, language, and market, recording queries and measurement dates.",
  },
  ku: {
    report: "ڕاپۆرتی گەڕان و دەرکەوتنی زیرەکی دەستکرد",
    insufficient: "بەڵگەی دەرەکی بەس نییە؛ ئەمە بنەمایەکی سەرەتاییی کۆنتێکستە",
    initial: "ڕاپۆرتی سەرەتایی لەسەر کۆنتێکستی چاوپێکەوتن و سەرچاوە دەرەکییەکان",
    multi: "ڕاپۆرتی سەرەتایی پشتگیریکراو بە چەند سەرچاوەی سەربەخۆ",
    seo: "باشترکردنی مۆتۆڕەکانی گەڕان (SEO)",
    aeo: "باشترکردنی وەڵامی گەڕان (AEO)",
    geo: "دەرکەوتن لە وەڵامە زایەندەکان (GEO)",
    general: "کۆنتێکست و ئامانجەکان",
    gseo: "ئەزموونی گەڕانی زایەندە (GSEO)",
    objective: "ئامانج",
    audience: "جەماوەر",
    success: "پێوەری سەرکەوتن",
    website: "ماڵپەڕ",
    searchGoal: "ئامانجی گەڕان",
    questions: "پرسیارەکانی جەماوەر",
    facts: "سەرچاوەی ڕاستییەکان",
    queries: "پرسیارەکانی GEO",
    engines: "مۆتۆڕە ئامانجەکان",
    missing: "لە چاوپێکەوتندا وەڵامێکی پشتڕاستکراو کۆنەکراوەتەوە.",
    noSources: "هیچ سەرچاوەیەکی دەرەکی بۆ ئەم ڕاپۆرتە پاشەکەوت نەکراوە.",
    seoNote: "پشکنینی crawl یان index یان Search Console نەکراوە؛ ئەمانە ئەنجامی پشکنینی تەکنیکی نین.",
    aeoNote: "ئەمە پۆششی پرسیار و سەرچاوە دیاریکراوەکان هەڵدەسەنگێنێت، نەک دەرکەوتنی پێوانەکراوی وەڵامەکان.",
    geoNote: "تاقیکردنەوەی ڕاستەوخۆی دەرکەوتن لە مۆتۆڕەکانی AI نەکراوە؛ لە وەڵامەکانەوە ناتوانرێت ئامادەبوون یان بەشی دەنگ دەربهێنرێت.",
    generalNote: "وەڵامەکانی چاوپێکەوتن زانیاریی پێشکەشکراوی بەکارهێنەرن، نەک ڕاستیی پشتڕاستکراوی سەربەخۆ.",
    sourceAction: "پێش پشتبەستن بە بانگەشەکان سەرچاوەکان پشتڕاست بکەرەوە و ناکۆکییەکان تۆمار بکە.",
    crawlAction: "پێش هەر بانگەشەیەک دەربارەی ڕیزبەندی یان index، پشکنینی تەکنیکی و Search Console بکە.",
    aeoAction: "وەڵامی ڕاستەوخۆ بۆ پرسیارە گرنگەکان دروست بکە و بانگەشەکان بە سەرچاوەی سەرەکی ببەستەوە.",
    geoAction: "تاقیکردنەوەی جیا بۆ هەر مۆتۆڕ و زمان و بازاڕێک بکە و پرسیار و کاتی پێوانەکردن تۆمار بکە.",
  },
};

const FIELD_BY_QUESTION: Record<string, string> = {
  objective: "objective",
  audience: "audience",
  success_measure: "success",
  seo_property: "website",
  seo_search_goal: "searchGoal",
  aeo_questions: "questions",
  aeo_facts: "facts",
  geo_queries: "queries",
  geo_engines: "engines",
};

function answerText(state: InterviewState, id: string, missing: string): string {
  const answer = state.answers[id];
  if (!answer || answer.status !== "answered" || answer.value === null) return missing;
  return Array.isArray(answer.value) ? answer.value.join(", ") : String(answer.value);
}

function section(
  id: string,
  title: string,
  findings: string[],
  gaps: string[],
  recommendations: string[],
  measurementNote: string,
): InterviewReportSection {
  return { id, title, findings, gaps, recommendations, measurementNote };
}

/** Build an evidence-aware baseline report; it deliberately does not invent audit or engine-probe results. */
export function buildInterviewReport(input: {
  targetType: InterviewTargetType;
  targetName: string;
  goal?: string | null;
  domains: InterviewDomain[];
  locale: InterviewReportLocale;
  state: InterviewState;
  sources: InterviewResearchSource[];
  generatedAt?: string;
}): InterviewReport {
  const L = LABELS[input.locale];
  const missing = L.missing;
  const findings = (ids: string[]) => ids.map((id) => {
    const label = L[FIELD_BY_QUESTION[id] || id] || id;
    return label + ": " + answerText(input.state, id, missing);
  });
  const gaps = (ids: string[]) => ids.filter((id) => answerText(input.state, id, "").length === 0)
    .map((id) => L[FIELD_BY_QUESTION[id] || id] || id);
  const sections: InterviewReportSection[] = [];
  const selected = new Set(input.domains);
  const sourceCount = new Set(input.sources.map((source) => source.domain)).size;
  const evidenceLevel = sourceCount >= 3 ? "multi_source" : input.sources.length > 0 ? "initial" : "insufficient";

  sections.push(section(
    "general",
    L.general,
    findings(["objective", "audience", "success_measure"]),
    gaps(["objective", "audience", "success_measure"]),
    input.sources.length ? [L.sourceAction] : [L.noSources, L.sourceAction],
    L.generalNote,
  ));

  if (selected.has("seo")) {
    sections.push(section(
      "seo",
      L.seo,
      findings(["seo_property", "seo_search_goal"]),
      gaps(["seo_property", "seo_search_goal"]),
      [L.crawlAction],
      L.seoNote,
    ));
  }
  if (selected.has("aeo")) {
    sections.push(section(
      "aeo",
      L.aeo,
      findings(["aeo_questions", "aeo_facts"]),
      gaps(["aeo_questions", "aeo_facts"]),
      [L.aeoAction],
      L.aeoNote,
    ));
  }
  if (selected.has("geo")) {
    sections.push(section(
      "geo",
      L.geo,
      findings(["geo_queries", "geo_engines"]),
      gaps(["geo_queries", "geo_engines"]),
      [L.geoAction],
      L.geoNote,
    ));
  }
  if (selected.has("gseo")) {
    sections.push(section(
      "gseo",
      L.gseo,
      findings(["gseo_journey", "gseo_friction"]),
      gaps(["gseo_journey", "gseo_friction"]),
      [L.sourceAction],
      L.generalNote,
    ));
  }

  const statusKey = evidenceLevel === "multi_source" ? "multi" : evidenceLevel === "initial" ? "initial" : "insufficient";
  return {
    title: L.report,
    generatedAt: input.generatedAt || new Date().toISOString(),
    targetName: input.targetName,
    targetType: input.targetType,
    locale: input.locale,
    evidenceLevel,
    evidenceSummary: L[statusKey],
    objective: input.goal || answerText(input.state, "objective", missing),
    sections,
    sources: input.sources.map(({ title, url, domain, description, snippet }) => ({ title, url, domain, description, snippet })),
  };
}
