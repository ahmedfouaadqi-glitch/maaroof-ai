import { createFileRoute, Link } from "@tanstack/react-router";

import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";

import { ArrowRight, Sparkles, Globe2, Bot, Phone } from "lucide-react";
import { EnginesOrbit } from "@/components/EnginesOrbit";
import { BlurText } from "@/components/motion/BlurText";
import { ENGINES } from "@/components/engine-logos";
import { useCountry } from "@/lib/use-country";
import { useContactInfo, whatsappLinkFromInfo } from "@/lib/contact-info";

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
  const contact = useContactInfo();
  const whatsappMessage = lang === "en" ? "Hello MAAROOF Ai, I would like to learn more about the platform." : lang === "ku" ? "سڵاو MAAROOF Ai، دەمەوێت زیاتر لە پلاتفۆڕمەکە بزانم." : "مرحباً معروف، أود معرفة المزيد عن المنصة.";
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

        {/* Ten-model ecosystem: official-style marks already maintained by the shared engine catalog */}
        <section id="ai-models" className="relative overflow-hidden border-y border-border/70 bg-card/25 py-16 md:py-24">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{lang === "en" ? "One workspace. Ten AI ecosystems." : lang === "ku" ? "یەک شوێنی کار، دە سیستەمی AI" : "مساحة واحدة. عشرة نماذج للذكاء الاصطناعي."}</span>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight md:text-5xl">{lang === "en" ? "The models are powerful. The orchestration is the advantage." : lang === "ku" ? "هێزی مۆدێلەکان؛ بەهای ڕێکخستنیانە." : "قوة النماذج مهمة؛ لكن قيمة معروف في تنسيقها."}</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">{lang === "en" ? "MAAROOF brings ten leading AI model ecosystems into one workflow for research, comparison, brand visibility and business tasks—so you can choose the right capability for the job." : lang === "ku" ? "مەعروف دە سیستەمی پێشەنگی AI لە یەک ڕەوتی کاردا کۆدەکاتەوە بۆ توێژینەوە، بەراورد، دەرکەوتنی براند و ئەرکی بازرگانی." : "يجمع معروف عشرة أنظمة رائدة للذكاء الاصطناعي ضمن مسار عمل واحد للبحث والمقارنة وظهور العلامة التجارية ومهام الأعمال، لتختار القدرة المناسبة لكل مهمة."}</p>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {ENGINES.map((engine, index) => <div key={engine.key} className="group relative flex min-h-36 flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-background/75 p-5 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-glow)]">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex size-14 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-inner"><engine.Logo size={32} /></div>
                <div className="mt-3 text-sm font-semibold">{engine.name}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{lang === "en" ? `Ecosystem ${String(index + 1).padStart(2,"0")}` : lang === "ku" ? `سیستەم ${String(index + 1).padStart(2,"0")}` : `النظام ${String(index + 1).padStart(2,"0")}`}</div>
              </div>)}
            </div>
            <p className="mx-auto mt-5 max-w-3xl text-center text-xs leading-6 text-muted-foreground">{lang === "en" ? "Model availability and live checks depend on configuration, access, plan and current provider availability. Third-party names and marks belong to their respective owners; their appearance does not imply endorsement." : lang === "ku" ? "بەردەستبوونی مۆدێل و پشکنینی ڕاستەوخۆ بە ڕێکخستن، دەستگەیشتن، پلان و بەردەستبوونی دابینکەرەوە پەیوەستە. ناو و نیشانەکان هی خاوەنەکانی خۆیانن." : "يتوقف توفر النماذج والفحص المباشر على الإعدادات والصلاحيات والخطة وتوفر المزوّد. الأسماء والشعارات ملك لأصحابها ولا تعني وجود شراكة أو اعتماد."}</p>
            <div className="mt-8 text-center"><Link to="/workspace" className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary/15">{lang === "en" ? "Explore the workspace" : lang === "ku" ? "بینینی شوێنی کار" : "استكشف مساحة العمل"} <ArrowRight className="size-4" /></Link></div>
          </div>
        </section>

        {/* How Maaroof creates value */}
        <section className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div><span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{lang === "en" ? "Beyond a chat window" : lang === "ku" ? "زیاتر لە پەنجەرەی گفتوگۆ" : "أبعد من نافذة محادثة"}</span>
              <h2 className="mt-3 font-display text-3xl font-bold leading-tight md:text-4xl">{lang === "en" ? "From scattered tools to coordinated work." : lang === "ku" ? "لە ئامرازی پەرتەوازەوە بۆ کاری ڕێکخراو." : "من أدوات متفرقة إلى عمل منسّق."}</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{lang === "en" ? "The value is not just access to models. It is the way a goal becomes a plan, tools are selected, usage is governed, and the output is brought back for review." : lang === "ku" ? "بەها تەنها دەستگەیشتن بە مۆدێل نییە؛ بەها لە گۆڕینی ئامانج بۆ پلان و هەڵبژاردنی ئامراز و بەڕێوەبردنی بەکارهێنان و پێداچوونەوە بە ئەنجامە." : "القيمة ليست مجرد الوصول إلى النماذج؛ بل تحويل الهدف إلى خطة، واختيار الأدوات، وضبط الاستهلاك، ثم تقديم النتيجة للمراجعة."}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {n:"01",title:lang==="en"?"Understand the goal":lang==="ku"?"تێگەیشتن لە ئامانج":"فهم الهدف",body:lang==="en"?"Start with the business question or outcome—not a list of tools.":lang==="ku"?"لە پرسیاری بازرگانی یان ئەنجامەوە دەست پێ بکە.":"ابدأ بسؤال العمل أو النتيجة المطلوبة، لا بقائمة أدوات."},
                {n:"02",title:lang==="en"?"Coordinate capabilities":lang==="ku"?"ڕێکخستنی تواناکان":"تنسيق القدرات",body:lang==="en"?"Bring skills, models and existing tools into a purposeful workflow.":lang==="ku"?"شارەزایی و مۆدێل و ئامرازەکان لە ڕەوتێکی ئامانجداردا کۆبکەرەوە.":"اجمع المهارات والنماذج والأدوات في مسار عمل يخدم الهدف."},
                {n:"03",title:lang==="en"?"Keep usage visible":lang==="ku"?"ڕوونکردنەوەی بەکارهێنان":"وضوح الاستهلاك",body:lang==="en"?"Review available balance, plan limits and estimates before execution.":lang==="ku"?"باڵانس و سنووری پلان و خەملاندن پێش جێبەجێکردن ببینە.":"راجع الرصيد وحدود الخطة والتكلفة التقديرية قبل التنفيذ."},
                {n:"04",title:lang==="en"?"Review the result":lang==="ku"?"پێداچوونەوە بە ئەنجام":"مراجعة النتيجة",body:lang==="en"?"Keep the work oriented around results that can be inspected and improved.":lang==="ku"?"کارەکە لەسەر ئەنجامی پشکنراو و باشترکراو ڕابگرە.":"اجعل العمل موجهاً نحو نتائج يمكن فحصها وتحسينها."}
              ].map(item=><div key={item.n} className="rounded-2xl border border-border bg-card/45 p-5 transition hover:border-primary/30"><div className="text-xs font-bold tracking-[0.18em] text-primary">{item.n}</div><h3 className="mt-3 text-base font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p></div>)}
            </div>
          </div>
        </section>

        {/* Contact details continue to use the existing admin-managed contact settings */}
        <section className="border-y border-border/70 bg-card/25 py-14 md:py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 md:px-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div><span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{lang === "en" ? "Talk to Maaroof" : lang === "ku" ? "پەیوەندی بە مەعروفەوە" : "تواصل مع معروف"}</span>
              <h2 className="mt-3 font-display text-3xl font-bold">{lang === "en" ? "Have a real use case in mind?" : lang === "ku" ? "ئەرکێکی ڕاستەقینەت لەبەرچاوە؟" : "لديك حالة استخدام محددة؟"}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{lang === "en" ? "Talk to us about your goals, your team's workflow or how Maaroof could fit your business." : lang === "ku" ? "دەربارەی ئامانج و ڕەوتی کاری تیمەکەت یان چۆنیەتی گونجانی مەعروف لەگەڵ کارەکەت قسە بکە." : "ناقشنا أهدافك أو طريقة عمل فريقك أو كيفية توظيف معروف في أعمالك."}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground"><span dir="ltr">{contact.phone_display}</span>{contact.email && <a href={`mailto:${contact.email}`} className="hover:text-primary">{contact.email}</a>}</div>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <a href={whatsappLinkFromInfo(contact, whatsappMessage)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"><Phone className="size-4" />{lang === "en" ? "WhatsApp us" : lang === "ku" ? "واتسئەپ" : "تواصل عبر واتساب"}</a>
              <Link to="/contact" className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold hover:border-primary/40">{lang === "en" ? "All contact channels" : lang === "ku" ? "هەموو ڕێگاکانی پەیوەندی" : "جميع قنوات التواصل"}</Link>
            </div>
          </div>
        </section>

        {/* Crawlable, server-rendered summary so the homepage has substantive content for search engines */}
        <section className="mx-auto max-w-4xl px-4 pb-16 md:px-6" aria-labelledby="about-maaroof">
          <h2 id="about-maaroof" className="font-display text-2xl font-bold md:text-3xl">
            معروف MAAROOF Ai: Intelligence designed to make your next move clearer
          </h2>
          <p className="mt-3 text-muted-foreground">
            MAAROOF Ai is a multilingual AI work platform that coordinates research, analysis, brand visibility and business tools. It helps users turn a goal into a structured workflow, compare outputs across ten AI ecosystems, and make better-informed decisions in Arabic, Kurdish and English.
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
