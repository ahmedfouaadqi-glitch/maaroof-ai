// Pure: complete task export, including partial tool outputs and explicit SEO/AEO/GEO/SGE/GSEO cards.
import type { ExportPayload, ExportSection, ExportLang } from "@/lib/exports";
import { packSections, linksSection, entityFromResult, engineAnswerSections, engineAnswersOf, buildPack } from "@/lib/machine-pack";
import { payloadFromResult } from "@/lib/export-bus";

export type TaskToolResult = { tool: string; ok: boolean; output: any };
const BANNED = /fire\s*crawl/gi;
const isUrl = (v: unknown): v is string => typeof v === "string" && /^https?:\/\/[^\s]+$/i.test(v);

const TX = {
  ar: {
    summary: "الخلاصة", engines: "إجابات المحركات", tool: "نتيجة الأداة", complete: "مكتمل", partial: "غير مكتمل أو فشل",
    seo: "بطاقة SEO — المتانة الفنية والفهرسة والزواحف", aeo: "بطاقة AEO — جاهزية الإجابة والكيان", geo: "بطاقة GEO — الحضور في إجابات النماذج",
    sge: "بطاقة SGE — تجربة البحث التوليدي والبيانات المنظمة", gseo: "بطاقة GSEO — التحسين التوليدي الشامل",
    fields: "الحقول والأدلة المسجلة", sourceTool: "الأداة / المسار", value: "القيمة المسجلة", resultStatus: "حالة الأدلة المتاحة",
    notMeasured: "لم تُسجّل نتيجة متاحة لهذا القياس؛ يلزم فحص مباشر قبل تقرير وجود المشكلة أو عدمها.",
    entity: "الكيان الذي فُحص", facts: "حقائق واردة في النتائج", faqCount: "الأسئلة والأجوبة المتاحة", schema: "بيانات منظمة مرصودة",
    generatedSchema: "بيانات منظمة مقترحة داخل التصدير", notDeployed: "توليد الكود داخل التقرير لا يثبت أنه نُشر على الموقع.",
    asked: "النماذج التي طُلب منها الرد", answered: "النماذج التي أجابت", mentions: "الإجابات التي ذكرت العلامة", rate: "معدل الذكر بين الإجابات",
    question: "السؤال الأعمى غير المتحيز", groundQuestion: "سؤال تدقيق الأدلة", engine: "النموذج", status: "الحالة",
    mention: "ذكر العلامة", rank: "الترتيب", candidates: "الأسماء المرشحة", answer: "الإجابة المسجلة", sources: "المصادر الفعلية",
    noAnswers: "لا توجد إجابات نماذج مسجلة قابلة للقياس في النتائج المتاحة.", noSources: "لا توجد روابط مصدر فعلية مسجلة في مخرجات الأدوات.",
    schemaObserved: "وجود Schema.org / JSON-LD في الموقع", contentDepth: "عمق النص المتاح للفحص", contentWords: "عدد الكلمات في النص المتاح",
    externalSources: "عدد روابط المصادر الخارجية المسجلة", recommendations: "توصيات ومؤشرات وردت فعلياً في نتائج الأدوات",
    roadmap: "خارطة طريق مقترحة لمدة 90 يوماً — خطة متابعة وليست نتيجة قياس",
    days1: "الأيام 1–30: قياس robots.txt وsitemap.xml وأكواد HTTP وCanonical وH1 والروابط الداخلية. أصلح فقط البنود التي يثبت الفحص وجود خلل فيها.",
    days2: "الأيام 31–60: راجع بطاقة حقيقة الكيان والأسئلة المعتمدة، وولّد Schema.org وFAQPage من معلومات موثوقة؛ تحقّق من ظهورها الفعلي على صفحات الموقع.",
    days3: "الأيام 61–90: أعد فحص النماذج العشرة، وقارن معدل الذكر والترتيب والمصادر مع خط الأساس، ثم حدّث الصفحات وفق الفجوات المثبتة.",
    noEntity: "لم يُعثر على اسم كيان موثوق ضمن مخرجات الأدوات؛ لم يتم اختلاق كيان أو بيانات منظمة له.",
    noText: "لا يتوفر نص صفحة طويل ضمن النتائج لتقدير عمق المحتوى.",
  },
  en: {
    summary: "Summary", engines: "Engine answers", tool: "Tool result", complete: "Complete", partial: "Incomplete or failed",
    seo: "SEO card — technical health, indexing and crawlers", aeo: "AEO card — answer readiness and entity facts", geo: "GEO card — presence in model answers",
    sge: "SGE card — generative search and structured data", gseo: "GSEO card — end-to-end generative optimization",
    fields: "Recorded fields and evidence", sourceTool: "Tool / path", value: "Recorded value", resultStatus: "Available evidence status",
    notMeasured: "No available result recorded this measurement; run a direct check before concluding a defect exists or does not exist.",
    entity: "Examined entity", facts: "Facts present in results", faqCount: "Available FAQs", schema: "Observed structured-data fields",
    generatedSchema: "Structured data proposed in this export", notDeployed: "Generating code in this report does not prove that it is deployed on the website.",
    asked: "Models asked", answered: "Models that answered", mentions: "Answers mentioning the brand", rate: "Mention rate among answers",
    question: "Unbiased blind question", groundQuestion: "Evidence-audit question", engine: "Model", status: "Status",
    mention: "Brand mentioned", rank: "Rank", candidates: "Suggested names", answer: "Recorded answer", sources: "Actual sources",
    noAnswers: "No measurable model answers were recorded in the available results.", noSources: "No actual source URLs were recorded in tool outputs.",
    schemaObserved: "Schema.org / JSON-LD observed on the site", contentDepth: "Available page-text depth", contentWords: "Words in available text",
    externalSources: "Recorded external source URLs", recommendations: "Recommendations and indicators actually present in tool outputs",
    roadmap: "Suggested 90-day roadmap — follow-up plan, not a measured finding",
    days1: "Days 1–30: measure robots.txt, sitemap.xml, HTTP status, canonical, H1 and internal links. Fix only issues verified by the audit.",
    days2: "Days 31–60: review entity facts and approved FAQs; generate Schema.org and FAQPage from reliable information, then verify that they are actually present on site pages.",
    days3: "Days 61–90: rerun the ten-model probe, compare mention rate, rank and sources against a baseline, then update pages to address verified gaps.",
    noEntity: "No reliable entity name was found in tool outputs; no entity or structured data was invented.",
    noText: "No long-form page text is available to estimate content depth.",
  },
  ku: {
    summary: "پوختە", engines: "وەڵامەکانی بزوێنەرەکان", tool: "ئەنجامی ئامراز", complete: "تەواو", partial: "ناتەواو یان شکست‌هاتوو",
    seo: "کارتی SEO — تەندروستی تەکنیکی، ئیندێکس و کرالەر", aeo: "کارتی AEO — ئامادەیی وەڵام و زانیاری قەوارە",
    geo: "کارتی GEO — ئامادەبوون لە وەڵامی مۆدێلەکان", sge: "کارتی SGE — گەڕانی زایەندراو و داتای ڕێکخراو", gseo: "کارتی GSEO — باشکردنی گشتگیری بۆ گەڕانی زایەندراو",
    fields: "خانە و بەڵگە تۆمارکراوەکان", sourceTool: "ئامراز / ڕێڕەو", value: "بەهای تۆمارکراو", resultStatus: "دۆخی بەڵگەی بەردەست",
    notMeasured: "هیچ ئەنجامێک بۆ ئەم پێوانەیە تۆمار نەکراوە؛ پێش بڕیاردان پشکنینی ڕاستەوخۆ پێویستە.",
    entity: "قەوارەی پشکنینکراو", facts: "ڕاستییەکانی ناو ئەنجام", faqCount: "پرسیار و وەڵامی بەردەست", schema: "خانەکانی داتای ڕێکخراو",
    generatedSchema: "داتای ڕێکخراوی پێشنیارکراو لەم هەناردەیەدا", notDeployed: "دروستکردنی کۆد لە ڕاپۆرتدا بەڵگە نییە بۆ ئەوەی لە ماڵپەڕ بڵاوکراوەتەوە.",
    asked: "مۆدێلە پرسیارکراوەکان", answered: "مۆدێلە وەڵامدەرەوەکان", mentions: "وەڵامەکانی ناوی براند", rate: "ڕێژەی ئاماژە لە وەڵامەکان",
    question: "پرسیاری کوێرانەی بێلایەن", groundQuestion: "پرسیاری پشکنینی بەڵگە", engine: "مۆدێل", status: "دۆخ",
    mention: "ئاماژە بە براند", rank: "پلە", candidates: "ناوە پێشنیارکراوەکان", answer: "وەڵامی تۆمارکراو", sources: "سەرچاوە ڕاستەقینەکان",
    noAnswers: "هیچ وەڵامی مۆدێل بۆ پێوانەکردن تۆمار نەکراوە.", noSources: "هیچ بەستەری سەرچاوەی ڕاستەقینە تۆمار نەکراوە.",
    schemaObserved: "Schema.org / JSON-LD لە ماڵپەڕدا بینراوە", contentDepth: "قووڵایی دەقی بەردەست", contentWords: "ژمارەی وشە لە دەقی بەردەست",
    externalSources: "ژمارەی بەستەری دەرەکی تۆمارکراو", recommendations: "پێشنیار و نیشاندەرەکانی کە لە ئەنجامی ئامرازدا هەن",
    roadmap: "ڕێڕەوی پێشنیارکراوی 90 ڕۆژ — پلانی بەدواداچوون، نە ئەنجامی پێوانە",
    days1: "ڕۆژانی 1–30: robots.txt و sitemap.xml و HTTP و Canonical و H1 و بەستەرە ناوخۆییەکان بپشکنە. تەنها ئەو کێشانە چاک بکە کە بەڵگەیان هەیە.",
    days2: "ڕۆژانی 31–60: ڕاستییەکانی قەوارە و FAQ پشتڕاست بکەرەوە؛ Schema.org و FAQPage لە زانیاری متمانەپێکراو دروست بکە و بوونی لە ماڵپەڕ پشتڕاست بکەرەوە.",
    days3: "ڕۆژانی 61–90: پرسیاری دە مۆدێل دووبارە بکەوە، ڕێژەی ئاماژە و پلە و سەرچاوەکان بەراورد بکە، و پەڕەکان بەپێی کەلێنە پشتڕاستکراوەکان نوێ بکەرەوە.",
    noEntity: "ناوی قەوارەی متمانەپێکراو لە ئەنجامەکاندا نەدۆزرایەوە؛ قەوارە یان داتای ڕێکخراو دروست نەکرا.",
    noText: "دەقی درێژی پەڕە بەردەست نییە بۆ پێوانەکردنی قووڵایی ناوەڕۆک.",
  },
} as const;

function scrub<T>(value: T): T {
  return JSON.parse(JSON.stringify(value).replace(BANNED, "Maaroof")) as T;
}

function printable(value: any, max = 1100): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim().slice(0, max);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value).slice(0, max); } catch { return String(value).slice(0, max); }
}

type FieldHit = { tool: string; path: string; value: string };
function collectFields(results: TaskToolResult[], pattern: RegExp, max = 14): FieldHit[] {
  const hits: FieldHit[] = [];
  const seen = new Set<string>();
  const walk = (tool: string, value: any, path: string, depth: number) => {
    if (value == null || depth > 5 || hits.length >= max * 3) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v !== "object" || v == null) {
          if (pattern.test(path) && printable(v)) push(tool, path + "[" + i + "]", printable(v));
        } else walk(tool, v, path + "[" + i + "]", depth + 1);
      });
      return;
    }
    if (typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? path + "." + key : key;
      if (pattern.test(key) || pattern.test(childPath)) {
        const text = printable(child);
        if (text) push(tool, childPath, text);
      }
      if (child && typeof child === "object") walk(tool, child, childPath, depth + 1);
    }
  };
  const push = (tool: string, path: string, value: string) => {
    const key = tool + "|" + path;
    if (!seen.has(key)) { seen.add(key); hits.push({ tool, path, value }); }
  };
  for (const result of results) walk(result.tool + (result.ok ? "" : " (partial/failed)"), result.output, "", 0);
  return hits.slice(0, max);
}

type SourceHit = { tool: string; title: string; url: string };
function collectSourceLinks(results: TaskToolResult[]): SourceHit[] {
  const found = new Map<string, SourceHit>();
  const add = (tool: string, url: unknown, title: unknown) => {
    if (!isUrl(url) || found.has(url)) return;
    found.set(url, { tool, url, title: typeof title === "string" && title.trim() ? title.trim().slice(0, 180) : url });
  };
  const walk = (tool: string, value: any, keyPath: string, depth: number) => {
    if (value == null || depth > 6) return;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && /(source|citation|reference|link|url|href)/i.test(keyPath)) add(tool, item, item);
        else walk(tool, item, keyPath, depth + 1);
      }
      return;
    }
    if (typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string" && /(url|href|source|citation|reference|canonical|sitemap)/i.test(key)) {
        add(tool, child, (value as any).title || (value as any).name || key);
      } else if (child && typeof child === "object") walk(tool, child, key, depth + 1);
    }
  };
  for (const result of results) walk(result.tool, result.output, "", 0);
  return [...found.values()].slice(0, 60);
}

function pageTextMetrics(results: TaskToolResult[]): { tool: string; field: string; words: number }[] {
  const rows: { tool: string; field: string; words: number }[] = [];
  const walk = (tool: string, value: any, path: string, depth: number) => {
    if (value == null || depth > 5 || rows.length >= 10) return;
    if (Array.isArray(value)) { value.forEach((item, i) => walk(tool, item, path + "[" + i + "]", depth + 1)); return; }
    if (typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const next = path ? path + "." + key : key;
      if (typeof child === "string" && /(page.?text|markdown|html.?content|article.?text|main.?content|body.?text|content.?text)/i.test(key) && child.length >= 250) {
        rows.push({ tool, field: next, words: child.trim().split(/\s+/).filter(Boolean).length });
      } else if (child && typeof child === "object") walk(tool, child, next, depth + 1);
    }
  };
  for (const result of results) walk(result.tool, result.output, "", 0);
  return rows;
}

function bestProbe(results: TaskToolResult[]): any | null {
  let best: any = null;
  for (const result of results) {
    const probe = result.output?.probe || (Array.isArray(result.output?.answers) ? result.output : null);
    if (!probe || (!Array.isArray(probe.answers) && !probe.statuses && !probe.query)) continue;
    const count = Array.isArray(probe.answers) ? probe.answers.length : 0;
    const bestCount = Array.isArray(best?.answers) ? best.answers.length : 0;
    if (!best || count >= bestCount) best = probe;
  }
  return best;
}

function measurementRows(fields: FieldHit[], noData: string, emptyLabel: string): Array<[string, string | number]> {
  if (!fields.length) return [[emptyLabel, noData]];
  return fields.map((field) => [field.tool + " · " + field.path, field.value]);
}

export function buildTaskExportPayload(i: {
  title: string; goal: string; finalText: string; results: TaskToolResult[]; lang: ExportLang; markets?: string[];
}): ExportPayload {
  const T = TX[i.lang] || TX.en;
  // Preserve partial/error outputs too: a failed tool can still have useful diagnostics or
  // a partially persisted probe. Skipped tools are represented by the cards' missing-data notes.
  const available = i.results.filter((result) => result.output != null && typeof result.output === "object" && !result.output?.skipped);
  const sections: ExportSection[] = [];
  if (i.finalText.trim()) sections.push({ heading: T.summary, kind: "text", text: i.finalText });
  else sections.push({ heading: T.summary, kind: "text", text: i.lang === "ar" ? "لم تُسجّل خلاصة نهائية لهذه المحاولة؛ تُعرض أدناه الأدلة والقياسات المتاحة فقط." : i.lang === "ku" ? "کورتەی کۆتایی تۆمار نەکراوە؛ تەنها بەڵگە و پێوانە بەردەستەکان لە خوارەوە پیشان دەدرێن." : "No final summary was recorded for this attempt; only available evidence and measurements are shown below." });

  for (const result of available) {
    const sub = payloadFromResult(result.tool, result.output).sections;
    if (sub.length) sections.push({ heading: T.tool + ": " + result.tool + " — " + (result.ok ? T.complete : T.partial), kind: "text", text: "" }, ...sub);
  }

  const entity = available.map((result) => entityFromResult(result.output)).find(Boolean) || null;
  const entityPack = entity ? buildPack({
    brand: entity.brand, site: entity.site, summary: entity.summary, markets: i.markets,
    onboarding: { facts: (entity.facts || []).join("\n"), links: [entity.site, ...(entity.links || [])].filter(Boolean).join("\n"), faqs: entity.faqs },
  }) : null;

  const seoFields = collectFields(available, /(robots|sitemap|meta.?description|meta.?title|canonical|internal.?links?|crawl(?:er|ability|able)?|index(?:ing|able|ability)?|http.?status|status.?code|redirect|open.?graph|(?:^|[._\s])h1(?:$|[._\s])|page.?title)/i, 16);
  sections.push({
    heading: T.seo, kind: "kv",
    rows: [
      [T.resultStatus, seoFields.length ? (i.lang === "ar" ? "تم العثور على حقول SEO فعلية ضمن المخرجات" : i.lang === "ku" ? "خانەی SEO لە ئەنجامەکاندا دۆزرایەوە" : "SEO fields were present in tool outputs") : T.notMeasured],
      [T.fields, seoFields.length ? seoFields.length : 0],
      ...measurementRows(seoFields, T.notMeasured, T.fields),
    ],
  });

  const aeoFields = collectFields(available, /(entity.?truth.?card|truth.?card|schema|faq|question|verified.?fact|answer.?ready|direct.?answer|entity.(name|description)|alternate.?name)/i, 16);
  sections.push({
    heading: T.aeo, kind: "kv",
    rows: [
      [T.entity, entity?.brand || T.noEntity],
      [T.facts, entity?.facts?.length ? entity.facts.join("\n") : T.notMeasured],
      [T.faqCount, entity?.faqs?.length ?? 0],
      [T.schema, aeoFields.length ? aeoFields.map((field) => field.tool + " · " + field.path + ": " + field.value).join("\n") : T.notMeasured],
      [T.generatedSchema, entityPack ? "Organization JSON-LD" + (entityPack.faqJsonld ? " + FAQPage JSON-LD" : "") : T.noEntity],
      [T.notDeployed, T.notDeployed],
    ],
  });

  const probe = bestProbe(available);
  const answers = probe ? engineAnswersOf({ probe }) : [];
  const asked = Array.isArray(probe?.asked) ? probe.asked : [];
  const responded = answers.filter((answer: any) => String(answer.answer || "").trim()).length;
  const mentions = answers.filter((answer: any) => answer.mentioned === true).length;
  const mentionRate = responded ? Math.round((mentions / responded) * 100) + "%" : T.noAnswers;
  sections.push({
    heading: T.geo, kind: "kv",
    rows: [
      [T.question, String(probe?.blind_query || probe?.query || T.notMeasured)],
      [T.groundQuestion, String(probe?.grounded_question_template || T.notMeasured)],
      [T.asked, asked.length || answers.length],
      [T.answered, responded],
      [T.mentions, mentions],
      [T.rate, mentionRate],
      [T.resultStatus, answers.length ? (i.lang === "ar" ? "قياس مستخرج من نتيجة الاستجواب المسجلة" : i.lang === "ku" ? "پێوانە لە ئەنجامی پرسیاری تۆمارکراوەوە وەرگیراوە" : "Measured from recorded probe output") : T.noAnswers],
    ],
  });
  if (answers.length) {
    sections.push({
      heading: i.lang === "ar" ? "تفاصيل نتائج النماذج العشرة" : i.lang === "ku" ? "وردەکاری ئەنجامی دە مۆدێل" : "Ten-model answer details",
      kind: "table",
      table: {
        columns: [T.engine, T.status, T.mention, T.rank, T.candidates, T.answer, T.sources],
        data: answers.map((answer: any) => [
          String(answer.engine || ""),
          String(answer.status || answer.grounded_status || "unknown"),
          answer.mentioned === true ? (i.lang === "en" ? "Yes" : i.lang === "ku" ? "بەڵێ" : "نعم") : answer.mentioned === false ? (i.lang === "en" ? "No" : i.lang === "ku" ? "نەخێر" : "لا") : "—",
          answer.rank ?? "—",
          Array.isArray(answer.brands) ? answer.brands.join(", ") : "",
          printable(answer.answer || answer.reason || "", 1200),
          Array.isArray(answer.sources) ? answer.sources.map((source: any) => source.url).filter(isUrl).join("\n") : "",
        ]),
      },
    });
  } else {
    sections.push({ heading: i.lang === "ar" ? "تفاصيل نتائج النماذج العشرة" : i.lang === "ku" ? "وردەکاری ئەنجامی دە مۆدێل" : "Ten-model answer details", kind: "text", text: T.noAnswers });
  }
  if (answers.length) sections.push(...engineAnswerSections({ probe }, i.lang));

  const engineKeys = Array.from(new Set([
    ...asked.map(String),
    ...Object.keys(probe?.statuses || {}),
    ...answers.map((answer: any) => String(answer.engine || "")),
  ].filter(Boolean)));
  const answeredKeys = new Set(answers.filter((answer: any) => String(answer.answer || "").trim()).map((answer: any) => String(answer.engine)));
  const missedKeys = engineKeys.filter((key) => !answeredKeys.has(key));
  if (missedKeys.length) {
    sections.push({
      heading: i.lang === "ar" ? "النماذج التي لم تُسجّل إجابة لها وأسباب ذلك" : i.lang === "ku" ? "مۆدێلەکان کە وەڵامیان تۆمار نەکراوە و هۆکارەکان" : "Models without a recorded answer and why",
      kind: "table",
      table: {
        columns: [T.engine, T.status, "Phase 1", "Phase 2", "ms"],
        data: missedKeys.map((key) => {
          const st = probe?.statuses?.[key] || {};
          const localize = (value: any) => {
            if (!value) return i.lang === "ar" ? "غير مسجل" : i.lang === "ku" ? "تۆمار نەکراوە" : "Not recorded";
            if (value === "timeout") return i.lang === "ar" ? "انتهت المهلة" : i.lang === "ku" ? "کاتی تەواو بوو" : "Timed out";
            if (value === "error") return i.lang === "ar" ? "خطأ في الطلب" : i.lang === "ku" ? "هەڵەی داواکاری" : "Request error";
            if (value === "empty") return i.lang === "ar" ? "رد فارغ" : i.lang === "ku" ? "وەڵامی بەتاڵ" : "Empty response";
            if (value === "answered" || value === "blind_answered") return i.lang === "ar" ? "أجاب" : i.lang === "ku" ? "وەڵامی دایەوە" : "Answered";
            return String(value);
          };
          return [key, localize(st.status || st.blind_status), localize(st.blind_status), localize(st.grounded_status), st.ms ?? "—"];
        }),
      },
    });
  }

  const schemaFields = collectFields(available, /(schema.?org|json.?ld|structured.?data|faqpage|application\/ld\+json)/i, 12);
  const textMetrics = pageTextMetrics(available);
  const sources = collectSourceLinks(available);
  sections.push({
    heading: T.sge, kind: "kv",
    rows: [
      [T.schemaObserved, schemaFields.length ? schemaFields.map((field) => field.tool + " · " + field.path + ": " + field.value).join("\n") : T.notMeasured],
      [T.generatedSchema, entityPack ? "Organization JSON-LD" + (entityPack.faqJsonld ? " + FAQPage JSON-LD" : "") : T.noEntity],
      [T.notDeployed, T.notDeployed],
      [T.contentDepth, textMetrics.length ? textMetrics.map((metric) => metric.tool + " · " + metric.field + ": " + metric.words + " words").join("\n") : T.noText],
      [T.externalSources, sources.length],
    ],
  });
  if (sources.length) {
    sections.push({
      heading: i.lang === "ar" ? "روابط المصادر المستخرجة من مخرجات الأدوات" : i.lang === "ku" ? "بەستەرەکانی سەرچاوە لە ئەنجامی ئامرازەکان" : "Source URLs extracted from tool outputs",
      kind: "table",
      table: { columns: [T.sourceTool, T.value, "URL"], data: sources.map((source) => [source.tool, source.title, source.url]) },
    });
  }

  const recommendationFields = collectFields(available, /(recommend|action|priority|roadmap|next.?step|strategy|opportunit|90.?day|plan|gap|improvement|citation|mention.?rate|visibility.?score|recommendation)/i, 16);
  sections.push({
    heading: T.gseo, kind: "kv",
    rows: [
      [T.recommendations, recommendationFields.length ? recommendationFields.map((field) => field.tool + " · " + field.path + ": " + field.value).join("\n") : T.notMeasured],
      [T.roadmap, ""],
    ],
  });
  sections.push({
    heading: T.roadmap, kind: "table",
    table: {
      columns: [i.lang === "ar" ? "الفترة" : i.lang === "ku" ? "ماوە" : "Period", i.lang === "ar" ? "الإجراء المقترح" : i.lang === "ku" ? "کرداری پێشنیارکراو" : "Suggested action"],
      data: [
        [i.lang === "en" ? "Days 1–30" : i.lang === "ku" ? "ڕۆژانی 1–30" : "الأيام 1–30", T.days1],
        [i.lang === "en" ? "Days 31–60" : i.lang === "ku" ? "ڕۆژانی 31–60" : "الأيام 31–60", T.days2],
        [i.lang === "en" ? "Days 61–90" : i.lang === "ku" ? "ڕۆژانی 61–90" : "الأيام 61–90", T.days3],
      ],
    },
  });

  const entityWithSources = available.map((result) => entityFromResult(result.output)).find(Boolean) || null;
  if (entityWithSources) {
    sections.push(...packSections({
      brand: entityWithSources.brand, site: entityWithSources.site, summary: entityWithSources.summary, markets: i.markets,
      onboarding: { facts: (entityWithSources.facts || []).join("\n"), links: [entityWithSources.site, ...(entityWithSources.links || [])].filter(Boolean).join("\n"), faqs: entityWithSources.faqs },
    } as any, i.lang));
  }

  sections.push(linksSection(sections, i.lang));
  return scrub({
    title: i.title,
    subtitle: i.goal,
    sections,
    lang: i.lang,
    entity: entity || undefined,
    engineAnswers: answers,
  } as ExportPayload);
}
