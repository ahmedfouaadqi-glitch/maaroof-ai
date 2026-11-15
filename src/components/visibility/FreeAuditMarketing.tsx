import { Link } from "@tanstack/react-router";
import { MessageCircle, SearchX, Sparkles } from "lucide-react";
import { ENGINE_KEYS, ENGINE_CATALOG } from "@/lib/ai-engines";

type L = "ar" | "en" | "ku";

const T = {
  ar: {
    problemTitle: "عملاؤك يسألون الذكاء الاصطناعي قبل أن يزوروا موقعك",
    problem: "كثير من الأسئلة اليوم تنتهي داخل إجابة المحرك نفسه دون أي نقرة. إن لم تُذكر علامتك في تلك الإجابة، فأنت غائب عن قرار العميل.",
    strip: "الفحص المجاني عيّنة حيّة من ثلاثة محركات مستقلة من أصل عشرة تقيسها منصة معروف كاملة:",
    ctaTitle: "هذه عيّنة من ثلاثة محركات فقط",
    cta: "القياس الكامل يغطي المحركات العشرة، الأسواق، الكلمات المفتاحية، ومصادر الاقتباس مع خطة تحسين.",
    start: "ابدأ القياس الكامل", contact: "تحدّث مع فريق معروف",
    faq: [
      ["القرار يُحسم قبل الزيارة", "عملاؤك يسألون الذكاء الاصطناعي أولا. من يُذكر في الإجابة يُختار."],
      ["السلطة قبل الروابط", "المحركات تثق بالكيان الموثّق الواضح، لا بعدد الروابط."],
      ["فحص حيّ بلا تخمين", "إجابات حقيقية من النماذج لحظة الفحص، دون درجات تقديرية."],
    ],
  },
  en: {
    problemTitle: "Your customers ask AI before they visit your site",
    problem: "Many questions now end inside the engine's own answer with no click. If your brand isn't named in that answer, you are absent from the decision.",
    strip: "The free audit is a live sample from three independent engines out of the ten the full Maaroof platform measures:",
    ctaTitle: "This is a sample from three engines only",
    cta: "The full measurement covers all ten engines, markets, keywords and citation sources, with an improvement plan.",
    start: "Start full measurement", contact: "Talk to the Maaroof team",
    faq: [
      ["The decision happens before the visit", "Customers ask AI first. Whoever is named in the answer gets chosen."],
      ["Authority beats links", "Engines trust a clear, verified entity — not link counts."],
      ["Live probe, no guessing", "Real model answers at probe time, with no estimated scores."],
    ],
  },
  ku: {
    problemTitle: "کڕیارەکانت پێش سەردانی ماڵپەڕەکەت پرسیار لە زیرەکی دەستکرد دەکەن",
    problem: "زۆرێک لە پرسیارەکان ئێستا لەناو وەڵامی بزوێنەرەکەدا کۆتایی دێن بەبێ کرتە. ئەگەر براندەکەت ناوی نەهێنرێت، لە بڕیارەکەدا ئامادە نیت.",
    strip: "پشکنینی خۆڕایی نموونەیەکی ڕاستەوخۆیە لە سێ بزوێنەری سەربەخۆ لە کۆی ئەو دەیەی پلاتفۆرمی مەعروف دەیپێوێت:",
    ctaTitle: "ئەمە نموونەیەکە لە سێ بزوێنەر تەنها",
    cta: "پێوانەی تەواو هەموو دە بزوێنەرەکە، بازاڕەکان، وشە سەرەکییەکان و سەرچاوەکان دەگرێتەوە لەگەڵ پلانی باشترکردن.",
    start: "دەستپێکردنی پێوانەی تەواو", contact: "قسە لەگەڵ تیمی مەعروف",
    faq: [
      ["بڕیار پێش سەردان دەدرێت", "کڕیاران سەرەتا پرسیار لە زیرەکی دەستکرد دەکەن. ئەوەی ناوی بێت هەڵدەبژێردرێت."],
      ["دەسەڵات پێش بەستەرەکان", "بزوێنەرەکان متمانە بە کیانی ڕوون و پشتڕاستکراو دەکەن."],
      ["پشکنینی ڕاستەوخۆ بێ گومان", "وەڵامی ڕاستەقینەی مۆدێلەکان، بێ نمرەی خەمڵێنراو."],
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
        <div className="rounded-2xl border border-border/70 bg-card/50 p-4">
          <p className="text-xs text-muted-foreground">{t.strip}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ENGINE_KEYS.map((k) => (
              <span key={k} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium">{ENGINE_CATALOG[k].name}</span>
            ))}
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
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" />{q}</h3>
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
        <Link to="/contact" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"><MessageCircle className="size-4" />{t.contact}</Link>
      </div>
    </div>
  );
}
