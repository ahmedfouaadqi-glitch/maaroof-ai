import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { ArrowRight, Sparkles } from "lucide-react";
import { TOOL_CATALOG, type ToolKey, toolLabel } from "@/lib/tool-catalog";
import { HowItWorks } from "@/components/HowItWorks";

type SlugDef = {
  key: ToolKey;
  to: string; // dashboard target route (existing route)
  metaAr: { title: string; desc: string; when: string };
  metaEn: { title: string; desc: string; when: string };
  metaKu: { title: string; desc: string; when: string };
};

const SLUGS: Record<string, SlugDef> = {
  analyze: {
    key: "analyze",
    to: "/dashboard",
    metaAr: { title: "تحليل GEO — قِس قابلية الاستشهاد", desc: "ألصق فقرة من موقعك واحصل على درجة GEO من 100 وتوصيات تطبيقية.", when: "حين تريد قياس فرص ظهورك في إجابات الذكاء الاصطناعي." },
    metaEn: { title: "GEO Analysis — Measure citation-worthiness", desc: "Paste a paragraph from your site and get a 0–100 GEO score with actionable tips.", when: "When you want to measure your chances of being cited by AI." },
    metaKu: { title: "شیکاری GEO", desc: "دەقێک بنووسە و نمرە و پێشنیار وەربگرە.", when: "بۆ پێوانی هەلی دەرکەوتنت لە وەڵامی AI." },
  },
  suggest: {
    key: "suggest",
    to: "/dashboard",
    metaAr: { title: "مولّد المنشورات — محتوى جاهز للنشر", desc: "صِف فكرتك، نولّد عدة منشورات مهيكلة لـ GEO جاهزة للنشر.", when: "حين تحتاج محتوى منتظم بدون وقت تحرير طويل." },
    metaEn: { title: "Post Generator — Publish-ready drafts", desc: "Describe an idea, get several GEO-structured post drafts.", when: "When you need consistent content without long editing cycles." },
    metaKu: { title: "دروستکەری پۆست", desc: "بیرۆکەکەت بنووسە، چەند پۆستی ئامادە وەردەگریت.", when: "بۆ ناوەرۆکی بەردەوام." },
  },
  compare: {
    key: "compare",
    to: "/dashboard",
    metaAr: { title: "مقارنة المنافسين — اعرف الفجوة", desc: "أضف 2–4 منافسين، نُقيّم حضورهم في GEO ونعرض الفجوة.", when: "قبل التخطيط لخطة محتوى لإغلاق الفجوة." },
    metaEn: { title: "Competitor Compare — See the gap", desc: "Add 2–4 competitors. We score their GEO presence and surface the gap.", when: "Before planning a content roadmap." },
    metaKu: { title: "بەراوردکردنی ڕکابەران", desc: "٢–٤ ڕکابەر زیاد بکە.", when: "پێش پلانی ناوەرۆک." },
  },
  visibility: {
    key: "visibility",
    to: "/dashboard",
    metaAr: { title: "تحليل الظهور — في 9 محركات", desc: "نسأل المحركات التسعة عن استعلاماتك ونعطيك GEO Trust Score وخطة رفع.", when: "كل أسبوع أو بعد كل حملة." },
    metaEn: { title: "AI Visibility — Across 9 engines", desc: "We probe 9 engines on your queries and return a GEO Trust Score with an uplift plan.", when: "Weekly, or after every campaign." },
    metaKu: { title: "پشکنینی دیارییەتی", desc: "٩ بزوێنەر دەپرسرێت.", when: "هەفتانە یان دوای کەمپەین." },
  },
  brand_boost: {
    key: "brand_boost",
    to: "/agent",
    metaAr: { title: "تعزيز العلامة — وكيل مستقل لـ 30 يوم", desc: "خطة 30 يوم: محتوى، حزم سلطة، حملات مجدولة، قياس أسبوعي.", when: "حين تريد نموًا تلقائيًا متواصلًا بدون متابعة يدوية." },
    metaEn: { title: "Brand Boost — 30-day autonomous agent", desc: "30-day plan: content, authority packs, scheduled campaigns, weekly tracking.", when: "When you want continuous, hands-off growth." },
    metaKu: { title: "بەهێزکردنی براند", desc: "پلانی ٣٠ ڕۆژی خۆکار.", when: "بۆ گەشەی بەردەوام." },
  },
};

export const Route = createFileRoute("/tools/$slug")({
  loader: ({ params }) => {
    const def = SLUGS[params.slug];
    if (!def) throw notFound();
    return def;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [] };
    const m = loaderData.metaEn;
    const url = `https://geoiraq.com/tools/${loaderData.key}`;
    return {
      meta: [
        { title: `${m.title} · MAAROOF Ai` },
        { name: "description", content: m.desc },
        { property: "og:title", content: m.title },
        { property: "og:description", content: m.desc },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">404</div>
  ),
  errorComponent: () => (
    <div className="min-h-screen grid place-items-center text-sm text-destructive">Error</div>
  ),
  component: () => (
    <I18nProvider>
      <Page />
    </I18nProvider>
  ),
});

function Page() {
  const { lang } = useI18n();
  const def = Route.useLoaderData();
  const L = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  const m = L === "en" ? def.metaEn : L === "ku" ? def.metaKu : def.metaAr;
  const name = toolLabel(def.key, L);

  const Lc = {
    ar: { what: "ما الذي تفعله الأداة", when: "متى تستخدمها", get: "ما الذي ستحصل عليه", start: "ابدأ الآن", backHome: "← الرئيسية" },
    en: { what: "What this tool does", when: "When to use it", get: "What you'll get", start: "Start now", backHome: "← Home" },
    ku: { what: "ئەرکی ئامراز", when: "کەی بەکاری بهێنیت", get: "چی وەردەگریت", start: "دەستپێبکە", backHome: "← ماڵەوە" },
  }[L];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
          <Sparkles className="size-3" /> {name}
        </span>
        <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-gradient">{m.title}</h1>
        <p className="mt-4 text-base text-muted-foreground">{m.desc}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card title={Lc.what} body={m.desc} />
          <Card title={Lc.when} body={m.when} />
          <Card title={Lc.get} body={TOOL_CATALOG.find((x) => x.key === def.key)?.labels[L] || name} />
        </div>

        <div className="mt-8">
          <HowItWorks toolKey={def.key} />
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            to={def.to}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:scale-[1.02]"
          >
            {Lc.start} <ArrowRight className="size-4" />
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">{Lc.backHome}</Link>
        </div>
      </main>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">{title}</div>
      <div className="mt-1.5 text-sm text-foreground/85 leading-relaxed">{body}</div>
    </div>
  );
}
