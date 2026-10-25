// Pure: builds the "machine-readable pack" (llms.txt, Organization JSON-LD, FAQPage JSON-LD)
// and a per-result links section for exports. Uses only owner-entered/confirmed data — never invents facts.
import type { ExportSection, ExportLang } from "@/lib/exports";

export type Onboarding = {
  aliases?: string; markets?: string; facts?: string; competitors?: string; links?: string;
  /** Only URLs explicitly confirmed as official profiles should populate Organization.sameAs. */
  officialProfiles?: string;
  faqs?: { q: string; a: string }[];
};
export type PackInput = { brand: string; site?: string; summary?: string; markets?: string[]; lang?: ExportLang; onboarding?: Onboarding };

const splitList = (s?: string) => (s || "").split(/[\n,،]+/).map((x) => x.trim()).filter(Boolean);
const isUrl = (u: string) => /^https?:\/\/[^\s]+$/i.test(u);
const LLMS_HEADINGS: Record<ExportLang, { aliases: string; markets: string; facts: string; faq: string; links: string; confirmed: string }> = {
  ar: { aliases: "أسماء أخرى", markets: "الأسواق المسجلة", facts: "حقائق أساسية", faq: "أسئلة وأجوبة", links: "روابط", confirmed: "مدخلات مسجلة من المالك" },
  en: { aliases: "Also known as", markets: "Markets (recorded inputs)", facts: "Key facts", faq: "Questions and answers", links: "Links", confirmed: "Recorded owner inputs" },
  ku: { aliases: "ناوەکانی تر", markets: "بازاڕە تۆمارکراوەکان", facts: "ڕاستییە سەرەکییەکان", faq: "پرسیار و وەڵام", links: "بەستەرەکان", confirmed: "زانیاری تۆمارکراوی خاوەن" },
};

export function buildPack(i: PackInput) {
  const name = i.brand.trim() || "Brand";
  const ob = i.onboarding || {};
  const links = splitList(ob.links).filter(isUrl);
  const site = (i.site && isUrl(i.site) ? i.site : links[0]) || "";
  const markets = Array.from(new Set([...(i.markets || []), ...splitList(ob.markets)]));
  const facts = splitList(ob.facts).slice(0, 8);
  const aliases = splitList(ob.aliases);
  const faqs = (ob.faqs || []).filter((f) => f.q?.trim() && f.a?.trim()).slice(0, 10);
  const summary = (i.summary || facts[0] || "").slice(0, 300);
  const lang = i.lang || "en";
  const labels = LLMS_HEADINGS[lang];
  const hasSubstance = Boolean(summary || aliases.length || markets.length || facts.length || faqs.length || site || links.length);
  const llms = hasSubstance ? [
    `# ${name}`, "",
    ...(summary ? [`> ${summary}`, ""] : []),
    ...(aliases.length ? [`## ${labels.aliases}`, ...aliases.map((a) => `- ${a}`), ""] : []),
    ...(markets.length ? [`## ${labels.markets}`, ...markets.map((m) => `- ${m}`), ""] : []),
    ...(facts.length ? [`## ${labels.facts}`, ...facts.map((f) => `- ${f}`), ""] : []),
    ...(faqs.length ? [`## ${labels.faq}`, ...faqs.map((f) => `- ${f.q}: ${f.a}`), ""] : []),
    ...(site || links.length ? [`## ${labels.links}`, ...Array.from(new Set([site, ...links].filter(Boolean))).map((u) => `- [${u}](${u})`)] : []),
  ].join("\n").trim() : "";

  const org: any = { "@context": "https://schema.org", "@type": "Organization", name };
  if (aliases.length) org.alternateName = aliases;
  if (summary) org.description = summary;
  if (site) org.url = site;
  const officialProfiles = splitList(ob.officialProfiles).filter((url) => isUrl(url) && url !== site);
  if (officialProfiles.length) org.sameAs = Array.from(new Set(officialProfiles));
  // A market name may describe a city, region, or commercial market. Do not assume every value is a country.
  if (markets.length) org.areaServed = markets.map((m) => ({ "@type": "Place", name: m }));
  const faq = faqs.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) } : null;

  return { llms, orgJsonld: hasSubstance ? JSON.stringify(org, null, 2) : "", faqJsonld: faq ? JSON.stringify(faq, null, 2) : "" };
}

const TX = {
  ar: {
    pack: "حزمة قراءة الآلة", what: "ما هو", why: "لماذا", how: "طريقة الاستخدام", check: "كيف تتحقق",
    llmsWhat: "ملف نصي يعرّف نماذج الذكاء الاصطناعي بهويتك وأهم صفحاتك وحقائقك.",
    llmsWhy: "يوفّر ملخصاً نصياً واضحاً للأنظمة التي تختار قراءة هذا الملف؛ ولا يضمن الظهور أو الاستشهاد.",
    llmsHow: "احفظه باسم llms.txt وضعه في جذر موقعك ليُفتح على الرابط /llms.txt.",
    orgWhat: "بيانات منظمة بمعيار Schema.org تصف الكيان: الاسم، الأسماء البديلة، الرابط، الأسواق، الحسابات الرسمية.",
    orgWhy: "تعرض بيانات الكيان المقدمة بصيغة منظمة، لكنها لا تثبت الهوية وحدها ولا تضمن نتيجة في البحث.",
    orgHow: "ضع الكود داخل وسم <script type=\"application/ld+json\"> في رأس الصفحة الرئيسية.",
    faqWhat: "بيانات منظمة لأسئلتك الشائعة وأجوبتها المعتمدة.",
    faqWhy: "تمثّل الأسئلة والأجوبة بصيغة منظمة؛ ولا تضمن ظهور نتيجة غنية أو اقتباسها.",
    faqHow: "ضع الكود في صفحة الأسئلة الشائعة نفسها، ويجب أن تظهر الأسئلة والأجوبة نصاً مرئياً في الصفحة.",
    faqCheck: "اختبره في أداة Google Rich Results Test وأداة validator.schema.org.",
    noFaq: "لا توجد أسئلة شائعة محفوظة بعد. أكمل أسئلة التهيئة في مساحة معروف لتوليد هذا الملف.",
    links: "روابط النتائج", noLinks: "لا يوجد مصدر مسجل لهذه النتائج.", code: "الكود",
  },
  en: {
    pack: "Machine-readable pack", what: "What it is", why: "Why", how: "How to use", check: "How to verify",
    llmsWhat: "A plain-text file that introduces your identity, key pages and facts to AI models.",
    llmsWhy: "Provides a clear text summary for systems that choose to read the file; it does not guarantee visibility or citations.",
    llmsHow: "Save it as llms.txt at your site root so it opens at /llms.txt.",
    orgWhat: "Schema.org structured data describing the entity: name, alternate names, URL, markets, official profiles.",
    orgWhy: "Represents the supplied entity details in structured form; it does not independently verify identity or guarantee search results.",
    orgHow: "Paste the code inside a <script type=\"application/ld+json\"> tag in your homepage head.",
    faqWhat: "Structured data for your frequently asked questions and approved answers.",
    faqWhy: "Represents supplied questions and answers in structured form; it does not guarantee rich results or citations.",
    faqHow: "Place it on the FAQ page itself; the same questions and answers must be visible text on that page.",
    faqCheck: "Test it with Google Rich Results Test and validator.schema.org.",
    noFaq: "No saved FAQs yet. Complete the onboarding questions in the Maaroof workspace to generate this file.",
    links: "Result links", noLinks: "No recorded source for these results.", code: "Code",
  },
  ku: {
    pack: "پاکێجی خوێندنەوەی ئامێر", what: "چییە", why: "بۆچی", how: "شێوازی بەکارهێنان", check: "چۆن پشکنینی بکەیت",
    llmsWhat: "فایلێکی دەقییە کە ناسنامە و پەڕە و ڕاستییە سەرەکییەکانت بە مۆدێلەکانی زیرەکی دەستکرد دەناسێنێت.",
    llmsWhy: "پوختەیەکی ڕوون بۆ ئەو سیستەمانە دابین دەکات کە ئەم فایلە دەخوێننەوە؛ بەڵام دەرکەوتن یان ئاماژەدان گەرەنتی ناکات.",
    llmsHow: "بە ناوی llms.txt لە ڕەگی ماڵپەڕەکەت دایبنێ تا لە /llms.txt بکرێتەوە.",
    orgWhat: "داتای ڕێکخراو بە ستانداردی Schema.org کە قەوارەکە وەسف دەکات: ناو، ناوی تر، بەستەر، بازاڕەکان، هەژمارە فەرمییەکان.",
    orgWhy: "زانیاریی قەوارەکە بە شێوەی داتای ڕێکخراو پیشان دەدات؛ بەڵام ناسنامە بە تەنها پشتڕاست ناکاتەوە و ئەنجامی گەڕان گەرەنتی ناکات.",
    orgHow: "کۆدەکە لەناو تاگی <script type=\"application/ld+json\"> لە سەری پەڕەی سەرەکی دابنێ.",
    faqWhat: "داتای ڕێکخراو بۆ پرسیارە باوەکان و وەڵامە پەسەندکراوەکانیان.",
    faqWhy: "پرسیار و وەڵامە پێشکەشکراوەکان بە شێوەی داتای ڕێکخراو دەخاتەڕوو؛ دەرکەوتنی ئەنجامی تایبەت یان ئاماژەدان گەرەنتی ناکات.",
    faqHow: "لە پەڕەی پرسیارە باوەکان دایبنێ؛ پرسیار و وەڵامەکان دەبێت وەک دەق لە پەڕەکەدا دیار بن.",
    faqCheck: "بە Google Rich Results Test و validator.schema.org تاقی بکەرەوە.",
    noFaq: "هێشتا هیچ پرسیارێکی باو پاشەکەوت نەکراوە. پرسیارەکانی دەستپێکردن لە شوێنی کاری معروف تەواو بکە.",
    links: "بەستەرەکانی ئەنجام", noLinks: "هیچ سەرچاوەیەک تۆمار نەکراوە.", code: "کۆد",
  },
} as const;

/** Every real http(s) link that appears anywhere in the result sections (deduplicated). */
export function extractLinks(sections: ExportSection[]): string[] {
  const hay = JSON.stringify(sections);
  const found = hay.match(/https?:\/\/[^\s"'<>\\)\]]+/g) || [];
  return Array.from(new Set(found.map((u) => u.replace(/[.,;:]+$/, "")))).slice(0, 60);
}

export function linksSection(sections: ExportSection[], lang: ExportLang): ExportSection {
  const T = TX[lang] || TX.en;
  const links = extractLinks(sections);
  return links.length ? { heading: T.links, kind: "list", list: links } : { heading: T.links, kind: "text", text: T.noLinks };
}

export function packSections(i: PackInput, lang: ExportLang): ExportSection[] {
  const T = TX[lang] || TX.en;
  const p = buildPack({ ...i, lang });
  const block = (title: string, what: string, why: string, how: string, code: string, check?: string): ExportSection[] => [
    { heading: `${T.pack} — ${title}`, kind: "kv", rows: [[T.what, what], [T.why, why], [T.how, how], ...(check ? [[T.check, check] as [string, string]] : [])] },
    { heading: `${title} — ${T.code}`, kind: "text", text: code },
  ];
  const out: ExportSection[] = [];
  if (p.llms) out.push(...block("llms.txt", T.llmsWhat, T.llmsWhy, T.llmsHow, p.llms));
  if (p.orgJsonld) out.push(...block("Schema.org JSON-LD (Organization)", T.orgWhat, T.orgWhy, T.orgHow, p.orgJsonld, "validator.schema.org"));
  // FAQPage is emitted only when real question/answer pairs are present; no placeholder block.
  if (p.faqJsonld) out.push(...block("FAQPage Schema", T.faqWhat, T.faqWhy, T.faqHow, p.faqJsonld, T.faqCheck));
  return out;
}

/* ── Entity + per-engine sections taken from the tool result itself (any brand, no profile needed) ── */
export type ResultEntity = { brand: string; site?: string; summary?: string; facts?: string[]; links?: string[]; faqs?: { q: string; a: string }[] };

const str = (v: any) => (typeof v === "string" ? v.trim() : "");
function findFaqs(v: any, depth = 0, out: { q: string; a: string }[] = []): { q: string; a: string }[] {
  if (!v || depth > 4 || out.length >= 10) return out;
  if (Array.isArray(v)) { for (const x of v) findFaqs(x, depth + 1, out); return out; }
  if (typeof v === "object") {
    const q = str(v.q) || str(v.question); const a = str(v.a) || str(v.answer);
    if (q && a && q.length < 300) { out.push({ q, a: a.slice(0, 600) }); return out; }
    for (const [k, x] of Object.entries(v)) if (/faq|question/i.test(k) || Array.isArray(x)) findFaqs(x, depth + 1, out);
  }
  return out;
}

/** Pulls the examined entity from a tool result. Returns null when no brand name is present (never invents one). */
export function entityFromResult(r: any): ResultEntity | null {
  if (!r || typeof r !== "object") return null;
  const brand = str(r.brand) || str(r.brand_name) || str(r.entity?.name) || str(r.company) || str(r.name);
  if (!brand) return null;
  const siteRaw = str(r.url) || str(r.site) || str(r.website) || str(r.entity?.url);
  const site = isUrl(siteRaw) ? siteRaw : undefined;
  const summary = (str(r.summary) || str(r.description) || str(r.entity?.description)).slice(0, 300) || undefined;
  const facts = (Array.isArray(r.facts) ? r.facts : []).map((f: any) => str(typeof f === "string" ? f : f?.fact)).filter(Boolean).slice(0, 8);
  const links = Array.from(new Set((JSON.stringify(r).match(/https?:\/\/[^\s"'<>\\)\]]+/g) || []).map((u) => u.replace(/[.,;:]+$/, "")))).filter((u) => u !== site).slice(0, 10);
  return { brand, site, summary, facts, links, faqs: findFaqs(r) };
}

const ENGINE_NAMES: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity", claude: "Claude", copilot: "Copilot", grok: "Grok", mistral: "Mistral", deepseek: "DeepSeek", kimi: "Kimi", qwen: "Qwen" };

const ENG_TX = {
  ar: { status: "الحالة", rank: "الترتيب", answer: "الإجابة", sources: "المصادر", next: "الخطوة التالية", yes: "مذكورة", no: "غير مذكورة", noSrc: "لا يوجد مصدر مسجل", blindQuestion: "السؤال الأعمى", groundedQuestion: "سؤال تدقيق الأدلة", blindStatus: "حالة الإجابة العمياء", groundedStatus: "حالة تدقيق الأدلة", notRecorded: "غير مسجل",
    top: "ذُكرت في المقدمة: حافظ على تحديث llms.txt والبيانات المنظمة.", ranked: (n: number) => `ذُكرت في المرتبة ${n}: عزّز الحقائق والأرقام في أول 150 كلمة من صفحاتك لتتقدم.`,
    missing: (b: string) => `لم تُذكر: انشر صفحة تعريفية موثقة وFAQPage وروابط رسمية${b ? `، فالمحرك رشّح: ${b}` : ""}.` },
  en: { status: "Status", rank: "Rank", answer: "Answer", sources: "Sources", next: "Next step", yes: "Mentioned", no: "Not mentioned", noSrc: "No recorded source", blindQuestion: "Unbiased blind question", groundedQuestion: "Evidence-audit question", blindStatus: "Blind answer status", groundedStatus: "Evidence-audit status", notRecorded: "Not recorded",
    top: "Mentioned at the top: keep llms.txt and structured data up to date.", ranked: (n: number) => `Mentioned at rank ${n}: add facts and numbers in the first 150 words of your pages to move up.`,
    missing: (b: string) => `Not mentioned: publish a verified about page, FAQPage and official links${b ? `; the engine recommended: ${b}` : ""}.` },
  ku: { status: "دۆخ", rank: "پلە", answer: "وەڵام", sources: "سەرچاوەکان", next: "هەنگاوی داهاتوو", yes: "ئاماژەی پێکراوە", no: "ئاماژەی پێنەکراوە", noSrc: "هیچ سەرچاوەیەک تۆمار نەکراوە", blindQuestion: "پرسیاری کوێرانە", groundedQuestion: "پرسیاری پشکنینی بەڵگە", blindStatus: "دۆخی وەڵامی کوێرانە", groundedStatus: "دۆخی پشکنینی بەڵگە", notRecorded: "تۆمار نەکراوە",
    top: "لە سەرەوە ئاماژەی پێکراوە: llms.txt و داتای ڕێکخراو نوێ بهێڵەرەوە.", ranked: (n: number) => `لە پلەی ${n} ئاماژەی پێکراوە: ڕاستی و ژمارە لە یەکەم 150 وشەی پەڕەکانت زیاد بکە.`,
    missing: (b: string) => `ئاماژەی پێنەکراوە: پەڕەیەکی ناساندنی پشتڕاستکراو و FAQPage و بەستەری فەرمی بڵاو بکەرەوە${b ? `؛ بزوێنەرەکە پێشنیاری کرد: ${b}` : ""}.` },
} as const;

/** Raw engine answers inside a tool result (or []). */
export function engineAnswersOf(r: any): any[] {
  const a = r?.probe?.answers || (Array.isArray(r?.answers) && r.answers[0]?.engine ? r.answers : []);
  return Array.isArray(a) ? a.filter((x: any) => x && x.engine) : [];
}

/** One export section per answering engine, labelled in the export language; the verbatim answer stays as given. */
export function engineAnswerSections(r: any, lang: ExportLang = "ar"): ExportSection[] {
  const T = ENG_TX[lang as keyof typeof ENG_TX] || ENG_TX.en;
  const sep = lang === "en" ? ", " : "، ";
  const probe = r?.probe || r;
  return engineAnswersOf(r).map((a) => {
    const name = ENGINE_NAMES[String(a.engine).toLowerCase()] || String(a.engine);
    const srcs = (a.sources || []).map((s: any) => str(s?.url)).filter(isUrl);
    const phase = probe?.statuses?.[String(a.engine)] || {};
    const next = a.mentioned ? (a.rank && a.rank > 1 ? T.ranked(a.rank) : T.top) : T.missing((a.brands || []).slice(0, 3).join(sep));
    return {
      heading: name, kind: "kv",
      rows: [
        [T.status, a.status || (a.mentioned ? T.yes : T.no)],
        [T.blindQuestion, str(a.blind_query) || str(phase.blind_query) || str(probe?.blind_query) || str(probe?.query) || T.notRecorded],
        [T.groundedQuestion, str(a.grounded_query) || str(phase.grounded_query) || str(probe?.grounded_question_template) || T.notRecorded],
        [T.blindStatus, str(a.blind_status) || str(phase.blind_status) || T.notRecorded],
        [T.groundedStatus, str(a.grounded_status) || str(phase.grounded_status) || T.notRecorded],
        [T.rank, a.rank ?? "—"],
        [T.answer, String(a.answer || a.reason || "—").slice(0, 4000)],
        [T.sources, srcs.length ? srcs.join("\n") : T.noSrc],
        [T.next, next],
      ],
    } as ExportSection;
  });
}
