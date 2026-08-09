import { createFileRoute } from "@tanstack/react-router";
import { BlurText } from "@/components/motion/BlurText";
import { SiteHeader } from "@/components/SiteHeader";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { STATE_LABELS, VERIFICATION_STATES } from "@/lib/maaroof/truth";

const TITLE = "Verification Methodology — How MAAROOF Ai Proves Every Claim";
const DESC =
  "How MAAROOF Ai labels every result: verified, measured, executed, simulated, predicted or assumed — with the evidence chain and gates behind each label.";
const URL = "https://geoiraq.com/methodology";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          description: DESC,
          url: URL,
          mainEntityOfPage: URL,
          author: { "@type": "Organization", name: "MAAROOF Ai" },
          publisher: {
            "@type": "Organization",
            name: "MAAROOF Ai",
            logo: { "@type": "ImageObject", url: "https://geoiraq.com/icon-512.png" },
          },
        }),
      },
    ],
  }),
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <MethodologyPage />
      </AuthProvider>
    </I18nProvider>
  ),
});

const COPY = {
  ar: {
    h1: "منهجية التحقق",
    intro:
      "كل نتيجة في MAAROOF Ai تحمل تسمية واحدة تشرح مصدرها: هل تم التحقق منها، أم قياسها، أم تنفيذها، أم محاكاتها فقط. لا نقدّم توقّعاً على أنه واقع.",
    statesH: "تسميات الحالة",
    chainH: "سلسلة الدليل",
    chain: [
      "جمع الأدلة من الأدوات والمصادر والقياسات وتسجيلها بمرجع يمكن الرجوع إليه.",
      "تصنيف كل دليل بنوعه ومصداقية مصدره وحداثته.",
      "تحقق متقاطع: لا تُرفع نتيجة إلى «مُتحقَّق» بمصدر واحد فقط.",
      "قياس مقابل خط أساس تاريخي لرصد الاتجاه.",
      "تصنيف حالة الواقع ثم فحص الالتزام بالقواعد الدستورية.",
      "درجة ثقة نهائية مع شرح صريح لما ينقص.",
    ],
    gateH: "بوابة النشر",
    gate:
      "لا تُعرض نتيجة كحقيقة إن كانت أضعف من «مقاس»، أو بلا أدلة مسجّلة، أو بمصدر واحد، أو فيها تعارضات. في هذه الحالات تظهر التسمية الأضعف مع سبب المنع.",
    limitsH: "حدود صريحة",
    limits:
      "المحاكاة والتوصية لا تنفّذان أي إجراء خارجي. التنفيذ الفعلي يتطلب اعتماد المؤسس ويُسجَّل مع مدّته ومزوّده وكلفته.",
  },
  en: {
    h1: "Verification Methodology",
    intro:
      "Every result in MAAROOF Ai carries one label describing its origin: verified, measured, executed, or merely simulated. We never present a prediction as reality.",
    statesH: "State labels",
    chainH: "Evidence chain",
    chain: [
      "Collect evidence from tools, sources and measurements, each stored with a traceable reference.",
      "Classify every item by type, source reliability and freshness.",
      "Cross-validate: nothing reaches Verified from a single source.",
      "Measure against a historical baseline to detect the trend.",
      "Classify the reality state, then check constitutional compliance.",
      "Produce a final confidence score with an explicit list of what is missing.",
    ],
    gateH: "Publication gate",
    gate:
      "A result is not presented as fact when it is weaker than Measured, has no recorded evidence, relies on a single source, or contains contradictions. In those cases the weaker label is shown together with the reason.",
    limitsH: "Explicit limits",
    limits:
      "Simulation and recommendation modes perform no external action. Real execution requires founder approval and is logged with its duration, provider and cost.",
  },
  ku: {
    h1: "میتۆدی پشتڕاستکردنەوە",
    intro:
      "هەموو ئەنجامێک لە MAAROOF Ai یەک ناونیشانی هەیە کە سەرچاوەی ڕوون دەکاتەوە: پشتڕاستکراو، پێواوکراو، جێبەجێکراو، یان تەنها شێوەکاری. پێشبینی وەک ڕاستی پێشکەش ناکەین.",
    statesH: "ناونیشانەکانی دۆخ",
    chainH: "زنجیرەی بەلگە",
    chain: [
      "کۆکردنەوەی بەلگە لە ئامرازەکان و سەرچاوەکان و پێوانەکان بە ئاماژەیەکی گەڕانەوە.",
      "پۆلێنکردنی هەر بەلگەیەک بەپێی جۆر و متمانەی سەرچاوە و نوێیی.",
      "پشتڕاستکردنەوەی هاوبەش: بە یەک سەرچاوە نابێتە پشتڕاستکراو.",
      "پێوان بەرامبەر بنەمای مێژوویی بۆ دیتنی ئاراستە.",
      "پۆلێنکردنی دۆخی ڕاستی و پاشان پشکنینی پابەندی یاساکان.",
      "نمرەی متمانەی کۆتایی لەگەڵ ڕوونکردنەوەی ئەوەی کەمە.",
    ],
    gateH: "دەرگای بلاوکردنەوە",
    gate:
      "ئەنجام وەک ڕاستی پێشکەش ناکرێت ئەگەر لاوازتر بێت لە پێواوکراو، یان بەلگە نەبێت، یان یەک سەرچاوە بێت، یان ناکۆکی تێدابێت.",
    limitsH: "سنوورەکان",
    limits:
      "شێوەکاری و ڕاسپاردە هیچ کردارێکی دەرەکی ئەنجام نادەن. جێبەجێکردنی ڕاستەقینە پەسەندی دامەزرێنەر پێویستە.",
  },
} as const;

function MethodologyPage() {
  const { lang } = useI18n();
  const l = (lang === "en" ? "en" : lang === "ku" ? "ku" : "ar") as keyof typeof COPY;
  const c = COPY[l];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 space-y-8">
        <header className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold">
            <BlurText text={c.h1} />
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{c.intro}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{c.statesH}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {VERIFICATION_STATES.map((s) => (
              <li key={s} className="rounded-xl border border-border/60 bg-card/50 p-3">
                <div className="text-xs font-mono text-primary">{s}</div>
                <div className="text-sm">{STATE_LABELS[s][l]}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{c.chainH}</h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal ps-5">
            {c.chain.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{c.gateH}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{c.gate}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{c.limitsH}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{c.limits}</p>
        </section>
      </main>
    </div>
  );
}
