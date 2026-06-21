import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { ArrowRight, Sparkles, Lock, Info, PlayCircle, HelpCircle, CheckCircle2, Zap } from "lucide-react";
import { TOOL_CATALOG, type ToolKey, toolLabel } from "@/lib/tool-catalog";
import { HowItWorks } from "@/components/HowItWorks";
import { useVisibility, useToolPrice, usePageGuard } from "@/lib/visibility";
import { CostBadge } from "@/components/CostBadge";

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
      <AuthProvider>
        <Page />
      </AuthProvider>
    </I18nProvider>
  ),
});

function Page() {
  const { lang } = useI18n();
  const def = Route.useLoaderData();
  const vis = useVisibility();
  const price = useToolPrice(def.key);
  usePageGuard();
  const L = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  const m = L === "en" ? def.metaEn : L === "ku" ? def.metaKu : def.metaAr;
  const name = toolLabel(def.key, L);

  const blocked = !vis.loading && (!vis.isToolVisible(def.key) || !price.enabled);
  const BL = {
    ar: { title: "هذه الأداة غير متاحة لحسابك", desc: "تم إخفاء أو تعطيل هذه الأداة من قِبل الإدارة. للوصول، يرجى التواصل أو ترقية الباقة.", back: "← العودة" },
    en: { title: "This tool isn't available for your account", desc: "This tool has been hidden or disabled by the admin. Contact us or upgrade your plan to gain access.", back: "← Back" },
    ku: { title: "ئەم ئامرازە بەردەست نییە", desc: "ئەم ئامرازە لە لایەن بەڕێوەبەرەوە شاراوەتەوە یان لە کار خراوە.", back: "← گەڕانەوە" },
  }[L];

  const Lc = {
    ar: { what: "ما الذي تفعله الأداة", when: "متى تستخدمها", get: "ما الذي ستحصل عليه", start: "ابدأ الآن", backHome: "← الرئيسية" },
    en: { what: "What this tool does", when: "When to use it", get: "What you'll get", start: "Start now", backHome: "← Home" },
    ku: { what: "ئەرکی ئامراز", when: "کەی بەکاری بهێنیت", get: "چی وەردەگریت", start: "دەستپێبکە", backHome: "← ماڵەوە" },
  }[L];

  if (blocked) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-20 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Lock className="size-7" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold">{BL.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{BL.desc}</p>
          <Link to="/dashboard" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">{BL.back}</Link>
        </main>
      </div>
    );
  }

  type Tab = "overview" | "how" | "start";
  const storageKey = `tool-tab:${def.key}`;
  const [tab, setTab] = useState<Tab>("overview");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey) as Tab | null;
      if (saved === "overview" || saved === "how" || saved === "start") setTab(saved);
    } catch { /* ignore */ }
  }, [storageKey]);
  useEffect(() => {
    try { localStorage.setItem(storageKey, tab); } catch { /* ignore */ }
  }, [tab, storageKey]);

  const tabLabels = {
    ar: { overview: "نظرة عامة", how: "كيف تعمل", start: "ابدأ التشغيل" },
    en: { overview: "Overview", how: "How it works", start: "Start" },
    ku: { overview: "گشتی", how: "چۆن کار دەکات", start: "دەستپێبکە" },
  }[L];

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero header */}
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 grid-bg opacity-60" aria-hidden />
        <div className="absolute -top-32 -right-24 size-[420px] rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-24 size-[420px] rounded-full bg-accent/15 blur-3xl" aria-hidden />

        <main className="relative mx-auto max-w-5xl px-4 pb-10 pt-12 sm:pt-16">
          <div className="reveal-up flex flex-wrap items-center gap-2">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">{Lc.backHome}</Link>
            <span className="text-xs text-muted-foreground/60">/</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
              <Sparkles className="size-3" /> {name}
            </span>
            <CostBadge tokens={price.tokens} usd={price.usd} compact />
          </div>

          <div className="reveal-up delay-100 mt-5 flex items-start gap-4 sm:gap-5">
            <div className="relative shrink-0">
              <div className="absolute inset-0 -m-1 rounded-2xl bg-[var(--gradient-border)] opacity-70 blur-md gradient-shift" aria-hidden />
              <div className="relative grid size-14 place-items-center rounded-2xl glass-strong text-primary sm:size-16">
                <Zap className="size-6 sm:size-7" />
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-3xl leading-tight text-gradient sm:text-5xl">{m.title}</h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">{m.desc}</p>
            </div>
          </div>
        </main>
      </div>

      {/* Sticky tab bar */}
      <div className="sticky top-14 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4">
          <nav role="tablist" aria-label={name} className="relative flex gap-1 overflow-x-auto">
            <TabBtn active={tab === "overview"} onClick={() => setTab("overview")} icon={<Info className="size-3.5" />} label={tabLabels.overview} />
            <TabBtn active={tab === "how"} onClick={() => setTab("how")} icon={<HelpCircle className="size-3.5" />} label={tabLabels.how} />
            <TabBtn active={tab === "start"} onClick={() => setTab("start")} icon={<PlayCircle className="size-3.5" />} label={tabLabels.start} />
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div key={tab} className="reveal-up">
          {tab === "overview" && (
            <div role="tabpanel" className="grid gap-4 sm:grid-cols-3">
              <FeatureCard title={Lc.what} body={m.desc} accent="primary" />
              <FeatureCard title={Lc.when} body={m.when} accent="accent" />
              <FeatureCard title={Lc.get} body={TOOL_CATALOG.find((x) => x.key === def.key)?.labels[L] || name} accent="gold" />
            </div>
          )}
          {tab === "how" && (
            <div role="tabpanel" className="rounded-2xl glass p-2 sm:p-6">
              <HowItWorks toolKey={def.key} />
            </div>
          )}
          {tab === "start" && (
            <div role="tabpanel" className="relative overflow-hidden rounded-3xl glass-strong p-6 sm:p-10">
              <div className="absolute -top-24 -right-16 size-72 rounded-full bg-primary/20 blur-3xl" aria-hidden />
              <div className="absolute -bottom-24 -left-16 size-72 rounded-full bg-accent/15 blur-3xl" aria-hidden />

              <div className="relative">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold text-primary">
                  <PlayCircle className="size-3.5" /> {tabLabels.start}
                </div>
                <h2 className="mt-3 font-display text-2xl text-foreground sm:text-3xl">{m.title}</h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{m.desc}</p>

                <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                  {[m.when, Lc.get].map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    to={def.to}
                    className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-primary via-primary to-accent px-7 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:shadow-[var(--shadow-glow-strong)]"
                  >
                    <span className="relative z-10">{Lc.start}</span>
                    <ArrowRight className="relative z-10 size-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:rotate-180" />
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
                  </Link>
                  <CostBadge tokens={price.tokens} usd={price.usd} compact />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative inline-flex shrink-0 items-center gap-1.5 px-4 py-3.5 text-sm font-semibold transition-colors ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
      <span
        className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-all duration-300 ${
          active ? "bg-gradient-to-r from-primary to-accent opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />
    </button>
  );
}

function FeatureCard({ title, body, accent }: { title: string; body: string; accent: "primary" | "accent" | "gold" }) {
  const accentClass =
    accent === "primary" ? "from-primary/40 to-primary/0"
      : accent === "accent" ? "from-accent/40 to-accent/0"
      : "from-gold/40 to-gold/0";
  const ringClass =
    accent === "primary" ? "text-primary"
      : accent === "accent" ? "text-accent"
      : "text-gold";
  return (
    <div className="group relative rounded-2xl glass p-5 hover-lift hover:border-primary/40 hover:shadow-[var(--shadow-glow)]">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentClass}`} aria-hidden />
      <div className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${ringClass}`}>{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-foreground/85">{body}</div>
    </div>
  );
}
