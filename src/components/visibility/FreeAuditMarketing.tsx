import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, SearchX, ShieldCheck } from "lucide-react";
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
      ["هل الفحص مجاني فعلا؟", "نعم، تجربة واحدة لكل فترة أهلية دون أي خصم من رصيد."],
      ["هل النتائج حقيقية؟", "كل إجابة تأتي من محرك حي في لحظة الفحص. إن لم يُجب محرك يُكتب ذلك ولا يُقدَّر."],
      ["ماذا يحدث لبياناتي؟", "التقرير يُحذف تلقائيا بعد 72 ساعة، وهو منفصل تماما عن أي مساحة عمل."],
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
      ["Is it really free?", "Yes — one trial per eligibility window, with no balance charged."],
      ["Are the results real?", "Every answer comes from a live engine at probe time. If an engine doesn't answer, that is shown, never estimated."],
      ["What happens to my data?", "The report is deleted automatically after 72 hours and is fully separate from any workspace."],
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
      ["ئایا بەڕاستی خۆڕاییە؟", "بەڵێ، یەک تاقیکردنەوە بۆ هەر ماوەیەکی شایستەیی بەبێ بڕینی باڵانس."],
      ["ئایا ئەنجامەکان ڕاستەقینەن؟", "هەر وەڵامێک لە بزوێنەرێکی ڕاستەوخۆوە دێت. ئەگەر وەڵام نەدرێتەوە، ئەوە پیشان دەدرێت."],
      ["داتاکانم چی لێ دێت؟", "ڕاپۆرتەکە دوای 72 کاتژمێر خۆکارانە دەسڕێتەوە."],
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
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-primary" />{q}</h3>
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
        <Link to="/auth" search={{ mode: "signup", redirect: "/workspace" }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">{t.start} <ArrowRight className="size-4 rtl:rotate-180" /></Link>
        <Link to="/contact" className="inline-flex items-center gap-2 rounded-xl border border-primary/40 px-5 py-3 text-sm font-semibold text-primary hover:bg-primary/10"><MessageCircle className="size-4" />{t.contact}</Link>
      </div>
    </div>
  );
}
