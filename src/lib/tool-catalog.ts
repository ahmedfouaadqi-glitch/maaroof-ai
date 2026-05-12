// Central catalog of all tools and agent features that can be linked to plans.
// Edit here to add a new tool — admin UI and gates pick it up automatically.

export type ToolKey =
  | "analyze"
  | "suggest"
  | "compare"
  | "feasibility"
  | "bizdev"
  | "research"
  | "brand_boost"
  | "company_email"
  | "applied_ranking"
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
  { key: "analyze",        group: "tools", costPerRun: 1, labels: { ar: "تحليل GEO",            en: "GEO Analysis",        ku: "شیکاری GEO" } },
  { key: "suggest",        group: "tools", costPerRun: 1, labels: { ar: "مولّد المنشورات",        en: "Post Generator",      ku: "دروستکەری پۆست" } },
  { key: "compare",        group: "tools", costPerRun: 1, labels: { ar: "مقارنة المنافسين",       en: "Competitor Compare",  ku: "بەراوردکردنی ڕکابەران" } },
  { key: "feasibility",    group: "tools", costPerRun: 2, labels: { ar: "دراسة جدوى",            en: "Feasibility Study",   ku: "لێکۆڵینەوەی شیاو" } },
  { key: "bizdev",         group: "tools", costPerRun: 2, labels: { ar: "تطوير الأعمال",          en: "BizDev",              ku: "گەشەپێدانی کار" } },
  { key: "research",       group: "tools", costPerRun: 2, labels: { ar: "بحث ذكي",               en: "Smart Research",      ku: "گەڕانی زیرەک" } },
  { key: "brand_boost",    group: "tools", costPerRun: 3, labels: { ar: "تعزيز العلامة",          en: "Brand Boost",         ku: "بەهێزکردنی براند" } },
  { key: "company_email",  group: "tools", costPerRun: 1, labels: { ar: "إيميل شركات",           en: "Company Outreach",    ku: "ئیمەیڵی کۆمپانیا" } },
  { key: "applied_ranking",group: "tools", costPerRun: 2, labels: { ar: "الترتيب التطبيقي",       en: "Applied Ranking",     ku: "ڕیزبەندی جێبەجێکراو" } },
  { key: "agent.command",      group: "agent", costPerRun: 1, labels: { ar: "أمر مباشر للوكيل",      en: "Agent Command",     ku: "فەرمانی ئاراستە" } },
  { key: "agent.run_targets",  group: "agent", costPerRun: 2, labels: { ar: "تشغيل الأهداف تلقائياً", en: "Run Targets",       ku: "جێبەجێکردنی ئامانجەکان" } },
  { key: "agent.visibility",   group: "agent", costPerRun: 1, labels: { ar: "فحص الظهور في AI",     en: "AI Visibility",     ku: "پشکنینی دەرکەوتن" } },
];

export const toolLabel = (key: ToolKey, lang: "ar" | "en" | "ku" = "ar") =>
  TOOL_CATALOG.find((t) => t.key === key)?.labels[lang] ?? key;
