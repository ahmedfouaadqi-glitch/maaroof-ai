import { createFileRoute, Link } from "@tanstack/react-router";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { BookOpen, Activity, Sparkles, Bot, ClipboardList, TrendingUp, Search, Building2, Megaphone, Globe2, User } from "lucide-react";

export const Route = createFileRoute("/guide")({
  component: () => <I18nProvider><GuidePage /></I18nProvider>,
});

function GuidePage() {
  const { t } = useI18n();
  const sections = [
    { icon: <Activity className="size-5" />, title: t("dash_tool_analyze_t"), body: t("dash_tool_analyze_d") + " — افتح الأداة من لوحة التحكم، الصق نصك، ثم اضغط «تحليل». سترى نتيجة من 0–100 مع تفصيل: السلطة التقنية، الصلة المحلية، احتمال الاستشهاد." },
    { icon: <Sparkles className="size-5" />, title: t("dash_tool_suggest_t"), body: t("dash_tool_suggest_d") + " — اختر اللغة المستهدفة والأسلوب، ثم احصل على عدة صيغ جاهزة للنشر." },
    { icon: <Bot className="size-5" />, title: t("dash_tool_agent_t"), body: t("dash_tool_agent_d") + " — أضف هدفك (موقع، علامة، موضوع) ودع الوكيل يعمل تلقائيًا." },
    { icon: <ClipboardList className="size-5" />, title: t("dash_tool_feas_t"), body: t("dash_tool_feas_d") + " — املأ نموذج 12 حقلًا (السوق، المالية، التشغيل، المخاطر) واحصل على دراسة جدوى." },
    { icon: <TrendingUp className="size-5" />, title: t("dash_tool_biz_t"), body: t("dash_tool_biz_d") + " — املأ بيانات عملك واحصل على خطة نمو 12 شهرًا تشمل SWOT والمراحل." },
    { icon: <Search className="size-5" />, title: t("research_title"), body: t("research_desc") + " — اكتب موضوعك في خانة البحث، نبحث في الويب عبر Firecrawl ونلخّص لك مع المصادر." },
    { icon: <Building2 className="size-5" />, title: t("outreach_title"), body: t("outreach_desc") + " — أدخل اسم الشركة وقطاعها، نبحث ثم نصيغ بريدًا مخصصًا جاهزًا للنسخ." },
    { icon: <Megaphone className="size-5" />, title: t("boost_title"), body: t("boost_desc") + " — اختر المنصات والتكرار وأنشئ مهمة. تظهر التقارير في صفحة الوكيل." },
    { icon: <Globe2 className="size-5" />, title: t("geo_scope_title"), body: t("profile_specialty") + " — اختر العالم/الدولة/المحافظة/المدينة من ملفك ليُطبَّق على كل الأدوات." },
    { icon: <User className="size-5" />, title: t("profile_title"), body: "عدّل اسمك، علامتك التجارية، وكلماتها وتخصصك. الإيميل والاشتراك يُداران من الدعم. يمكنك قفل الحساب على بصمة جهازك." },
  ];
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold text-gradient flex items-center gap-2"><BookOpen /> {t("guide_title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("guide_intro")}</p>
        <div className="mt-8 space-y-4">
          {sections.map((s, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card/70 p-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">{s.icon}</span>
                {s.title}
              </h2>
              <p className="mt-2 text-sm text-foreground/85 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center"><Link to="/dashboard" className="text-sm text-primary hover:underline">← {t("nav_dashboard")}</Link></div>
      </div>
    </div>
  );
}
