// Central catalog of all tools and agent features that can be linked to plans.
// Edit here to add a new tool — admin UI and gates pick it up automatically.

export type ToolKey =
  | "analyze"
  | "suggest"
  | "compare"
  | "feasibility"
  | "bizdev"
  | "research"
  | "visibility"
  | "brand_boost"
  | "company_email"
  | "applied_ranking"
  | "geo_strategist"
  | "competitor_monitor"
  | "social_analysis"
  | "what_if"
  | "brand_authority"
  | "geo_rewrite"
  | "agent.command"
  | "agent.run_targets"
  | "agent.visibility";

export type ToolDef = {
  key: ToolKey;
  group: "tools" | "agent";
  labels: { ar: string; en: string; ku: string };
  costPerRun: number; // analyses/tasks consumed per execution
};

export const TOOL_CATALOG: ToolDef[] = [
  { key: "analyze",            group: "tools", costPerRun: 1, labels: { ar: "تحليل GEO",            en: "GEO Analysis",        ku: "شیکاری GEO" } },
  { key: "suggest",            group: "tools", costPerRun: 1, labels: { ar: "مولّد المنشورات",        en: "Post Generator",      ku: "دروستکەری پۆست" } },
  { key: "compare",            group: "tools", costPerRun: 1, labels: { ar: "مقارنة المنافسين",       en: "Competitor Compare",  ku: "بەراوردکردنی ڕکابەران" } },
  { key: "feasibility",        group: "tools", costPerRun: 2, labels: { ar: "دراسة جدوى",            en: "Feasibility Study",   ku: "لێکۆڵینەوەی شیاو" } },
  { key: "bizdev",             group: "tools", costPerRun: 2, labels: { ar: "تطوير الأعمال",          en: "BizDev",              ku: "گەشەپێدانی کار" } },
  { key: "research",           group: "tools", costPerRun: 2, labels: { ar: "بحث ذكي",               en: "Smart Research",      ku: "گەڕانی زیرەک" } },
  { key: "visibility",         group: "tools", costPerRun: 1, labels: { ar: "تحليل الظهور",          en: "AI Visibility",       ku: "پشکنینی دیارییەتی" } },
  { key: "brand_boost",        group: "tools", costPerRun: 5, labels: { ar: "تعزيز العلامة",          en: "Brand Boost",         ku: "بەهێزکردنی براند" } },
  { key: "company_email",      group: "tools", costPerRun: 1, labels: { ar: "إيميل شركات",           en: "Company Outreach",    ku: "ئیمەیڵی کۆمپانیا" } },
  { key: "applied_ranking",    group: "tools", costPerRun: 2, labels: { ar: "الترتيب التطبيقي",       en: "Applied Ranking",     ku: "ڕیزبەندی جێبەجێکراو" } },
  { key: "geo_strategist",     group: "tools", costPerRun: 2, labels: { ar: "إستراتيجي GEO",          en: "GEO Strategist",      ku: "ستراتیژی GEO" } },
  { key: "competitor_monitor", group: "tools", costPerRun: 1, labels: { ar: "مراقبة المنافسين",       en: "Competitor Monitor",  ku: "چاودێری ڕکابەران" } },
  { key: "social_analysis",    group: "tools", costPerRun: 1, labels: { ar: "تحليل الظهور الاجتماعي",  en: "Social Visibility",   ku: "شیکاری سۆشیال" } },
  { key: "what_if",            group: "tools", costPerRun: 2, labels: { ar: "محاكاة What-If",         en: "What-If Simulator",   ku: "سیمولاتۆری What-If" } },
  { key: "brand_authority",    group: "tools", costPerRun: 3, labels: { ar: "حزمة سلطة العلامة",       en: "Brand Authority",     ku: "دەسەڵاتی براند" } },
  { key: "geo_rewrite",        group: "tools", costPerRun: 1, labels: { ar: "إعادة كتابة GEO",         en: "GEO Rewrite",         ku: "نووسینەوەی GEO" } },
  { key: "agent.command",      group: "agent", costPerRun: 1, labels: { ar: "أمر مباشر للوكيل",        en: "Agent Command",       ku: "فەرمانی ئاراستە" } },
  { key: "agent.run_targets",  group: "agent", costPerRun: 2, labels: { ar: "تشغيل الأهداف تلقائياً",   en: "Run Targets",         ku: "جێبەجێکردنی ئامانجەکان" } },
  { key: "agent.visibility",   group: "agent", costPerRun: 1, labels: { ar: "فحص الظهور في AI",       en: "AI Visibility",       ku: "پشکنینی دەرکەوتن" } },
];

export const toolLabel = (key: ToolKey | string, lang: "ar" | "en" | "ku" = "ar") =>
  TOOL_CATALOG.find((t) => t.key === key)?.labels[lang] ?? String(key);
