// Skills catalog for the intelligent workspace (workbench).
// Pure, data-only module: no server imports, no side effects.
// Each skill maps 1:1 to real tools that already exist in TOOL_CATALOG.

export type SkillIconKey = "search" | "chart" | "target" | "sparkles" | "trending" | "compass";

export type MaaroofSkillAccessMode = "self_service" | "contact" | "disabled";

export type MaaroofSkill = {
  key: string;
  icon: SkillIconKey;
  label: { ar: string; en: string; ku: string };
  description: { ar: string; en: string; ku: string };
  /** Tool keys (from TOOL_CATALOG) the skill is served by. */
  tools: string[];
  /** Keywords used for lightweight goal matching across ar/en/ku. */
  keywords: string[];
};

export const MAAROOF_SKILLS: MaaroofSkill[] = [
  {
    key: "presence_audit",
    icon: "search",
    label: { ar: "تدقيق الحضور في الإجابات", en: "Answer Presence Audit", ku: "پشکنینی دەرکەوتن لە وەڵامەکان" },
    description: {
      ar: "نفحص كيف تظهر علامتك داخل إجابات النماذج، ونسبة الذكر، والفجوات القائمة.",
      en: "We check how your brand appears inside model answers, mention rate, and existing gaps.",
      ku: "دەپشکنین چۆن براندەکەت لە ناو وەڵامەکاندا دەردەکەوێت و بۆشاییەکان دەناسین.",
    },
    tools: ["known", "visibility"],
    keywords: ["حضور", "ظهور", "ذكر", "علامتي", "الماركة", "البراند", "شهرتي", "السمعة", "دەرکەوتن", "ناوی من", "براند", "presence", "visibility", "brand", "mention"],
  },
  {
    key: "competitor_gap",
    icon: "trending",
    label: { ar: "فجوات المنافسين والسوق", en: "Competitor & Market Gaps", ku: "بۆشایی ڕکابەران و بازاڕ" },
    description: {
      ar: "نقارن موقعك بالمنافسين ونرصد فجوات المحتوى والحصة الصوتية في السوق.",
      en: "We compare your site with competitors and track content gaps and share of voice.",
      ku: "ماڵپەڕەکەت بە ڕکابەرانەوە بەراورد دەکەین و بۆشایی ناوەڕۆک دەبینین.",
    },
    tools: ["compare", "competitor_monitor"],
    keywords: ["منافس", "المنافسين", "السوق", "مقارنة", "فجوات", "الحصة", "رقابت", "بازاڕ", "بەراورد", "competitor", "market", "compare", "gap"],
  },
  {
    key: "entity_readiness",
    icon: "target",
    label: { ar: "جاهزية الهوية والبيانات المهيكلة", en: "Entity & Structured Data Readiness", ku: "ئامادەیی ناسنامە و داتای ڕێکخراو" },
    description: {
      ar: "نقيس جاهزية موقعك للقراءة الآلية: البيانات المهيكلة، كثافة الحقائق، وملفات الآلة.",
      en: "We measure how machine-readable your site is: structured data, fact density, and machine files.",
      ku: "دەپێۊین ماڵپەڕەکەت چەند بۆ ئامێر خوێندنەوە ئامادەیە.",
    },
    tools: ["analyze", "brand_authority"],
    keywords: ["هوية", "الهوية", "بيانات", "سكيمة", "المخطط", "تحليل", "جاهزية", "الموقع", "ناسنامە", "شیکار", "entity", "schema", "audit", "site", "website"],
  },
  {
    key: "growth_roadmap",
    icon: "compass",
    label: { ar: "خطة نمو مخصصة", en: "Tailored Growth Roadmap", ku: "پلانی گەشەی تایبەت" },
    description: {
      ar: "نبني خطة نمو على مدة تختارها أنت، مرتبطة بأدوات محددة وخطوات قابلة للقياس.",
      en: "We build a growth plan over a duration you choose, linked to specific tools and measurable steps.",
      ku: "پلانی گەشە بۆ ماوەیەک کە خۆت هەڵدەبژێرێت دروست دەکەین.",
    },
    tools: ["geo_strategist"],
    keywords: ["خطة", "تخطيط", "نمو", "استراتيجية", "طريق", "پلان", "گەشە", "ستراتیژی", "plan", "strategy", "roadmap", "growth"],
  },
  {
    key: "citation_content",
    icon: "sparkles",
    label: { ar: "محتوى جاهز للاقتباس", en: "Citation-Ready Content", ku: "ناوەڕۆکی ئامادە بۆ ئیستناد" },
    description: {
      ar: "نكتب محتوى غنياً بالحقائق والإحصاءات، مع ملخص قابل للاقتباس في أول الأسطر.",
      en: "We write fact-rich content with a quotable summary at the top.",
      ku: "ناوەڕۆکی دەوڵەمەند بە ڕاستی و ئامار دەنووسین.",
    },
    tools: ["suggest", "geo_rewrite"],
    keywords: ["محتوى", "كتابة", "مقال", "إعادة", "صياغة", "اقتباس", "ناوەڕۆک", "نووسین", "content", "article", "rewrite", "citation"],
  },
  {
    key: "market_intel",
    icon: "chart",
    label: { ar: "استخبارات السوق والمنصات", en: "Market & Social Intelligence", ku: "زانیاری بازاڕ و تۆڕەکان" },
    description: { ar: "نبحث في السوق ونحلل حضورك على منصات التواصل.", en: "We research the market and analyse your social presence.", ku: "بازاڕ لێکۆڵینەوە دەکەین و تۆڕە کۆمەڵایەتییەکانت شیدەکەینەوە." },
    tools: ["research", "social_analysis"],
    keywords: ["بحث", "سوق", "تواصل", "سوشيال", "انستغرام", "لێکۆڵینەوە", "research", "social", "instagram", "market research"],
  },
  {
    key: "applied_ranking",
    icon: "target",
    label: { ar: "الترتيب التطبيقي", en: "Applied Ranking", ku: "ڕیزبەندی کرداری" },
    description: { ar: "نقيس ترتيبك الفعلي في الإجابات لاستعلامات حقيقية ونقترح خطوات رفعه.", en: "We measure your actual ranking for real queries and suggest steps to raise it.", ku: "ڕیزبەندی ڕاستەقینەت دەپێوین و هەنگاو پێشنیار دەکەین." },
    tools: ["applied_ranking"],
    keywords: ["ترتيب", "تصنيف", "المرتبة", "ڕیزبەندی", "ranking", "rank"],
  },
  {
    key: "business_growth",
    icon: "trending",
    label: { ar: "الجدوى وتطوير الأعمال", en: "Feasibility & Business Development", ku: "توانایی و گەشەپێدانی بازرگانی" },
    description: { ar: "ندرس جدوى فكرة أو سوق ونقترح فرص شراكات ونمو.", en: "We study the feasibility of an idea or market and suggest partnership and growth opportunities.", ku: "توانایی بیرۆکەیەک دەخوێنینەوە و دەرفەتی هاوبەشی پێشنیار دەکەین." },
    tools: ["feasibility", "bizdev"],
    keywords: ["جدوى", "مشروع", "شراكة", "شركاء", "استثمار", "توانایی", "هاوبەش", "feasibility", "partner", "business"],
  },
  {
    key: "brand_boost",
    icon: "sparkles",
    label: { ar: "تعزيز انتشار العلامة", en: "Brand Boost", ku: "بەهێزکردنی براند" },
    description: { ar: "ننشر إشارات موثوقة عن علامتك ونتابع زيارات زواحف الذكاء الاصطناعي.", en: "We publish trusted signals about your brand and track AI crawler visits.", ku: "ئاماژەی متمانەپێکراو بڵاودەکەینەوە و سەردانی خشۆکەکان دەبینین." },
    tools: ["brand_boost"],
    keywords: ["تعزيز", "انتشار", "زواحف", "نشر", "بەهێزکردن", "boost", "crawler", "publish"],
  },
  {
    key: "outreach",
    icon: "compass",
    label: { ar: "المراسلات الاحترافية", en: "Professional Outreach", ku: "نامەی پیشەیی" },
    description: { ar: "نكتب رسائل تواصل احترافية للشركات والشركاء والإعلام.", en: "We write professional outreach emails to companies, partners and media.", ku: "نامەی پیشەیی بۆ کۆمپانیا و میدیا دەنووسین." },
    tools: ["company_email"],
    keywords: ["رسالة", "بريد", "ايميل", "مراسلة", "نامە", "email", "outreach"],
  },
  {
    key: "what_if",
    icon: "chart",
    label: { ar: "محاكاة السيناريوهات", en: "What-If Simulation", ku: "هاوشێوەکردنی سیناریۆ" },
    description: { ar: "نحاكي أثر تغيير معين على حضورك قبل تنفيذه.", en: "We simulate the effect of a change on your presence before you make it.", ku: "کاریگەری گۆڕانکارییەک پێش جێبەجێکردن هاوشێوە دەکەین." },
    tools: ["what_if"],
    keywords: ["ماذا لو", "محاكاة", "سيناريو", "توقع", "ئەگەر", "what if", "simulate", "scenario"],
  },
  {
    key: "localization",
    icon: "sparkles",
    label: { ar: "التوطين والترجمة", en: "Localization & Translation", ku: "ناوخۆییکردن و وەرگێڕان" },
    description: { ar: "نترجم محتواك ونكيّفه لغوياً وثقافياً لكل سوق.", en: "We translate and adapt your content for each market's language and culture.", ku: "ناوەڕۆکەکەت وەردەگێڕین و بۆ هەر بازاڕێک دەیگونجێنین." },
    tools: ["translate"],
    keywords: ["ترجمة", "ترجم", "توطين", "وەرگێڕان", "translate", "localize"],
  },
  {
    key: "knowledge_training",
    icon: "target",
    label: { ar: "تدريب مساحة المعرفة", en: "Knowledge Space Training", ku: "ڕاهێنانی بۆشایی زانیاری" },
    description: { ar: "نعلّم معروف عن علامتك مرة واحدة عبر مقابلة النماذج العشرة ليستخدمها في كل مهمة.", en: "We teach Maaroof about your brand once, via the ten-model interview, for use in every task.", ku: "یەکجار لە ڕێگەی چاوپێکەوتنەوە فێری براندەکەت دەکەین." },
    tools: ["teach_space"],
    keywords: ["تدريب", "معرفة", "مقابلة", "علّم", "ڕاهێنان", "زانیاری", "train", "knowledge", "interview"],
  },
  {
    key: "continuous_monitoring",
    icon: "chart",
    label: { ar: "المراقبة المستمرة", en: "Continuous Monitoring", ku: "چاودێری بەردەوام" },
    description: { ar: "نقارن نتائج الفحص بمرور الزمن ونعرض ما تغيّر فعلاً فقط.", en: "We compare scan results over time and show only what actually changed.", ku: "ئەنجامی پشکنینەکان بە تێپەڕبوونی کات بەراورد دەکەین و تەنها گۆڕانکاری ڕاستەقینە پیشان دەدەین." },
    tools: ["visibility", "known"],
    keywords: ["مراقبة", "تغير", "تغيّر", "متابعة", "بمرور الزمن", "چاودێری", "monitor", "track", "changes", "over time"],
  },
  {
    key: "citation_fix",
    icon: "sparkles",
    label: { ar: "إصلاح الاقتباس", en: "Citation Fix", ku: "چاککردنی ئیستناد" },
    description: { ar: "نحوّل الفجوات المكتشفة إلى قائمة تعديلات محتوى وبيانات مهيكلة قابلة للموافقة.", en: "We turn detected gaps into an approvable list of content and structured-data edits.", ku: "بۆشاییەکان دەکەینە لیستی دەستکاری ناوەڕۆک و داتای ڕێکخراو بۆ پەسەندکردن." },
    tools: ["analyze", "geo_rewrite"],
    keywords: ["إصلاح", "اصلاح", "تعديلات", "الاقتباس", "لا يقتبس", "چاککردن", "fix", "citation fix", "edits"],
  },
  {
    key: "smart_competitor",
    icon: "trending",
    label: { ar: "ملف المنافس الذكي", en: "Smart Competitor File", ku: "فایلی زیرەکی ڕکابەر" },
    description: { ar: "نتابع منافساً أو مجموعة منافسين ونعرض الأحداث المؤثرة فقط بدلاً من تقارير متكررة.", en: "We follow one or more competitors and surface only impactful events instead of repeated reports.", ku: "شوێن ڕکابەرێک یان گرووپێک دەکەوین و تەنها ڕووداوە کاریگەرەکان پیشان دەدەین." },
    tools: ["competitor_monitor", "compare"],
    keywords: ["ملف المنافس", "تتبع منافس", "متابعة المنافس", "أحداث", "ڕکابەر", "competitor file", "track competitor", "rival"],
  },
  {
    key: "machine_readability",
    icon: "target",
    label: { ar: "ملفات قراءة الآلة", en: "Machine-Readable Files", ku: "فایلەکانی خوێندنەوەی ئامێر" },
    description: { ar: "نجهّز بطاقة سلطة العلامة وملف llms.txt والمخطط المهيكل ليقرأها كل نموذج بدقة.", en: "We prepare your brand authority card, llms.txt and structured schema so every model reads you accurately.", ku: "کارتی دەسەڵاتی براند و llms.txt و schema ئامادە دەکەین." },
    tools: ["brand_authority", "analyze"],
    keywords: ["llms", "llms.txt", "json-ld", "بطاقة السلطة", "ملفات الآلة", "schema.org", "machine", "authority card"],
  },
];

export type SkillLocaleKey = "ar" | "en" | "ku";
export type SkillFramework = { goal: string; sources: string; plan: string; cost: string; evidence: string; output: string; nextStep: string };

const SOURCES_BY_TOOL: Record<string, { ar: string; en: string; ku: string }> = {
  known: { ar: "النماذج العشرة", en: "The ten models", ku: "دە مۆدێلەکە" },
  visibility: { ar: "فحص النماذج الحي", en: "Live model probe", ku: "پشکنینی ڕاستەوخۆ" },
  analyze: { ar: "صفحات موقعك الرسمي", en: "Your official site pages", ku: "پەڕەکانی ماڵپەڕی فەرمی" },
  brand_authority: { ar: "بطاقة حقيقة الكيان", en: "Entity Truth Card", ku: "کارتی ڕاستی" },
  compare: { ar: "مواقع المنافسين العامة", en: "Public competitor sites", ku: "ماڵپەڕی ڕکابەران" },
  competitor_monitor: { ar: "سجل فحوص المنافسين", en: "Competitor scan history", ku: "مێژووی پشکنینی ڕکابەران" },
  research: { ar: "مصادر الويب العامة", en: "Public web sources", ku: "سەرچاوەی وێب" },
  social_analysis: { ar: "حساباتك العامة على المنصات", en: "Your public social accounts", ku: "هەژمارە گشتییەکانت" },
};

/** Unified 7-part framework for any skill (goal, sources, plan, cost, evidence, output, next step). Pure. */
export function skillFramework(skill: MaaroofSkill, locale: SkillLocaleKey): SkillFramework {
  const L = (ar: string, en: string, ku: string) => (locale === "en" ? en : locale === "ku" ? ku : ar);
  const sources = Array.from(new Set(skill.tools.map((t) => SOURCES_BY_TOOL[t]?.[locale]).filter(Boolean))) as string[];
  if (!sources.length) sources.push(L("مدخلاتك وبطاقة حقيقة الكيان", "Your inputs and Entity Truth Card", "داتاکانت و کارتی ڕاستی"));
  return {
    goal: skill.description[locale],
    sources: sources.join(locale === "ar" ? "، " : ", "),
    plan: L(`${skill.tools.length} خطوة تنفيذ تُعرض قبل البدء`, `${skill.tools.length} execution step(s) shown before start`, `${skill.tools.length} هەنگاو پێش دەستپێکردن پیشان دەدرێت`),
    cost: L("تُحسب من جدول الأسعار وتُعرض مع رصيدك قبل الموافقة؛ لا خصم إلا بعد النجاح", "Computed from the price table and shown with your balance before approval; charged only on success", "پێش پەسەندکردن پیشان دەدرێت؛ تەنها دوای سەرکەوتن دەبڕدرێت"),
    evidence: L("روابط ومقتطفات حقيقية من المصادر أعلاه فقط", "Real links and excerpts from the sources above only", "تەنها بەستەر و دەقی ڕاستەقینە"),
    output: L("تقرير قابل للتصدير بالعربية أو الإنجليزية أو الكردية", "Exportable report in Arabic, English or Kurdish", "ڕاپۆرتی هەناردەکراو"),
    nextStep: L("اقتراح مهمة متابعة تختارها أنت", "A follow-up task you choose", "ئەرکی بەدواداچوون کە خۆت هەڵیدەبژێریت"),
  };
}

/**
 * Lightweight, low-cost skill inference across Arabic, English and Kurdish.
 * Normalization reduces spelling/diacritic variants; a single substring of a
 * generic word is not enough to select a skill.
 */
export function normalizeSkillText(value: string): string {
  let text = String(value || "").normalize("NFKC").toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ك/g, "ک")
    .replace(/ي/g, "ی");
  // Small explicit synonym set for common local/dialect spellings.
  text = text
    .replace(/انستا(?:گرام)?/g, "انستغرام instagram")
    .replace(/سوشيال(?: ميديا)?/g, "تواصل اجتماعي social media")
    .replace(/تحسين محركات البحث/g, "seo")
    .replace(/سيو/g, "seo")
    .replace(/منافسة/g, "منافس competitor")
    .replace(/ذكاء اصطناعي|الذكاء الاصطناعي/g, "ذكاء اصطناعي ai");
  return text.replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

export function recommendMaaroofSkills(goal: string, limit: number = MAAROOF_SKILLS.length): MaaroofSkill[] {
  const text = normalizeSkillText(goal);
  const cap = Math.max(0, Math.min(MAAROOF_SKILLS.length, Math.floor(Number(limit) || 0)));
  if (!text || cap === 0) return [];
  const scored = MAAROOF_SKILLS.map((skill) => {
    let score = 0;
    const seen = new Set<string>();
    for (const keyword of skill.keywords) {
      const k = normalizeSkillText(keyword);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const exactPhrase = (" " + text + " ").includes(" " + k + " ");
      const partial = !exactPhrase && text.includes(k);
      // Exact words/phrases score; substring-only hits are weak hints and cannot trigger alone.
      if (exactPhrase) score += 2;
      else if (partial) score += 0.5;
    }
    return { skill, score };
  })
    .filter((entry) => entry.score >= 2)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, cap).map((entry) => entry.skill);
}
/** Union of tool keys for the selected skills, preserving first-seen order. */
export function toolsForSkills(selectedSkills: string[]): string[] {
  const tools: string[] = [];
  for (const key of selectedSkills) {
    const skill = MAAROOF_SKILLS.find((item) => item.key === key);
    if (!skill) continue;
    for (const tool of skill.tools) if (!tools.includes(tool)) tools.push(tool);
  }
  return tools;
}

/** Effective access mode for a skill, defaulting to self-service. */
export function getSkillAccessMode(skill: MaaroofSkill, access: Record<string, MaaroofSkillAccessMode>): MaaroofSkillAccessMode {
  const mode = access?.[skill.key];
  return mode === "contact" || mode === "disabled" ? mode : "self_service";
}

/** Default policy: every skill is self-service until an admin policy says otherwise. */
export function defaultSkillAccessPolicy(): Record<string, MaaroofSkillAccessMode> {
  return Object.fromEntries(MAAROOF_SKILLS.map((skill) => [skill.key, "self_service" as const]));
}
