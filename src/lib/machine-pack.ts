// Pure: builds the "machine-readable pack" (llms.txt, Organization JSON-LD, FAQPage JSON-LD)
// and a per-result links section for exports. Uses only owner-entered/confirmed data — never invents facts.
import type { ExportSection, ExportLang } from "@/lib/exports";

export type Onboarding = {
  aliases?: string; markets?: string; facts?: string; competitors?: string; links?: string;
  faqs?: { q: string; a: string }[];
};
export type PackInput = { brand: string; site?: string; summary?: string; markets?: string[]; onboarding?: Onboarding };

const splitList = (s?: string) => (s || "").split(/[\n,،]+/).map((x) => x.trim()).filter(Boolean);
const isUrl = (u: string) => /^https?:\/\/[^\s]+$/i.test(u);

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

  const llms = [
    `# ${name}`, "",
    ...(summary ? [`> ${summary}`, ""] : []),
    ...(aliases.length ? ["## Also known as", ...aliases.map((a) => `- ${a}`), ""] : []),
    ...(markets.length ? ["## Markets (owner-confirmed)", markets.join(", "), ""] : []),
    ...(facts.length ? ["## Key facts", ...facts.map((f) => `- ${f}`), ""] : []),
    ...(faqs.length ? ["## FAQ", ...faqs.map((f) => `- ${f.q}: ${f.a}`), ""] : []),
    ...(site || links.length ? ["## Links", ...Array.from(new Set([site, ...links].filter(Boolean))).map((u) => `- [${u}](${u})`)] : []),
  ].join("\n").trim();

  const org: any = { "@context": "https://schema.org", "@type": "Organization", name };
  if (aliases.length) org.alternateName = aliases;
  if (summary) org.description = summary;
  if (site) org.url = site;
  const same = links.filter((u) => u !== site);
  if (same.length) org.sameAs = same;
  if (markets.length) org.areaServed = markets.map((m) => ({ "@type": "Country", name: m }));
  const faq = faqs.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) } : null;

  return { llms, orgJsonld: JSON.stringify(org, null, 2), faqJsonld: faq ? JSON.stringify(faq, null, 2) : "" };
}

const TX = {
  ar: {
    pack: "حزمة قراءة الآلة", what: "ما هو", why: "لماذا", how: "طريقة الاستخدام", check: "كيف تتحقق",
    llmsWhat: "ملف نصي يعرّف نماذج الذكاء الاصطناعي بهويتك وأهم صفحاتك وحقائقك.",
    llmsWhy: "يسهّل على النماذج فهم علامتك واقتباسها بدقة بدل التخمين.",
    llmsHow: "احفظه باسم llms.txt وضعه في جذر موقعك ليُفتح على الرابط /llms.txt.",
    orgWhat: "بيانات منظمة بمعيار Schema.org تصف الكيان: الاسم، الأسماء البديلة، الرابط، الأسواق، الحسابات الرسمية.",
    orgWhy: "تثبت هوية الكيان ومنع الخلط مع جهات مشابهة، وتربط حساباتك الرسمية ببعضها.",
    orgHow: "ضع الكود داخل وسم <script type=\"application/ld+json\"> في رأس الصفحة الرئيسية.",
    faqWhat: "بيانات منظمة لأسئلتك الشائعة وأجوبتها المعتمدة.",
    faqWhy: "تقدّم للنماذج ومحركات البحث إجابات جاهزة للاقتباس في البحث الصفري النقرات.",
    faqHow: "ضع الكود في صفحة الأسئلة الشائعة نفسها، ويجب أن تظهر الأسئلة والأجوبة نصاً مرئياً في الصفحة.",
    faqCheck: "اختبره في أداة Google Rich Results Test وأداة validator.schema.org.",
    noFaq: "لا توجد أسئلة شائعة محفوظة بعد. أكمل أسئلة التهيئة في مساحة معروف لتوليد هذا الملف.",
    links: "روابط النتائج", noLinks: "لا يوجد مصدر مسجل لهذه النتائج.", code: "الكود",
  },
  en: {
    pack: "Machine-readable pack", what: "What it is", why: "Why", how: "How to use", check: "How to verify",
    llmsWhat: "A plain-text file that introduces your identity, key pages and facts to AI models.",
    llmsWhy: "Helps models understand and cite your brand accurately instead of guessing.",
    llmsHow: "Save it as llms.txt at your site root so it opens at /llms.txt.",
    orgWhat: "Schema.org structured data describing the entity: name, alternate names, URL, markets, official profiles.",
    orgWhy: "Proves the entity's identity, prevents confusion with similar names and links your official profiles.",
    orgHow: "Paste the code inside a <script type=\"application/ld+json\"> tag in your homepage head.",
    faqWhat: "Structured data for your frequently asked questions and approved answers.",
    faqWhy: "Gives AI models and search engines ready-to-quote answers for zero-click search.",
    faqHow: "Place it on the FAQ page itself; the same questions and answers must be visible text on that page.",
    faqCheck: "Test it with Google Rich Results Test and validator.schema.org.",
    noFaq: "No saved FAQs yet. Complete the onboarding questions in the Maaroof workspace to generate this file.",
    links: "Result links", noLinks: "No recorded source for these results.", code: "Code",
  },
  ku: {
    pack: "پاکێجی خوێندنەوەی ئامێر", what: "چییە", why: "بۆچی", how: "شێوازی بەکارهێنان", check: "چۆن پشکنینی بکەیت",
    llmsWhat: "فایلێکی دەقییە کە ناسنامە و پەڕە و ڕاستییە سەرەکییەکانت بە مۆدێلەکانی زیرەکی دەستکرد دەناسێنێت.",
    llmsWhy: "یارمەتی مۆدێلەکان دەدات براندەکەت بە وردی تێبگەن و ئاماژەی پێ بدەن.",
    llmsHow: "بە ناوی llms.txt لە ڕەگی ماڵپەڕەکەت دایبنێ تا لە /llms.txt بکرێتەوە.",
    orgWhat: "داتای ڕێکخراو بە ستانداردی Schema.org کە قەوارەکە وەسف دەکات: ناو، ناوی تر، بەستەر، بازاڕەکان، هەژمارە فەرمییەکان.",
    orgWhy: "ناسنامەی قەوارەکە دەسەلمێنێت و ڕێگری لە تێکەڵبوون دەکات.",
    orgHow: "کۆدەکە لەناو تاگی <script type=\"application/ld+json\"> لە سەری پەڕەی سەرەکی دابنێ.",
    faqWhat: "داتای ڕێکخراو بۆ پرسیارە باوەکان و وەڵامە پەسەندکراوەکانیان.",
    faqWhy: "وەڵامی ئامادە بۆ ئاماژەپێدان دەداتە مۆدێلەکان و بزوێنەرەکانی گەڕان.",
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
  const p = buildPack(i);
  const block = (title: string, what: string, why: string, how: string, code: string, check?: string): ExportSection[] => [
    { heading: `${T.pack} — ${title}`, kind: "kv", rows: [[T.what, what], [T.why, why], [T.how, how], ...(check ? [[T.check, check] as [string, string]] : [])] },
    { heading: `${title} — ${T.code}`, kind: "text", text: code },
  ];
  return [
    ...block("llms.txt", T.llmsWhat, T.llmsWhy, T.llmsHow, p.llms),
    ...block("Schema.org JSON-LD (Organization)", T.orgWhat, T.orgWhy, T.orgHow, p.orgJsonld, "validator.schema.org"),
    ...(p.faqJsonld
      ? block("FAQPage Schema", T.faqWhat, T.faqWhy, T.faqHow, p.faqJsonld, T.faqCheck)
      : [{ heading: `${T.pack} — FAQPage Schema`, kind: "kv" as const, rows: [[T.what, T.faqWhat], [T.why, T.faqWhy], [T.how, T.faqHow], [T.check, T.noFaq]] as [string, string][] }]),
  ];
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
  ar: { status: "الحالة", rank: "الترتيب", answer: "الإجابة", sources: "المصادر", next: "الخطوة التالية", yes: "مذكورة", no: "غير مذكورة", noSrc: "لا يوجد مصدر مسجل",
    top: "ذُكرت في المقدمة: حافظ على تحديث llms.txt والبيانات المنظمة.", ranked: (n: number) => `ذُكرت في المرتبة ${n}: عزّز الحقائق والأرقام في أول 150 كلمة من صفحاتك لتتقدم.`,
    missing: (b: string) => `لم تُذكر: انشر صفحة تعريفية موثقة وFAQPage وروابط رسمية${b ? `، فالمحرك رشّح: ${b}` : ""}.` },
  en: { status: "Status", rank: "Rank", answer: "Answer", sources: "Sources", next: "Next step", yes: "Mentioned", no: "Not mentioned", noSrc: "No recorded source",
    top: "Mentioned at the top: keep llms.txt and structured data up to date.", ranked: (n: number) => `Mentioned at rank ${n}: add facts and numbers in the first 150 words of your pages to move up.`,
    missing: (b: string) => `Not mentioned: publish a verified about page, FAQPage and official links${b ? `; the engine recommended: ${b}` : ""}.` },
  ku: { status: "دۆخ", rank: "پلە", answer: "وەڵام", sources: "سەرچاوەکان", next: "هەنگاوی داهاتوو", yes: "ئاماژەی پێکراوە", no: "ئاماژەی پێنەکراوە", noSrc: "هیچ سەرچاوەیەک تۆمار نەکراوە",
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
  return engineAnswersOf(r).map((a) => {
    const name = ENGINE_NAMES[String(a.engine).toLowerCase()] || String(a.engine);
    const srcs = (a.sources || []).map((s: any) => str(s?.url)).filter(isUrl);
    const next = a.mentioned ? (a.rank && a.rank > 1 ? T.ranked(a.rank) : T.top) : T.missing((a.brands || []).slice(0, 3).join(sep));
    return {
      heading: name, kind: "kv",
      rows: [
        [T.status, a.mentioned ? T.yes : T.no],
        [T.rank, a.rank ?? "—"],
        [T.answer, String(a.answer || a.reason || "—").slice(0, 4000)],
        [T.sources, srcs.length ? srcs.join("\n") : T.noSrc],
        [T.next, next],
      ],
    } as ExportSection;
  });
}
