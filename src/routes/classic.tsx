import { ClassicLanding } from "@/components/landing/ClassicLanding";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";


export const Route = createFileRoute("/classic")({
  beforeLoad: () => { throw redirect({ to: "/workspace", statusCode: 301 }); },
  head: () => ({
    meta: [
      { title: "Classic Home · MAAROOF Ai GEO Platform" },
      { name: "description", content: "Analyze your brand visibility across AI answer engines, improve content readiness, and explore GEO tools in Arabic, Kurdish and English." },
      { property: "og:title", content: "Classic Home · MAAROOF Ai" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Explore tools to analyze brand visibility, improve content readiness and build a consistent machine-readable brand identity." },
      { property: "og:url", content: "https://maaroofai.com/classic" },
    ],
    links: [{ rel: "canonical", href: "https://maaroofai.com/classic" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "MAAROOF Ai",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://maaroofai.com/classic",
        description: "Generative Engine Optimization toolkit — analyze, score, generate and publish content optimized for 10 AI search engines.",
      }),
    }],
  }),
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <ClassicLanding />
      </AuthProvider>
    </I18nProvider>
  ),
});

