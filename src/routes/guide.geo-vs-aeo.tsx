import { createFileRoute, Link } from "@tanstack/react-router";
import { BlurText } from "@/components/motion/BlurText";
import { SiteHeader } from "@/components/SiteHeader";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";

export const Route = createFileRoute("/guide/geo-vs-aeo")({
  head: () => ({
    meta: [
      { title: "GEO vs AEO — Generative vs Answer Engine Optimization" },
      {
        name: "description",
        content:
          "Compare GEO and AEO: what each optimizes, which engines cite you, and how MAAROOF Ai bridges both to win citations across the AI ecosystem.",
      },
      { property: "og:title", content: "GEO vs AEO — Generative vs Answer Engine Optimization" },
      {
        property: "og:description",
        content:
          "Side-by-side comparison of GEO and AEO: what each optimizes and how to win citations across AI engines.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://geoiraq.com/guide/geo-vs-aeo" },
    ],
    links: [{ rel: "canonical", href: "https://geoiraq.com/guide/geo-vs-aeo" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "GEO vs AEO — Generative vs Answer Engine Optimization Explained",
          author: { "@type": "Organization", name: "MAAROOF Ai" },
          publisher: { "@type": "Organization", name: "MAAROOF Ai" },
          mainEntityOfPage: "https://geoiraq.com/guide/geo-vs-aeo",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is Answer Engine Optimization and Generative Engine Optimization the same?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "No. AEO focuses on producing direct answers for search features like Google's featured snippets and voice assistants. GEO optimizes content to be cited inside generative answers from ChatGPT, Gemini, Claude, Perplexity, Copilot and other LLM-powered engines.",
              },
            },
            {
              "@type": "Question",
              name: "What is Generative Engine Optimization (GEO)?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "GEO is the practice of structuring content, schema, evidence and authority so that AI engines cite your brand inside their generated answers — not just rank you on a results page.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <Page />
      </AuthProvider>
    </I18nProvider>
  ),
});

function Page() {
  return (
    <div className="min-h-screen text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 prose prose-invert">
        <BlurText as="h1" text="GEO vs AEO — what's the difference?" delay={70} stepDuration={0.28} center={false} className="text-3xl font-bold mb-4" />
        <p className="text-muted-foreground mb-8">
          Generative Engine Optimization (GEO) and Answer Engine Optimization (AEO) sound alike,
          but they optimize for different surfaces. This guide breaks down what each one targets,
          where they overlap, and how MAAROOF Ai bridges both.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-3">What is AEO?</h2>
        <p>
          AEO optimizes for direct-answer surfaces: Google featured snippets, People Also Ask,
          voice assistants (Alexa, Siri, Google Assistant). It rewards concise Q&amp;A formats,
          FAQ schema, and clear definitions placed near the top of a page.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-3">What is GEO?</h2>
        <p>
          GEO optimizes for citations inside generative answers from ChatGPT, Gemini, Claude,
          Perplexity, Copilot, Grok, Mistral, DeepSeek and Kimi. Engines pick sources based on
          authority, structured evidence, schema, and freshness — not just keyword match.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-3">Side-by-side</h2>
        <table className="w-full border border-border text-sm my-4">
          <thead>
            <tr className="bg-muted">
              <th className="border border-border p-2 text-left">Dimension</th>
              <th className="border border-border p-2 text-left">AEO</th>
              <th className="border border-border p-2 text-left">GEO</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="border border-border p-2">Primary surface</td><td className="border border-border p-2">Search snippets, voice</td><td className="border border-border p-2">LLM-generated answers</td></tr>
            <tr><td className="border border-border p-2">Target engines</td><td className="border border-border p-2">Google, Bing, Alexa</td><td className="border border-border p-2">ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek, Kimi</td></tr>
            <tr><td className="border border-border p-2">Win condition</td><td className="border border-border p-2">Being the answer</td><td className="border border-border p-2">Being cited as a source</td></tr>
            <tr><td className="border border-border p-2">Key levers</td><td className="border border-border p-2">FAQ schema, concise answers</td><td className="border border-border p-2">Evidence, authority, schema, freshness, multi-language</td></tr>
          </tbody>
        </table>

        <h2 className="text-2xl font-semibold mt-8 mb-3">How MAAROOF Ai bridges both</h2>
        <p>
          MAAROOF Ai measures your brand's recall across 9 AI engines, audits your on-site signals
          (schema, content depth, citations), and generates AEO-friendly Q&amp;A blocks alongside
          GEO-optimized articles in EN, AR and KU.
        </p>

        <p className="mt-8">
          <Link to="/pricing" className="text-primary underline">See pricing</Link> ·{" "}
          <Link to="/guide" className="text-primary underline">Back to guide</Link>
        </p>
      </main>
    </div>
  );
}
