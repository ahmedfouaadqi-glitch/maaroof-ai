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
        "@type": "SoftwareApplication",
        name: "MAAROOF Ai",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://maaroofai.com/",
        description: "Generative Engine Optimization toolkit — analyze, score, generate and publish content optimized for 10 AI search engines.",
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
