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
  const skillName = (s: any) => s.name?.[lang] ?? s.name?.ar ?? s.title?.[lang] ?? s.key;

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
          <h2 className="text-center font-display text-2xl font-bold">{c.skills}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MAAROOF_SKILLS.map((s) => (
              <div key={s.key} className="rounded-xl border border-border bg-card/40 p-4 text-sm font-medium">{skillName(s)}</div>
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
