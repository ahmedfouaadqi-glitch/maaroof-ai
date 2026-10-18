import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Target, ShieldCheck, LayoutGrid } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { ENGINES } from "@/components/engine-logos";
import { MAAROOF_SKILLS } from "@/lib/maaroof/skill-catalog";
import { useAuth } from "@/lib/auth";
import type { InterfacePolicy } from "@/lib/interface-policy";

const COPY = {
  ar: {
    badge: "مساحة العمل الذكية",
    title: "اكتب هدفك، ومعروف يختار الطريق",
    sub: "صف ما تريد تحقيقه لعلامتك في محركات الإجابة التوليدية، وسنقترح المهارات المناسبة ونعرض الكلفة قبل أي تنفيذ.",
    cta: "ابدأ مساحة العمل",
    pro: "واجهة المحترفين",
    skills: "المهارات المتاحة",
    engines: "يُسأل كل محرك من المحركات العشرة",
    s1: "حدّد هدفك", s2: "راجع الخطة والكلفة", s3: "تابع التنفيذ والأدلة",
    classic: "الصفحة الكلاسيكية",
  },
  en: {
    badge: "Smart Workspace",
    title: "Write your goal, Maaroof picks the path",
    sub: "Describe what you want for your brand in generative answer engines. We suggest the right skills and show the cost before anything runs.",
    cta: "Start the workspace",
    pro: "Professional interface",
    skills: "Available skills",
    engines: "Each of the ten engines is asked",
    s1: "Set your goal", s2: "Review plan and cost", s3: "Follow execution and evidence",
    classic: "Classic page",
  },
  ku: {
    badge: "شوێنی کاری زیرەک",
    title: "ئامانجەکەت بنووسە، مەعروف ڕێگاکە هەڵدەبژێرێت",
    sub: "باسی ئەوە بکە کە دەتەوێت بۆ براندەکەت، ئێمە کارامەییە گونجاوەکان پێشنیار دەکەین و تێچوو پیشان دەدەین پێش جێبەجێکردن.",
    cta: "دەستپێکردنی شوێنی کار",
    pro: "ڕووکاری پسپۆڕان",
    skills: "کارامەییە بەردەستەکان",
    engines: "هەر دە بزوێنەرەکە پرسیاریان لێ دەکرێت",
    s1: "ئامانج دیاری بکە", s2: "پلان و تێچوو ببینە", s3: "جێبەجێکردن و بەڵگە بەدواداچوون",
    classic: "پەڕەی کلاسیک",
  },
} as const;

export function NewLanding({ policy }: { policy: InterfacePolicy }) {
  const { lang } = useI18n();
  const { user } = useAuth();
  const c = COPY[(lang === "en" || lang === "ku" ? lang : "ar") as keyof typeof COPY];
  const showPro = policy.available_interfaces.includes("professional") && policy.show_professional_link;
  const skillName = (s: (typeof MAAROOF_SKILLS)[number]) => s.label[(lang === "en" || lang === "ku" ? lang : "ar")];
  const locale = lang === "en" || lang === "ku" ? lang : "ar";
  const pillars = {
    ar: [
      { key: "SEO", title: "تحسين محركات البحث", body: "بنية الصفحات، نية البحث، والفهرسة والأداء — مع فصل القياس الفعلي عن التوصيات." },
      { key: "AEO", title: "تحسين محركات الإجابة", body: "إجابات مباشرة ودقيقة، أسئلة واضحة، ومصادر يمكن التحقق منها." },
      { key: "GEO", title: "تحسين الظهور التوليدي", body: "رفع قابلية فهم الكيان والاستشهاد بمعلوماته في الإجابات التوليدية." },
      { key: "SGE", title: "تجربة البحث التوليدي", body: "تهيئة المحتوى لملخصات وتجارب البحث المدعومة بالذكاء الاصطناعي." },
      { key: "GSEO", title: "تحسين رحلة البحث التوليدي", body: "ربط أسئلة المستخدم ومراحل قراره بالمحتوى والأدلة المناسبة." },
    ],
    en: [
      { key: "SEO", title: "Search engine optimization", body: "Page structure, search intent, indexing and performance—separating measured results from recommendations." },
      { key: "AEO", title: "Answer engine optimization", body: "Direct, accurate answers, clear questions and verifiable sources." },
      { key: "GEO", title: "Generative engine optimization", body: "Make entity information easier to understand, retrieve and cite in generated answers." },
      { key: "SGE", title: "Generative search experience", body: "Prepare content for AI-assisted search summaries and discovery experiences." },
      { key: "GSEO", title: "Generative search journey optimization", body: "Connect user questions and decision stages with relevant content and evidence." },
    ],
    ku: [
      { key: "SEO", title: "باشترکردنی گەڕانی وێب", body: "پێکهاتەی پەڕە، مەبەستی گەڕان و کارایی؛ جیاکردنەوەی پێوانەی ڕاستەقینە لە پێشنیار." },
      { key: "AEO", title: "باشترکردنی وەڵامدانەوە", body: "وەڵامی ڕاستەوخۆ و ورد، پرسیاری ڕوون و سەرچاوەی پشتڕاستکراو." },
      { key: "GEO", title: "باشترکردنی دەرکەوتنی بزوێنەری زایەندە", body: "زانیاریی کیانەکە ئاسانتر بۆ تێگەیشتن و ئاماژەپێکردن بکە." },
      { key: "SGE", title: "ئەزموونی گەڕانی زایەندە", body: "ناوەڕۆک بۆ پوختە و ئەزموونی گەڕانی پشتبەستوو بە زیرەکی ئامادە بکە." },
      { key: "GSEO", title: "باشترکردنی ڕێڕەوی گەڕانی زایەندە", body: "پرسیار و قۆناغەکانی بڕیاری بەکارهێنەر بە ناوەڕۆک و بەڵگە پەیوەست بکە." },
    ],
  }[locale];
  const comparison = {
    ar: {
      title: "من نتائج الروابط إلى إجابات مدعومة بالسياق",
      old: "البحث التقليدي",
      new: "معروف: البحث التوليدي",
      rows: [
        ["وحدة التركيز", "صفحة وكلمة مفتاحية", "كيان وحقائق وأسئلة المستخدم"],
        ["شكل النتيجة", "روابط وترتيب", "إجابة وتوصيات مع أدلة عند توفرها"],
        ["التحقق", "مراجعة الصفحات والقياسات", "تمييز الحقائق المصرّح بها والمصادر والفجوات"],
      ],
      truth: "معاينة بطاقة الحقيقة",
      name: "اسم الكيان",
      nameValue: "يُحفظ كما يحدده المستخدم",
      hq: "المقر والأسواق",
      hqValue: "مصادر معلنة — غير مؤكدة مستقلاً",
      links: "الروابط الرسمية",
      linksValue: "موقع رسمي وحسابات موثقة",
      note: "هذه معاينة توضيحية وليست بيانات كيان حقيقي.",
    },
    en: {
      title: "From ranked links to context-aware answers",
      old: "Traditional search",
      new: "Maaroof: generative search",
      rows: [
        ["Focus", "Pages and keywords", "Entity, facts and user questions"],
        ["Output", "Links and ranking", "Answers and recommendations with evidence when available"],
        ["Verification", "Review pages and measurements", "Separate declared facts, sources and gaps"],
      ],
      truth: "Truth-card preview",
      name: "Entity name",
      nameValue: "Stored as supplied by the user",
      hq: "HQ and markets",
      hqValue: "Declared, not independently verified",
      links: "Official links",
      linksValue: "Official website and social accounts",
      note: "Illustrative preview, not real entity data.",
    },
    ku: {
      title: "لە بەستەری ڕیزکراوەوە بۆ وەڵامی پەیوەست بە کۆنتێکست",
      old: "گەڕانی ئاسایی",
      new: "مەعروف: گەڕانی زایەندە",
      rows: [
        ["سەرنج", "پەڕە و وشەی سەرەکی", "کیان، ڕاستی و پرسیاری بەکارهێنەر"],
        ["ئەنجام", "بەستەر و ڕیزبەندی", "وەڵام و پێشنیار لەگەڵ بەڵگە ئەگەر هەبێت"],
        ["پشتڕاستکردنەوە", "پشکنینی پەڕە و پێوانە", "جیاکردنەوەی ڕاستی، سەرچاوە و کەلێنەکان"],
      ],
      truth: "پێشبینینی کارتی ڕاستی",
      name: "ناوی کیان",
      nameValue: "بەپێی زانیاریی بەکارهێنەر پاشەکەوت دەکرێت",
      hq: "بارەگا و بازاڕ",
      hqValue: "ڕاگەیەندراوە، بەڵام سەربەخۆ پشتڕاست نەکراوەتەوە",
      links: "بەستەری فەرمی",
      linksValue: "ماڵپەڕ و هەژماری فەرمی",
      note: "ئەمە تەنها نموونەیە، نەک داتای کیانێکی ڕاستەقینە.",
    },
  }[locale];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-16 text-center md:pt-24">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" /> {c.badge}
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-gradient md:text-6xl">{c.title}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">{c.sub}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {user ? (
                <Link to="/workspace" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
                  {c.cta} <ArrowRight className="size-4" />
                </Link>
              ) : (
                <Link to="/auth" search={{ mode: "signup", redirect: "/workspace" }} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
                  {c.cta} <ArrowRight className="size-4" />
                </Link>
              )}
              {showPro && (
                <Link to={user ? "/dashboard" : "/auth"} search={user ? undefined : { mode: "signin", redirect: "/dashboard" } as any}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-6 py-3 text-sm font-semibold">
                  <LayoutGrid className="size-4" /> {c.pro}
                </Link>
              )}
            </div>
            <p className="mt-6 text-xs text-muted-foreground">{c.engines}</p>
            <div className="mx-auto mt-3 flex max-w-3xl flex-wrap justify-center gap-2">
              {ENGINES.map((e) => (
                <span key={e.name} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/40 px-3 py-1 text-xs">
                  <e.Logo size={12} /> {e.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-12">
          <div className="grid gap-4 md:grid-cols-3">
            {[{ i: Target, t: c.s1 }, { i: ShieldCheck, t: c.s2 }, { i: Sparkles, t: c.s3 }].map((s, n) => (
              <div key={n} className="rounded-xl border border-border bg-card/40 p-5">
                <s.i className="size-5 text-primary" />
                <h3 className="mt-3 font-semibold">{n + 1}. {s.t}</h3>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16">
          <h2 className="text-center font-display text-2xl font-bold">{comparison.title}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((pillar) => (
              <article key={pillar.key} className="group rounded-2xl border border-border bg-card/40 p-5 transition-colors hover:border-primary/40 motion-reduce:transition-none">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{pillar.title}</span>
                  <span className="rounded-md border border-primary/30 px-2 py-1 text-xs font-bold text-primary">{pillar.key}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{pillar.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16">
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="grid grid-cols-2 bg-muted/40 text-sm font-semibold">
              <div className="p-4">{comparison.old}</div>
              <div className="border-s border-border p-4">{comparison.new}</div>
            </div>
            {comparison.rows.map((row) => (
              <div key={row[0]} className="grid grid-cols-2 border-t border-border text-sm">
                <div className="p-4"><span className="block text-xs text-muted-foreground">{row[0]}</span><span className="mt-1 block">{row[1]}</span></div>
                <div className="border-s border-border p-4 text-muted-foreground">{row[2]}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16">
          <div className="mx-auto max-w-2xl rounded-2xl border border-primary/25 bg-card/50 p-6 shadow-[var(--shadow-glow)]">
            <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><h2 className="font-display text-xl font-bold">{comparison.truth}</h2></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[[comparison.name, comparison.nameValue], [comparison.hq, comparison.hqValue], [comparison.links, comparison.linksValue]].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-background/60 p-4">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-1 text-sm font-medium">{value}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{comparison.note}</p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16">
          <h2 className="text-center font-display text-2xl font-bold">{c.skills}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MAAROOF_SKILLS.map((s) => (
              <div key={s.key} className="rounded-xl border border-border bg-card/40 p-4"><div className="text-sm font-semibold">{skillName(s)}</div><p className="mt-1 text-xs text-muted-foreground">{s.description[(lang === "en" || lang === "ku" ? lang : "ar")]}</p></div>
            ))}
          </div>
          <div className="mt-8 text-center text-xs">
            <Link to="/classic" className="text-muted-foreground hover:text-primary">{c.classic}</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
