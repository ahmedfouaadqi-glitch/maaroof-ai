import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getLandingData } from "@/lib/landing.functions";
import { truthCardCompleteness, type PublicTruthCard } from "@/lib/landing-data";
import { COUNTRY_NAMES } from "@/lib/entity-consistency";
import { ArrowRight, Sparkles, Target, ShieldCheck, LayoutGrid, Check, X, BadgeCheck, Globe2, Link2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { ENGINES } from "@/components/engine-logos";
import { MAAROOF_SKILLS } from "@/lib/maaroof/skill-catalog";
import { SkillDetailsDialog } from "@/components/landing/SkillDetailsDialog";
import { useAuth } from "@/lib/auth";
import { useCountry } from "@/lib/use-country";
import type { InterfacePolicy } from "@/lib/interface-policy";
import { Reveal } from "@/components/motion/Reveal";
import { SpotlightCard, CountUp, RotatingText, ShinyText, LogoLoop, Magnetic } from "@/components/motion/effects";
import { ModelInsights } from "@/components/landing/ModelInsights";

type L = "ar" | "en" | "ku";

function HeroPulses() {
  const [dots, setDots] = useState<{ x: number; y: number; d: number; s: number }[]>([]);
  useEffect(() => {
    const gen = () => Array.from({ length: 6 }, () => ({ x: Math.random() * 100, y: Math.random() * 100, d: Math.random() * 3, s: 6 + Math.random() * 8 }));
    setDots(gen());
    const id = setInterval(() => setDots(gen()), 6000);
    return () => clearInterval(id);
  }, []);
  return (
    <div aria-hidden className="relative mx-auto h-10 w-56">
      {dots.map((p, i) => (
        <span key={i} className="absolute rounded-full bg-primary motion-safe:animate-ping transition-all duration-[2000ms]"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, animationDelay: `${p.d}s`, animationDuration: "2.4s", opacity: 0.7 }} />
      ))}
    </div>
  );
}

const COPY = {
  ar: {
    badge: "مساحة العمل الذكية",
    title: "اجعل علامتك مصدراً تقتبسه محركات الإجابة",
    rotPrefix: "نحسّن ظهورك عبر",
    brandName: "معروف", sub: "يعرف كيف تراك محركات البحث التوليدية، يقيس حضورك، يحسّن ظهورك، ويجعلك أنت الإجابة.",
    cta: "ابدأ مساحة العمل", pro: "واجهة المحترفين",
    engines: "يُسأل كل محرك من المحركات العشرة",
    how: "كيف يعمل", s1: ["حدّد هدفك", "اكتب ما تريده بلغتك وبأي مدة."], s2: ["راجع الخطة والكلفة", "نعرض الأدوات المختارة وسبب اختيارها وكلفتها مقابل رصيدك."], s3: ["تابع التنفيذ والأدلة", "كل نموذج وحالته وسبب كل نتيجة أمامك."],
    core: "الجوهر الخماسي",
    pillars: [
      ["SEO", "البنية", "صفحات قابلة للزحف وبيانات منظمة تفهمها الآلة."],
      ["AEO", "الإجابات المباشرة", "محتوى يجيب عن السؤال في أول سطرين."],
      ["GEO", "كثافة الحقائق", "إحصاءات واقتباسات تجعل النماذج تستشهد بك."],
      ["SGE", "تلخيصات البحث", "حضور داخل الملخصات التوليدية أعلى نتائج البحث."],
      ["GSEO", "اتساق الهوية", "هوية واحدة متطابقة عبر كل المحركات والمنصات."],
    ],
    vsTitle: "البحث التقليدي مقابل محركات الإجابة",
    vsCols: ["البحث التقليدي", "محركات الإجابة التوليدية"],
    vsRows: [["قائمة روابط", "إجابة مباشرة واحدة"], ["النجاح = نقرة", "النجاح = اقتباس"], ["كلمات مفتاحية", "حقائق وكيانات"], ["ترتيب الصفحة", "ثقة المصدر واتساقه"]],
    truth: "بطاقة حقيقة الكيان",
    truthSub: "مصدر واحد لهويتك تعتمد عليه كل الأدوات والوكيل. هذه بطاقة معروف الحقيقية كما هي محفوظة الآن.",
    truthFields: { name: "الاسم", type: "النوع", country: "البلد", links: "الروابط الرسمية", consistency: "اكتمال البطاقة", markets: "الأسواق المستهدفة" },
    types: "لكل نوع حساب طريقه",
    accountTypes: [
      ["شركة تبيع منتجاتها", "ظهور المنتجات في إجابات الشراء والمقارنة."],
      ["شركة تسويقية", "إثبات الخبرة والحضور في أسئلة القطاع."],
      ["وكالة إخبارية", "أن تكون مصدراً موثوقاً تقتبسه النماذج."],
      ["صانع محتوى", "ربط اسمك بموضوعاتك حتى بلا موقع رسمي."],
      ["شخصية عامة", "سيرة دقيقة ومتسقة وفك تشابه الأسماء."],
      ["فرد", "هوية رقمية واضحة تبدأ من الصفر."],
      ["وكالة تسويقية لديها عملاء", "مساحات منفصلة لكل عميل بهويته."],
    ],
    skills: "المهارات المتاحة",
    stats: ["نماذج ذكاء اصطناعي", "مهارات جاهزة", "لغات مدعومة"],
    faq: "أسئلة شائعة",
    faqs: [
      ["هل الإجابات حقيقية؟", "نعم، كل نتيجة تأتي من سؤال فعلي للنماذج مع حالة وسبب واضحين، ولا نختلق نتائج."],
      ["متى يُخصم الرصيد؟", "بعد نجاح العملية فقط، ونعرض الكلفة قبل التنفيذ."],
      ["هل أحتاج موقعاً؟", "لا، نعمل أيضاً مع صناع المحتوى والأفراد بلا موقع أو حسابات."],
    ],
    final: "ابدأ الآن واعرف كيف تراك النماذج العشرة",
    classic: "الصفحة الكلاسيكية",
  },
  en: {
    badge: "Smart Workspace",
    title: "Make your brand a source answer engines cite",
    rotPrefix: "We improve your visibility through",
    brandName: "Maaroof", sub: "knows how generative engines see you, measures your presence, and makes you the answer.",
    cta: "Start the workspace", pro: "Professional interface",
    engines: "Each of the ten engines is asked",
    how: "How it works", s1: ["Set your goal", "Write what you want, in your language, for any duration."], s2: ["Review plan and cost", "See the chosen tools, why, and their cost against your balance."], s3: ["Follow execution and evidence", "Every model, its status and the reason behind each result."],
    core: "The five pillars",
    pillars: [
      ["SEO", "Structure", "Crawlable pages and machine-readable structured data."],
      ["AEO", "Direct answers", "Content that answers the question in its first lines."],
      ["GEO", "Fact density", "Statistics and quotes that make models cite you."],
      ["SGE", "Search summaries", "Presence inside generative summaries at the top of search."],
      ["GSEO", "Identity consistency", "One matching identity across every engine and platform."],
    ],
    vsTitle: "Traditional search vs answer engines",
    vsCols: ["Traditional search", "Generative answer engines"],
    vsRows: [["List of links", "One direct answer"], ["Success = a click", "Success = a citation"], ["Keywords", "Facts and entities"], ["Page ranking", "Source trust and consistency"]],
    truth: "Entity Truth Card",
    truthSub: "One source for your identity that every tool and the agent rely on. This is Maaroof's real card as stored now.",
    truthFields: { name: "Name", type: "Type", country: "Country", links: "Official links", consistency: "Card completeness", markets: "Target markets" },
    types: "Every account type has its path",
    accountTypes: [
      ["Product company", "Products appear in buying and comparison answers."],
      ["Marketing company", "Prove expertise in sector questions."],
      ["News agency", "Become a trusted source models quote."],
      ["Content creator", "Tie your name to your topics, even without a website."],
      ["Public figure", "An accurate, consistent bio and name disambiguation."],
      ["Individual", "A clear digital identity from scratch."],
      ["Agency with clients", "Separate spaces for each client and identity."],
    ],
    skills: "Available skills",
    stats: ["AI models", "Ready skills", "Supported languages"],
    faq: "FAQ",
    faqs: [
      ["Are the answers real?", "Yes. Every result comes from a real query with a clear status and reason. Nothing is fabricated."],
      ["When is my balance charged?", "Only after success, and the cost is shown before running."],
      ["Do I need a website?", "No. We also work with creators and individuals without a site or accounts."],
    ],
    final: "Start now and see how the ten models see you",
    classic: "Classic page",
  },
  ku: {
    badge: "شوێنی کاری زیرەک",
    title: "براندەکەت بکە بە سەرچاوەیەک کە بزوێنەرەکانی وەڵام وەریدەگرن",
    rotPrefix: "دەرکەوتنت باشتر دەکەین لە ڕێگەی",
    brandName: "مەعروف", sub: "دەزانێت بزوێنەرە بەرهەمهێنەرەکان چۆن دەتبینن، ئامادەبوونت دەپێوێت، دەرکەوتنت باشتر دەکات و دەتکاتە وەڵامەکە.",
    cta: "دەستپێکردنی شوێنی کار", pro: "ڕووکاری پسپۆڕان",
    engines: "هەر دە بزوێنەرەکە پرسیاریان لێ دەکرێت",
    how: "چۆن کار دەکات", s1: ["ئامانج دیاری بکە", "بە زمانی خۆت و بۆ هەر ماوەیەک بنووسە."], s2: ["پلان و تێچوو ببینە", "ئامرازە هەڵبژێردراوەکان و هۆکار و تێچوویان ببینە."], s3: ["جێبەجێکردن و بەڵگە", "هەر مۆدێلێک و دۆخی و هۆکاری هەر ئەنجامێک."],
    core: "پێنج کۆڵەکەکە",
    pillars: [
      ["SEO", "پێکهاتە", "پەڕەی خوێندراوە و داتای ڕێکخراو بۆ ئامێر."],
      ["AEO", "وەڵامی ڕاستەوخۆ", "ناوەڕۆکێک لە یەکەم دێڕدا وەڵام دەداتەوە."],
      ["GEO", "چڕی ڕاستییەکان", "ئامار و وتە کە مۆدێلەکان ئاماژەت پێ دەکەن."],
      ["SGE", "پوختەی گەڕان", "ئامادەبوون لە پوختە زیرەکەکانی سەرەوەی گەڕان."],
      ["GSEO", "یەکگرتوویی ناسنامە", "یەک ناسنامە لە هەموو بزوێنەر و پلاتفۆرمەکان."],
    ],
    vsTitle: "گەڕانی ئاسایی بەرامبەر بزوێنەرەکانی وەڵام",
    vsCols: ["گەڕانی ئاسایی", "بزوێنەرە زیرەکەکانی وەڵام"],
    vsRows: [["لیستی بەستەر", "یەک وەڵامی ڕاستەوخۆ"], ["سەرکەوتن = کلیک", "سەرکەوتن = ئاماژەپێدان"], ["وشەی سەرەکی", "ڕاستی و قەوارە"], ["ڕیزبەندی پەڕە", "متمانە و یەکگرتوویی سەرچاوە"]],
    truth: "کارتی ڕاستی قەوارە",
    truthSub: "یەک سەرچاوە بۆ ناسنامەت کە هەموو ئامرازەکان پشتی پێ دەبەستن. ئەمە کارتی ڕاستەقینەی مەعروفە.",
    truthFields: { name: "ناو", type: "جۆر", country: "وڵات", links: "بەستەرە فەرمییەکان", consistency: "تەواوبوونی کارت", markets: "بازاڕە ئامانجەکان" },
    types: "هەر جۆرە هەژمارێک ڕێگای خۆی هەیە",
    accountTypes: [
      ["کۆمپانیای فرۆشتنی بەرهەم", "دەرکەوتنی بەرهەم لە وەڵامەکانی کڕین."],
      ["کۆمپانیای بازاڕگەری", "سەلماندنی شارەزایی لە پرسیارەکانی کەرت."],
      ["ئاژانسی هەواڵ", "ببە بە سەرچاوەیەکی متمانەپێکراو."],
      ["دروستکەری ناوەڕۆک", "ناوت بە بابەتەکانتەوە ببەستە."],
      ["کەسایەتی گشتی", "ژیاننامەیەکی ورد و جیاکردنەوەی ناوە هاوشێوەکان."],
      ["تاک", "ناسنامەیەکی دیجیتاڵی ڕوون لە سفرەوە."],
      ["ئاژانسی بازاڕگەری بە کڕیارەوە", "شوێنی جیا بۆ هەر کڕیارێک."],
    ],
    skills: "کارامەییە بەردەستەکان",
    stats: ["مۆدێلی زیرەک", "کارامەیی ئامادە", "زمانی پشتگیریکراو"],
    faq: "پرسیارە باوەکان",
    faqs: [
      ["وەڵامەکان ڕاستەقینەن؟", "بەڵێ، هەر ئەنجامێک لە پرسیارێکی ڕاستەقینەوە دێت بە دۆخ و هۆکاری ڕوون."],
      ["کەی باڵانس دەبڕدرێت؟", "تەنها دوای سەرکەوتن، و تێچوو پێشتر پیشان دەدرێت."],
      ["پێویستم بە ماڵپەڕە؟", "نەخێر، لەگەڵ دروستکەران و تاکەکانی بێ ماڵپەڕیش کار دەکەین."],
    ],
    final: "ئێستا دەست پێبکە و بزانە دە مۆدێلەکە چۆن دەتبینن",
    classic: "پەڕەی کلاسیک",
  },
} as const;

const PILLAR_WORDS = ["SEO", "AEO", "GEO", "SGE", "GSEO"];

export function NewLanding({ policy }: { policy: InterfacePolicy }) {
  const { lang } = useI18n();
  const { user } = useAuth();
  const l: L = lang === "en" || lang === "ku" ? lang : "ar";
  const c = COPY[l];
  const [data, setData] = useState<{ skills: string[] | null; card: PublicTruthCard | null } | null>(null);
  useEffect(() => { getLandingData().then(setData).catch(() => setData({ skills: null, card: null })); }, []);
  const skills = data?.skills ? MAAROOF_SKILLS.filter((s) => data.skills!.includes(s.key)) : MAAROOF_SKILLS;
  const [openSkill, setOpenSkill] = useState<string | null>(null);
  const card = data?.card ?? null;
  const typeLabel = (t: string | null) => t === "person" ? ({ ar: "شخص", en: "Person", ku: "کەس" } as const)[l] : ({ ar: "منشأة", en: "Organization", ku: "دامەزراوە" } as const)[l];
  const showPro = policy.available_interfaces.includes("professional") && policy.show_professional_link;

  const ctaClass = "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]";
  const Cta = () => (
    <Magnetic>
      {user ? (
        <Link to="/workspace" className={ctaClass}>{c.cta} <ArrowRight className="size-4 rtl:rotate-180" /></Link>
      ) : (
        <Link to="/auth" search={{ mode: "signup", redirect: "/workspace" }} className={ctaClass}>{c.cta} <ArrowRight className="size-4 rtl:rotate-180" /></Link>
      )}
    </Magnetic>
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        {/* 1. Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-40" />
          <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-16 text-center md:pt-24">
            <HeroPulses />
            <CountryWelcome lang={l} />
            <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-gradient md:text-6xl">{c.title}</h1>
            <p className="mt-4 text-lg font-semibold md:text-2xl">
              {c.rotPrefix} <RotatingText words={PILLAR_WORDS} className="text-primary" />
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg"><strong className="font-display text-xl font-extrabold text-primary md:text-2xl">{c.brandName}</strong> — {c.sub}</p>
            <div className="mt-8">
              <ModelInsights lang={l} />
            </div>
          </div>
        </section>

        {/* 2. Engines loop */}
        <section className="mx-auto max-w-5xl px-4 pb-14">
          <p className="mb-3 text-center text-xs text-muted-foreground">{c.engines}</p>
          <LogoLoop>
            {ENGINES.map((e) => (
              <span key={e.name} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs">
                <e.Logo size={14} /> {e.name}
              </span>
            ))}
          </LogoLoop>
        </section>

        {/* 3. How it works */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <h2 className="text-center font-display text-3xl font-bold">{c.how}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[{ i: Target, t: c.s1 }, { i: ShieldCheck, t: c.s2 }, { i: Sparkles, t: c.s3 }].map((s, n) => (
              <Reveal key={n} delay={n * 80}>
                <SpotlightCard className="h-full p-5">
                  <s.i className="size-5 text-primary" />
                  <h3 className="mt-3 font-semibold">{n + 1}. {s.t[0]}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.t[1]}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 4. Five pillars */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <h2 className="text-center font-display text-3xl font-bold">{c.core}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {c.pillars.map(([k, t, d], n) => (
              <Reveal key={k} delay={n * 60}>
                <SpotlightCard className="h-full p-4">
                  <ShinyText className="font-mono text-lg font-bold">{k}</ShinyText>
                  <div className="mt-1 text-sm font-semibold">{t}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{d}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 5. Comparison */}
        <section className="mx-auto max-w-4xl px-4 pb-16">
          <h2 className="text-center font-display text-3xl font-bold">{c.vsTitle}</h2>
          <Reveal>
            <div className="mt-6 overflow-hidden rounded-2xl border border-border">
              <div className="grid grid-cols-2 bg-muted/40 text-sm font-semibold">
                <div className="p-3">{c.vsCols[0]}</div><div className="p-3 text-primary">{c.vsCols[1]}</div>
              </div>
              {c.vsRows.map(([a, b]) => (
                <div key={a} className="grid grid-cols-2 border-t border-border text-sm">
                  <div className="flex items-center gap-2 p-3 text-muted-foreground"><X className="size-4 shrink-0 text-destructive" />{a}</div>
                  <div className="flex items-center gap-2 p-3"><Check className="size-4 shrink-0 text-success" />{b}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* 6. Truth card */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-bold">{c.truth}</h2>
              <p className="mt-3 text-muted-foreground">{c.truthSub}</p>
            </div>
            {card && (
            <Reveal>
              <SpotlightCard className="glass p-5">
                <div className="flex items-center gap-2 text-sm font-semibold"><BadgeCheck className="size-5 text-primary" />{card.name}</div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{c.truthFields.type}</dt><dd>{typeLabel(card.entity_type)}</dd></div>
                  {card.hq_country && <div className="flex justify-between gap-3"><dt className="flex items-center gap-1 text-muted-foreground"><Globe2 className="size-3.5" />{c.truthFields.country}</dt><dd>{COUNTRY_NAMES[card.hq_country]?.[l] || card.hq_country}</dd></div>}
                  <div className="flex justify-between gap-3"><dt className="flex items-center gap-1 text-muted-foreground"><Link2 className="size-3.5" />{c.truthFields.links}</dt><dd dir="ltr">{card.website || "—"}{card.links_count > 1 ? ` +${card.links_count - 1}` : ""}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{c.truthFields.markets}</dt><dd>{card.markets_count}</dd></div>
                </dl>
                <div className="mt-4">
                  <div className="flex justify-between text-xs"><span>{c.truthFields.consistency}</span><CountUp to={truthCardCompleteness(card)} suffix="%" /></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${truthCardCompleteness(card)}%` }} /></div>
                </div>
              </SpotlightCard>
            </Reveal>
            )}
          </div>
        </section>

        {/* 7. Account types */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <h2 className="text-center font-display text-3xl font-bold">{c.types}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {c.accountTypes.map(([t, d], n) => (
              <Reveal key={t} delay={n * 40}>
                <SpotlightCard className="h-full p-4">
                  <div className="text-sm font-semibold">{t}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{d}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 8. Skills */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <h2 className="text-center font-display text-3xl font-bold">{c.skills}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((s) => (
              <button key={s.key} type="button" onClick={() => setOpenSkill(s.key)} className="block h-full text-start">
                <SpotlightCard className="h-full p-4 transition hover:border-primary/40">
                  <div className="text-sm font-semibold">{s.label[l]}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.description[l]}</p>
                </SpotlightCard>
              </button>
            ))}
          </div>
          <SkillDetailsDialog skillKey={openSkill} l={l} onClose={() => setOpenSkill(null)} />
          <div className="hidden">
          </div>
        </section>

        {/* 9. Real stats */}
        <section className="mx-auto max-w-4xl px-4 pb-16">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[ENGINES.length, skills.length, 3].map((n, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card/40 p-4">
                <CountUp to={n} className="font-display text-3xl font-bold text-gradient md:text-4xl" />
                <div className="mt-1 text-xs text-muted-foreground">{c.stats[i]}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 10. FAQ + final CTA */}
        <section className="mx-auto max-w-3xl px-4 pb-20">
          <h2 className="text-center font-display text-3xl font-bold">{c.faq}</h2>
          <div className="mt-6 space-y-2">
            {c.faqs.map(([q, a]) => (
              <details key={q} className="group rounded-xl border border-border bg-card/40 p-4">
                <summary className="cursor-pointer text-sm font-semibold">{q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
          <div className="mt-12 text-center">
            <h3 className="font-display text-2xl font-bold">{c.final}</h3>
            <div className="mt-5 flex justify-center"><Cta /></div>
          </div>
        </section>
      </main>
    </div>
  );
}

function CountryWelcome({ lang }: { lang: "ar" | "en" | "ku" }) {
  const { info } = useCountry();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready || !info || !info.code) return null;
  const name = lang === "en" ? info.name_en : lang === "ku" ? info.name_ku : info.name_ar;
  const text = lang === "en" ? `Welcome, visitors from ${name}` : lang === "ku" ? `بەخێربێن، میوانانی ${name}` : `أهلاً بزوارنا من ${name}`;
  return <p className="mt-4 text-sm font-medium text-muted-foreground">{info.flag} {text}</p>;
}
