import type { ToolKey, Capability } from "@/lib/tool-catalog";

export type MaaroofSkill = {
  key: string;
  label: { ar: string; en: string; ku: string };
  description: { ar: string; en: string; ku: string };
  icon: "search" | "chart" | "target" | "sparkles" | "trending" | "compass";
  tools: ToolKey[];
  capabilities: Capability[];
  keywords: string[];
};

export const MAAROOF_SKILLS: MaaroofSkill[] = [
  {
    key: "deep-research",
    label: { ar: "البحث العميق", en: "Deep research", ku: "توێژینەوەی قووڵ" },
    description: { ar: "جمع المعلومات من مصادر متعددة والتحقق منها.", en: "Gather and cross-check information from multiple sources.", ku: "کۆکردنەوە و پشتڕاستکردنەوەی زانیاری لە چەندین سەرچاوە." },
    icon: "search",
    tools: ["research", "known"],
    capabilities: ["research", "knowledge_extraction", "validation"],
    keywords: ["بحث", "ابحث", "مصادر", "معلومات", "تحقق", "research", "sources", "evidence", "find out"],
  },
  {
    key: "market-intelligence",
    label: { ar: "تحليل السوق", en: "Market intelligence", ku: "شیکاری بازاڕ" },
    description: { ar: "فهم الاتجاهات والفرص والمخاطر في السوق.", en: "Understand market trends, opportunities, and risks.", ku: "تێگەیشتن لە ئاراستە و دەرفەت و مەترسییەکانی بازاڕ." },
    icon: "chart",
    tools: ["research", "feasibility", "what_if"],
    capabilities: ["market_intelligence", "forecasting", "scenario_simulation"],
    keywords: ["سوق", "السوق", "اتجاهات", "فرص", "نمو", "جدوى", "market", "trend", "opportunity", "growth", "forecast"],
  },
  {
    key: "competitor-analysis",
    label: { ar: "تحليل المنافسين", en: "Competitor analysis", ku: "شیکاری ڕکابەرەکان" },
    description: { ar: "مقارنة المنافسين واكتشاف نقاط القوة والفجوات.", en: "Compare competitors and identify strengths and gaps.", ku: "بەراوردکردنی ڕکابەرەکان و دۆزینەوەی خاڵی بەهێز و بۆشاییەکان." },
    icon: "target",
    tools: ["known", "compare", "competitor_monitor"],
    capabilities: ["competitor_analysis", "research", "monitoring"],
    keywords: ["منافس", "منافسين", "منافسون", "مقارنة", "بدائل", "competitor", "competitors", "compare", "rivals"],
  },
  {
    key: "brand-visibility",
    label: { ar: "ظهور العلامة في الذكاء الاصطناعي", en: "AI brand visibility", ku: "دەرکەوتنی براند لە AI" },
    description: { ar: "فهم كيف تظهر العلامة التجارية وما الذي يحسن فرص الاستشهاد بها.", en: "Understand brand visibility and improve citation readiness.", ku: "تێگەیشتن لە دەرکەوتنی براند و باشترکردنی ئامادەیی بۆ ئاماژەپێدان." },
    icon: "trending",
    tools: ["visibility", "analyze", "known"],
    capabilities: ["visibility", "aeo", "geo_analysis", "brand_authority"],
    keywords: ["ظهور", "علامة", "استشهاد", "ذكاء اصطناعي", "GEO", "AEO", "brand", "visibility", "cited", "citation"],
  },
  {
    key: "content-creation",
    label: { ar: "إنشاء وتحسين المحتوى", en: "Create and improve content", ku: "دروستکردن و باشترکردنی ناوەڕۆک" },
    description: { ar: "إنشاء محتوى أو إعادة صياغته بما يخدم الهدف والهوية.", en: "Create or rewrite content for the goal and brand identity.", ku: "دروستکردن یان نووسینەوەی ناوەڕۆک بەپێی ئامانج و ناسنامەی براند." },
    icon: "sparkles",
    tools: ["suggest", "geo_rewrite", "brand_boost"],
    capabilities: ["writing", "content_generation", "brand_strategy"],
    keywords: ["محتوى", "كتابة", "مقال", "منشور", "صياغة", "نص", "content", "write", "article", "post", "rewrite", "copy"],
  },
  {
    key: "social-intelligence",
    label: { ar: "الذكاء الاجتماعي", en: "Social intelligence", ku: "زانیاری کۆمەڵایەتی" },
    description: { ar: "تحليل حضور العلامة في المنصات الاجتماعية ومراقبة التغيرات.", en: "Analyze the brand's social footprint and monitor changes.", ku: "شیکردنەوەی ئامادەبوونی براند لە تۆڕە کۆمەڵایەتییەکان و چاودێریکردنی گۆڕانکاری." },
    icon: "trending",
    tools: ["social_analysis", "competitor_monitor"],
    capabilities: ["social_analysis", "visibility", "monitoring"],
    keywords: ["اجتماعي", "سوشيال", "منصات", "تواصل", "مراقبة", "social", "social media", "platform", "monitor", "audience"],
  },
  {
    key: "business-outreach",
    label: { ar: "التواصل وتطوير الأعمال", en: "Business outreach", ku: "پەیوەندی و گەشەپێدانی بازرگانی" },
    description: { ar: "تحديد فرص التواصل المهني وإعداد رسائل للشركاء والعملاء المحتملين.", en: "Identify outreach opportunities and prepare messages for partners and prospects.", ku: "دۆزینەوەی دەرفەتی پەیوەندی و ئامادەکردنی نامە بۆ هاوبەش و کڕیاری ئەگەری." },
    icon: "compass",
    tools: ["company_email", "bizdev"],
    capabilities: ["email_outreach", "business_development", "writing"],
    keywords: ["تواصل", "بريد", "إيميل", "شركاء", "عملاء", "رسالة", "outreach", "email", "partner", "prospect", "lead"],
  },
  {
    key: "growth-strategy",
    label: { ar: "خطة النمو والاستراتيجية", en: "Growth strategy", ku: "ستراتیژی گەشە" },
    description: { ar: "تحويل الهدف إلى مراحل عملية ومؤشرات نجاح.", en: "Turn a goal into actionable phases and success measures.", ku: "گۆڕینی ئامانج بۆ قۆناغی کردار و پێوەری سەرکەوتن." },
    icon: "compass",
    tools: ["geo_strategist", "bizdev", "applied_ranking", "brand_authority"],
    capabilities: ["planning", "business_development", "ranking", "brand_strategy"],
    keywords: ["خطة", "استراتيجية", "نمو", "تطوير", "مشروع", "أهداف", "strategy", "plan", "business", "develop", "roadmap"],
  },
];

export function recommendMaaroofSkills(goal: string, limit = 3): MaaroofSkill[] {
  const query = String(goal || "").toLocaleLowerCase();
  const scored = MAAROOF_SKILLS.map((skill) => ({
    skill,
    score: skill.keywords.reduce((sum, keyword) => sum + (query.includes(keyword.toLocaleLowerCase()) ? Math.max(1, keyword.length / 5) : 0), 0),
  })).sort((a, b) => b.score - a.score);
  const matched = scored.filter((item) => item.score > 0).slice(0, limit).map((item) => item.skill);
  if (matched.length) return matched;
  return MAAROOF_SKILLS.filter((skill) => ["deep-research", "market-intelligence", "growth-strategy"].includes(skill.key)).slice(0, limit);
}

export function toolsForSkills(skillKeys: string[]): ToolKey[] {
  const selected = new Set(skillKeys);
  return [...new Set(MAAROOF_SKILLS.filter((skill) => selected.has(skill.key)).flatMap((skill) => skill.tools))];
}
