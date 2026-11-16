import { Link } from "@tanstack/react-router";
import { MessageCircle, SearchX, Sparkles } from "lucide-react";
import { ENGINES } from "@/components/engine-logos";
import { LogoLoop } from "@/components/motion/effects";

type L = "ar" | "en" | "ku";

const T = {
  ar: {
    problemTitle: "قبل أن يختار العميل… قد يسأل محركات الذكاء الاصطناعي",
    problem: "تؤثر إجابات البحث التوليدي في طريقة اكتشاف العلامات ومقارنتها. افهم ما الذي تذكره النماذج عن كيانك، وما الذي لا يزال يحتاج إلى توثيق أو تحسين — اعتماداً على استجابات الفحص الفعلية.",
    strip: "عينة الفحص المجاني تستخدم ثلاثة مسارات نموذجية مستقلة عند توافرها؛ وهذه قائمة المحركات العشرة في منظومة معروف:",
    ctaTitle: "ابدأ بعينة واضحة، ثم قرر الخطوة التالية",
    cta: "التجربة المجانية تقدم عينة محدودة من ثلاث استجابات. أما العمل الموسّع فيتناول نطاقات وأسئلة ومصادر إضافية وفق خطة متفق عليها.",
    start: "ابدأ القياس الكامل", contact: "تحدّث مع فريق معروف",
    faq: [
      ["الظهور يؤثر في الاكتشاف", "قد تدخل إجابات الذكاء الاصطناعي ضمن رحلة البحث والمقارنة، بحسب السؤال والمحرك."],
      ["وضوح الهوية يدعم الفهم", "المعلومات المتسقة والموثقة تساعد على تمييز الكيان وتقليل الالتباس."],
      ["فحص مباشر بنتائج محدودة", "نعرض الاستجابات التي وصلت فعلاً ونوضح المسارات التي لم تجب."],
    ],
  },
  en: {
    problemTitle: "Before customers choose, they may ask AI about your brand",
    problem: "AI-generated answers can influence how people discover and compare brands. See the responses received for your name, identify what is clear, and spot gaps that may need stronger evidence.",
    strip: "This free check samples up to three independent model routes when available. The ten engines shown below belong to the wider MAAROOF ecosystem; they are not all queried by this trial:",
    ctaTitle: "Start with evidence. Decide on the next step later.",
    cta: "The free trial provides a limited sample of up to three responses. A broader assessment can examine additional markets, questions and sources under an agreed scope.",
    start: "Explore a broader assessment", contact: "Discuss next steps with MAAROOF",
    faq: [
      ["Understand the responses", "Review what the responding models actually said about the name you entered."],
      ["Find information gaps", "Spot missing, inconsistent or unclear details that may benefit from stronger evidence."],
      ["Know the sample limits", "See which routes answered. Unavailable routes are not presented as successful results."],
    ],
  },
  ku: {
    problemTitle: "کڕیارەکانت پێش سەردانی ماڵپەڕەکەت پرسیار لە زیرەکی دەستکرد دەکەن",
    problem: "زۆرێک لە پرسیارەکان ئێستا لەناو وەڵامی بزوێنەرەکەدا کۆتایی دێن بەبێ کرتە. ئەگەر براندەکەت ناوی نەهێنرێت، لە بڕیارەکەدا ئامادە نیت.",
    strip: "پشکنینی خۆڕایی نموونەیەکی سنووردارە لە سێ ڕێڕەوی مۆدێلی سەربەخۆ کاتێک بەردەست بن؛ ئەمانە دە بزوێنەری ناو ژینگەی مەعروفن:",
    ctaTitle: "بە نموونەیەکی ڕوون دەست پێبکە",
    cta: "تاقیکردنەوەی خۆڕایی نموونەیەکی سنووردار لە سێ وەڵام پێشکەش دەکات؛ هەنگاوی فراوانتر دەتوانێت بازاڕ و پرسیار و سەرچاوەی زیاتر بپشکنێت.",
    start: "دەستپێکردنی پێوانەی تەواو", contact: "قسە لەگەڵ تیمی مەعروف",
    faq: [
      ["دەرکەوتن کاریگەری لە دۆزینەوەدا هەیە", "وەڵامەکانی زیرەکی دەستکرد دەتوانن کاریگەری لە گەڕان و بەراوردکردندا هەبێت، بە پێی پرسیار و بزوێنەر."],
      ["ناسنامەی ڕوون یارمەتی تێگەیشتن دەدات", "زانیاریی یەکگرتوو و پشتڕاستکراو جیاکردنەوەی قەوارە و کەمکردنەوەی ناڕوونی ئاسان دەکات."],
      ["نموونەی ڕاستەوخۆ بە سنووری دیار", "ئەو وەڵامانە پیشان دەدەین کە بەڕاستی گەیشتوون و ئەو ڕێڕەوانە دیاری دەکەین کە وەڵامیان نەداوەتەوە."],
    ],
  },
} as const;

export function FreeAuditMarketing({ lang, part }: { lang: L; part: "top" | "bottom" }) {
  const t = T[lang];
  if (part === "top") {
    return (
      <div className="mx-auto mt-10 max-w-4xl space-y-4">
        <div className="flex gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-5">
          <SearchX className="mt-1 size-6 shrink-0 text-primary" />
          <div>
            <h2 className="font-display text-lg font-bold">{t.problemTitle}</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{t.problem}</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-4">
          <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <p className="text-xs leading-6 text-muted-foreground">{t.strip}</p>
          <div className="mt-3">
            <LogoLoop>
              {ENGINES.map(({ key, name, Logo, tint }) => (
                <span key={key} className={`inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-gradient-to-r ${tint} px-3 py-2 text-xs font-semibold`} title={name}>
                  <Logo size={17} /> <span>{name}</span>
                </span>
              ))}
            </LogoLoop>
          </div>
        </div>
      </div>
    );
  }
  return (
    <section className="mx-auto mt-12 max-w-4xl">
      <div className="grid gap-3 md:grid-cols-3">
        {t.faq.map(([q, a]) => (
          <div key={q} className="rounded-xl border border-border bg-card/60 p-4">
            <h3 className="flex flex-row items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" /><span dir={lang === "en" ? "ltr" : "rtl"}>{q}</span></h3>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">{a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FreeAuditResultCta({ lang }: { lang: L }) {
  const t = T[lang];
  return (
    <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <h3 className="font-display text-lg font-bold">{t.ctaTitle}</h3>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{t.cta}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link to="/contact" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"><MessageCircle className="size-4" /><span dir={lang === "en" ? "ltr" : "rtl"}>{t.contact}</span></Link>
      </div>
    </div>
  );
}
