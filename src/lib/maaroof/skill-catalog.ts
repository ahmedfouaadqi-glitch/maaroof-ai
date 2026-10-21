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
];

/**
 * Lightweight goal-to-skill matching. Pure keyword scoring over ar/en/ku terms.
 * Returns matched skills ordered by score (best first), up to `limit`.
 * Returns an empty list when nothing matches; the caller decides the fallback.
 */
export function recommendMaaroofSkills(goal: string, limit: number = MAAROOF_SKILLS.length): MaaroofSkill[] {
  const text = String(goal || "").toLowerCase();
  if (!text.trim()) return [];
  const scored = MAAROOF_SKILLS
    .map((skill) => {
      let score = 0;
      for (const keyword of skill.keywords) {
        const k = keyword.toLowerCase();
        if (!text.includes(k)) continue;
        // Whole-ish keyword (surrounded by non-letters) scores higher than a substring hit.
        const boundary = new RegExp(`(^|[^\\p{L}])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(text);
        score += boundary ? 2 : 1;
      }
      return { skill, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, limit)).map((entry) => entry.skill);
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
