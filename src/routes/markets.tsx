import { createFileRoute } from "@tanstack/react-router";
import { BlurText } from "@/components/motion/BlurText";
import { SiteHeader } from "@/components/SiteHeader";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";

const TITLE = "Supported Markets — MAAROOF Ai Works Worldwide";
const DESC =
  "MAAROOF Ai is a global generative engine optimization platform. Target a worldwide audience or narrow any run to a country, region, province or city — in English, Arabic and Kurdish.";
const URL = "https://maaroofai.com/markets";

export const Route = createFileRoute("/markets")({
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
          "@type": "WebPage",
          name: TITLE,
          description: DESC,
          url: URL,
          inLanguage: ["en", "ar", "ku"],
          about: {
            "@type": "Service",
            name: "Generative Engine Optimization (GEO)",
            serviceType: "AI search visibility optimization",
            provider: {
              "@type": "Organization",
              name: "MAAROOF Ai",
              url: "https://maaroofai.com",
              areaServed: "Worldwide",
            },
            availableLanguage: ["en", "ar", "ku"],
            audience: { "@type": "Audience", audienceType: "Brands, agencies and businesses worldwide" },
          },
        }),
      },
    ],
  }),
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <MarketsPage />
      </AuthProvider>
    </I18nProvider>
  ),
});

const LEVELS = [
  {
    en: ["Worldwide", "No place assumed. Recommendations target a global audience across all nine answer engines."],
    ar: ["عالمي", "لا نفترض أي مكان. التوصيات تستهدف جمهوراً عالمياً عبر المحركات التسعة."],
    ku: ["جیهانی", "هیچ شوێنێک دانانرێت. ڕاسپاردەکان ئامانجی بینەری جیهانین بە نۆ بزوێنەر."],
  },
  {
    en: ["Country", "Pick any country in the world; language, currency and local phrasing follow it."],
    ar: ["دولة", "اختر أي دولة في العالم؛ اللغة والعملة والصياغة المحلية تتبعها."],
    ku: ["وڵات", "هەر وڵاتێک هەڵبژێرە؛ زمان و دراو و شێوازی ناوخۆیی دوای دەکەون."],
  },
  {
    en: ["Region", "Multi-country regions such as the Gulf, MENA, Europe or North America."],
    ar: ["إقليم", "أقاليم متعددة الدول مثل الخليج، الشرق الأوسط، أوروبا أو أمريكا الشمالية."],
    ku: ["هەرێم", "هەرێمی فرە وڵات وەک کەنداو، ڕۆژهەڵاتی ناوەڕاست، ئەوروپا یان ئەمریکای باکوور."],
  },
  {
    en: ["Province / city", "Local intent: one governorate, province or city for near-me style answers."],
    ar: ["محافظة / مدينة", "نية محلية: محافظة أو ولاية أو مدينة واحدة لأسئلة «قريب مني»."],
    ku: ["پارێزگا / شار", "مەبەستی ناوخۆیی: یەک پارێزگا یان شار بۆ پرسیارەکانی «لە نزیکم»."],
  },
  {
    en: ["Automatic", "We infer the market from the visitor's connection or location, and show it before every run."],
    ar: ["تلقائي", "نستنتج السوق من اتصال الزائر أو موقعه، ونعرضه قبل كل جلسة."],
    ku: ["خۆکار", "بازاڕ لە پەیوەندی یان شوێنی سەردانکەر دەردەهێنین و پێش هەر جلسەیەک پیشان دەدەین."],
  },
] as const;

const COPY = {
  en: {
    h1: "Supported markets",
    intro:
      "MAAROOF Ai is global by default. Every tool works for a worldwide audience, and any run can be narrowed to the exact market you sell in.",
    levelsH: "Five levels of targeting",
    langH: "Languages",
    lang: "Full interface and output in English, Arabic and Kurdish — including right-to-left layouts and local phrasing.",
    noteH: "Where we started",
    note: "The platform began as GEO-Iraq and still has deep coverage of Iraq, the Gulf and the wider MENA region. That is now one supported market among many, not a limit.",
  },
  ar: {
    h1: "الأسواق المدعومة",
    intro:
      "MAAROOF Ai عالمي بالافتراض. كل الأدوات تعمل لجمهور عالمي، ويمكن تضييق أي جلسة إلى السوق الذي تبيع فيه بالضبط.",
    levelsH: "خمسة مستويات للاستهداف",
    langH: "اللغات",
    lang: "واجهة ومخرجات كاملة بالعربية والإنجليزية والكردية — بما في ذلك اتجاه الكتابة والصياغة المحلية.",
    noteH: "من أين بدأنا",
    note: "بدأت المنصة باسم GEO-Iraq ولا تزال تغطيتها للعراق والخليج والشرق الأوسط عميقة. هذا الآن سوق مدعوم من بين أسواق كثيرة، وليس حدّاً.",
  },
  ku: {
    h1: "بازاڕەکانی پشتگیریکراو",
    intro:
      "MAAROOF Ai بە بنەڕەت جیهانییە. هەموو ئامرازەکان بۆ بینەری جیهانی کاردەکەن، و هەر جلسەیەک دەکرێت تەنگ بکرێتەوە بۆ ئەو بازاڕەی تێیدا دەفرۆشی.",
    levelsH: "پێنج ئاستی ئامانجگرتن",
    langH: "زمانەکان",
    lang: "ڕووکار و ئەنجام بە تەواوی بە کوردی و عەرەبی و ئینگلیزی — لەگەڵ ئاراستەی نووسین و شێوازی ناوخۆیی.",
    noteH: "لە کوێ دەستماپێکرد",
    note: "پلاتفۆرم بە ناوی GEO-Iraq دەستیپێکرد و هێشتا داپۆشینی قووڵی عێراق و کەنداو و ڕۆژهەڵاتی ناوەڕاستی هەیە. ئەمە ئێستا یەک بازاڕی پشتگیریکراوە لە نێو زۆردا، نەک سنوور.",
  },
} as const;

function MarketsPage() {
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
          <h2 className="text-lg font-semibold">{c.levelsH}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {LEVELS.map((lv) => (
              <li key={lv.en[0]} className="rounded-xl border border-border/60 bg-card/50 p-3">
                <div className="text-sm font-semibold">{lv[l][0]}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">{lv[l][1]}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{c.langH}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{c.lang}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{c.noteH}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{c.note}</p>
        </section>
      </main>
    </div>
  );
}
