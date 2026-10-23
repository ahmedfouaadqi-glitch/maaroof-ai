import { ClassicLanding } from "@/components/landing/ClassicLanding";
import { NewLanding } from "@/components/landing/NewLanding";
import { useInterfacePolicy } from "@/lib/use-interface-policy";
import { createFileRoute } from "@tanstack/react-router";

import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MAAROOF Ai — AI Visibility & Generative Engine Optimization" },
      { name: "description", content: "Analyze your brand visibility across AI answer engines, improve content readiness, and explore GEO tools in Arabic, Kurdish and English." },
      { property: "og:title", content: "MAAROOF Ai — AI Visibility & GEO Tools" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Explore tools to analyze brand visibility, improve content readiness and build a consistent machine-readable brand identity." },
      { property: "og:url", content: "https://maaroofai.com/" },
    ],
    links: [{ rel: "canonical", href: "https://maaroofai.com/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "SoftwareApplication",
            name: "MAAROOF Ai",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            url: "https://maaroofai.com/",
            description: "Generative Engine Optimization toolkit — analyze, score, generate and publish content optimized for 10 AI search engines.",
            inLanguage: ["ar", "en", "ku"],
          },
          {
            "@type": "Organization",
            "@id": "https://maaroofai.com/#org",
            name: "MAAROOF Ai",
            alternateName: "معروف",
            url: "https://maaroofai.com/",
            areaServed: "Worldwide",
            knowsLanguage: ["ar", "en", "ku"],
          },
          { "@type": "WebSite", name: "MAAROOF Ai", url: "https://maaroofai.com/", publisher: { "@id": "https://maaroofai.com/#org" } },
          {
            "@type": "FAQPage",
            mainEntity: [
              ["What is MAAROOF Ai?", "MAAROOF Ai asks 10 AI models (ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek, Kimi, Qwen) about your brand and measures your presence across 5 axes: SEO, AEO, GEO, SGE and GSEO, in 3 languages."],
              ["Are the answers real?", "Yes. Every result comes from a real query with a clear status and reason. Nothing is fabricated."],
              ["When is my balance charged?", "Only after success, and the cost is shown before running."],
              ["Do I need a website?", "No. MAAROOF Ai also works with creators and individuals without a site or accounts."],
              ["Which countries does MAAROOF Ai serve?", "MAAROOF Ai serves brands in any country and market worldwide."],
              ["Which languages are supported?", "Arabic, English and Kurdish."],
            ].map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
          },
        ],
      }),
    }],
  }),
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <HomeSwitch />
      </AuthProvider>
    </I18nProvider>
  ),
});

function HomeSwitch() {
  const { policy } = useInterfacePolicy();
  return policy.landing === "classic" ? <ClassicLanding /> : <NewLanding policy={policy} />;
}
