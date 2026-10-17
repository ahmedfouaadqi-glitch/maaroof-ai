import { createFileRoute, Link } from "@tanstack/react-router";

import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";

import { ArrowRight, Sparkles, Globe2, Bot, Phone } from "lucide-react";
import { EnginesOrbit } from "@/components/EnginesOrbit";
import { BlurText } from "@/components/motion/BlurText";
import { ENGINES } from "@/components/engine-logos";
import { useCountry } from "@/lib/use-country";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MAAROOF Ai — AI Visibility and Goal-Driven Intelligence" },
      { name: "description", content: "Plan research, analyze markets and improve brand visibility with a goal-driven AI workspace in Arabic, Kurdish and English." },
      { property: "og:title", content: "MAAROOF Ai — From Business Goal to Actionable Intelligence" },
      { property: "og:description", content: "Coordinate research, analysis and existing tools in one multilingual AI workspace for business and brand intelligence." },
      { property: "og:url", content: "https://maaroofai.com/" },
    ],
    links: [{ rel: "canonical", href: "https://maaroofai.com/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "MAAROOF Ai",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://maaroofai.com/",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description: "A multilingual business intelligence workspace that coordinates research, analysis, and existing AI tools to help users move from goals to reviewable results.",
      }),
    }],
  }),
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <Page />
      </AuthProvider>
    </I18nProvider>
  ),
});

function Page() {
  const { t, lang } = useI18n();
  const { info: country } = useCountry();
  const welcomeName = country
    ? lang === "ar" ? country.name_ar : lang === "ku" ? country.name_ku : country.name_en
    : "";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        {/* Agent promo banner */}
        <div className="border-b border-accent/30 bg-gradient-to-r from-accent/15 via-primary/10 to-accent/15">
          <Link to="/pricing" className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-center text-xs hover:bg-accent/10 md:text-sm">
            <Bot className="size-4 text-accent" />
            <BlurText
              as="span"
              text={t("agent_banner_title")}
              delay={30}
              stepDuration={0.2}
              center={false}
              className="font-semibold text-accent"
            />
            <BlurText
              as="span"
              text={`— ${t("agent_banner_desc")}`}
              delay={18}
              stepDuration={0.18}
              startDelay={180}
              center={false}
              className="text-muted-foreground"
            />
            <span className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline">
              {t("agent_banner_cta")} <ArrowRight className="size-3" />
            </span>
          </Link>

        </div>

        {/* Redesigned goal-first landing hero */}
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10 grid-bg opacity-30" />
          <div className="absolute -top-36 start-1/4 -z-10 size-[32rem] rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-24 end-0 -z-10 size-80 rounded-full bg-accent/10 blur-3xl" />
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-12 pt-12 md:px-6 md:pb-20 md:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            <div className="text-center lg:text-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" /> {t("hero_badge")}
              </span>
              {country && <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs text-foreground/80">
                <span className="text-base leading-none">{country.flag}</span>
                <span>{lang === "ar" ? `مرحباً بزوارنا من ${welcomeName}` : lang === "ku" ? `بەخێرهاتنی میوانانمان لە ${welcomeName}` : `Welcome, visitors from ${welcomeName}`}</span>
              </div>}
              <BlurText as="h1" text={t("hero_title")} eager delay={60} stepDuration={0.26} segmentClassName="text-gradient" className="mt-5 font-display text-4xl font-bold leading-[1.08] md:text-5xl lg:text-6xl" />
              <BlurText text={t("hero_sub")} delay={25} stepDuration={0.22} startDelay={180} className="mx-auto mt-5 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg lg:mx-0" />
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-foreground/85 lg:mx-0">
                {lang === "en" ? "Start with the outcome you need. Maaroof coordinates research, analysis and existing tools, and shows the steps and results you can review." : lang === "ku" ? "لە ئەنجامەکەی کە دەتەوێت دەست پێ بکە. مەعروف توێژینەوە و شیکاری و ئامرازەکانی هەنووکە ڕێکدەخات و هەنگاو و ئەنجامەکانت پیشان دەدات." : "ابدأ بالنتيجة التي تريدها. ينسّق معروف البحث والتحليل والأدوات الحالية، ويعرض لك خطوات العمل والنتائج التي يمكنك مراجعتها."}
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Link to="/workspace" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5">
                  {lang === "en" ? "Start a task" : lang === "ku" ? "دەستپێکردنی ئەرک" : "ابدأ مهمة"} <ArrowRight className="size-4" />
                </Link>
                <Link to="/auth" search={{ mode: "signup", redirect: "/workspace" }} className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-6 py-3.5 text-sm font-semibold transition hover:border-primary/50">
                  {lang === "en" ? "Create an account" : lang === "ku" ? "دروستکردنی هەژمار" : "إنشاء حساب"}
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground lg:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5"><Globe2 className="size-3.5 text-primary" />{t("hero_chip_langs")}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5"><Bot className="size-3.5 text-accent" />{t("hero_chip_agent")}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5"><Sparkles className="size-3.5 text-primary" />{t("hero_chip_engines")}</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute inset-8 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-border/80 bg-card/70 p-3 shadow-2xl backdrop-blur-xl md:p-5">
                <div className="flex items-center justify-between gap-3 border-b border-border/70 px-2 pb-4">
                  <div><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">MAAROOF WORKSPACE</div><div className="mt-1 text-sm font-semibold">{lang === "en" ? "From goal to outcome" : lang === "ku" ? "لە ئامانجەوە بۆ ئەنجام" : "من الهدف إلى النتيجة"}</div></div>
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] text-primary">{lang === "en" ? "Goal-first AI" : lang === "ku" ? "AI بە ئامانج" : "ذكاء اصطناعي موجّه بالهدف"}</span>
                </div>
                <div className="py-3"><EnginesOrbit /></div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { n: "01", title: lang === "en" ? "Describe" : lang === "ku" ? "ڕوونکردنەوە" : "حدّد الهدف", desc: lang === "en" ? "Explain the outcome" : lang === "ku" ? "ئەنجامەکە ڕوون بکەرەوە" : "اشرح ما تريد إنجازه" },
                    { n: "02", title: lang === "en" ? "Coordinate" : lang === "ku" ? "ڕێکخستن" : "نسّق العمل", desc: lang === "en" ? "Skills and tools" : lang === "ku" ? "شارەزایی و ئامراز" : "مهارات وأدوات" },
                    { n: "03", title: lang === "en" ? "Review" : lang === "ku" ? "پێداچوونەوە" : "راجع النتيجة", desc: lang === "en" ? "Steps and evidence" : lang === "ku" ? "هەنگاو و بەڵگە" : "خطوات ونتائج" },
                  ].map(step => <div key={step.n} className="rounded-xl border border-border/70 bg-background/70 p-3"><div className="text-[10px] font-semibold tracking-widest text-primary">{step.n}</div><div className="mt-1 text-sm font-semibold">{step.title}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{step.desc}</div></div>)}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {ENGINES.map(engine => <span key={engine.name} className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 py-1.5 text-[10px] font-medium text-foreground/80 ${engine.tint}`}><engine.Logo size={12} />{engine.name}</span>)}
              </div>
            </div>
          </div>
        </section>

        {/* Crawlable, server-rendered summary so the homepage has substantive content for search engines */}
        <section className="mx-auto max-w-4xl px-4 pb-16 md:px-6" aria-labelledby="about-maaroof">
          <h2 id="about-maaroof" className="font-display text-2xl font-bold md:text-3xl">
            What is MAAROOF Ai?
          </h2>
          <p className="mt-3 text-muted-foreground">
            MAAROOF Ai is a Generative Engine Optimization (GEO) platform that helps brands, publishers and agencies become the source AI answer engines cite. It measures how your brand appears across ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek, Kimi and Qwen, and gives clear, evidence-based steps to improve it in Arabic, Kurdish and English.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <h3 className="font-semibold">Analyze and score</h3>
              <p className="mt-1 text-sm text-muted-foreground">Check factual density, local relevance and citation readiness of any text before you publish.</p>
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <h3 className="font-semibold">Verify on live engines</h3>
              <p className="mt-1 text-sm text-muted-foreground">Ask the engines directly whether they mention your brand, and keep the raw answers as evidence.</p>
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <h3 className="font-semibold">Publish machine-readable identity</h3>
              <p className="mt-1 text-sm text-muted-foreground">Generate llms.txt and Schema.org JSON-LD so your brand identity stays consistent everywhere.</p>
            </div>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            <Link to="/pricing" className="text-primary hover:underline">See plans and pricing</Link>
            {" · "}
            <Link to="/guide" className="text-primary hover:underline">Read the user guide</Link>
          </p>
        </section>
      </main>


      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        <div>{t("footer")}</div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link to="/contact" className="inline-flex items-center gap-1.5 text-foreground/80 hover:text-primary">
            <Phone className="size-3.5" /> {t("nav_contact")}
          </Link>
          <Link to="/privacy" className="hover:text-primary">{t("footer_privacy")}</Link>
          <Link to="/terms" className="hover:text-primary">{t("footer_terms")}</Link>
          <Link to="/pricing" className="hover:text-primary">{t("footer_pricing")}</Link>
          <Link to="/guide" className="hover:text-primary">{t("guide_title")}</Link>
        </div>
      </footer>
    </div>
  );
}
