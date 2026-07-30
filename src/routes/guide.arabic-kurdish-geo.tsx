import { createFileRoute, Link } from "@tanstack/react-router";
import { BlurText } from "@/components/motion/BlurText";
import { SiteHeader } from "@/components/SiteHeader";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";

export const Route = createFileRoute("/guide/arabic-kurdish-geo")({
  head: () => ({
    meta: [
      { title: "Arabic & Kurdish GEO — Generative Engine Optimization Guide" },
      {
        name: "description",
        content:
          "How to structure content so ChatGPT, Gemini and Claude cite your brand for Arabic and Kurdish Sorani queries. A practical GEO guide for Iraqi businesses.",
      },
      { property: "og:title", content: "Arabic & Kurdish GEO — Get Cited by AI Engines" },
      {
        property: "og:description",
        content:
          "A practical Generative Engine Optimization guide for the MENA market: schema, language signals, and citation patterns for AR and KU queries.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://geoiraq.com/guide/arabic-kurdish-geo" },
    ],
    links: [{ rel: "canonical", href: "https://geoiraq.com/guide/arabic-kurdish-geo" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Arabic & Kurdish GEO — Generative Engine Optimization Guide",
          author: { "@type": "Organization", name: "MAAROOF Ai" },
          publisher: { "@type": "Organization", name: "MAAROOF Ai" },
          inLanguage: ["en", "ar", "ckb"],
          mainEntityOfPage: "https://geoiraq.com/guide/arabic-kurdish-geo",
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
              name: "What is Generative Engine Optimization (GEO)?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "GEO is the practice of structuring content, schema and citations so generative AI engines such as ChatGPT, Gemini, Claude and Perplexity quote your brand inside their answers.",
              },
            },
            {
              "@type": "Question",
              name: "How is GEO different for Arabic and Kurdish queries?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "AI engines have less training data in Arabic and Kurdish Sorani, so authoritative, well-structured local content with proper lang attributes and bilingual schema gets cited disproportionately often.",
              },
            },
            {
              "@type": "Question",
              name: "Which AI engines should an Iraqi business optimize for?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Prioritize ChatGPT, Gemini, Claude, Perplexity and Copilot. MAAROOF Ai measures citation share across nine engines and recommends per-engine fixes.",
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
        <BlurText as="h1" text="Arabic & Kurdish GEO — getting cited by AI engines" delay={70} stepDuration={0.28} center={false} className="text-3xl font-bold mb-4" />
        <p className="text-muted-foreground">
          A practical Generative Engine Optimization (GEO) guide for Iraqi and MENA businesses
          who want ChatGPT, Gemini, Claude and Perplexity to mention them when users ask
          questions in Arabic or Kurdish Sorani.
        </p>

        <h2>What is Generative Engine Optimization?</h2>
        <p>
          GEO is the discipline of structuring content so that generative AI engines cite your
          brand inside their answers — the AI-era successor to traditional SEO. Where SEO
          targets ranking on a results page, GEO targets being quoted inside the model's reply.
        </p>

        <h2>Why Arabic &amp; Kurdish GEO is a real opportunity</h2>
        <ul>
          <li>Most GEO playbooks are written for English. Competition for AR/KU citations is far lower.</li>
          <li>AI engines have thinner training data in Arabic and Kurdish, so a single authoritative source can dominate citations.</li>
          <li>Local entities (Iraqi cities, ministries, brands) are under-represented in English knowledge bases — your content fills the gap.</li>
        </ul>

        <h2>Practical steps for AR &amp; KU citations</h2>
        <ol>
          <li>Set <code>&lt;html lang=&quot;ar&quot;&gt;</code> or <code>lang=&quot;ckb&quot;</code> on the right pages and provide a bilingual abstract.</li>
          <li>Add Organization, LocalBusiness and FAQPage schema, with names in Arabic and Latin script.</li>
          <li>Publish original numbers, prices and dates in the local language — generative engines prefer fresh, verifiable facts.</li>
          <li>Use Q&amp;A headings that mirror how users actually ask (e.g. <em>"شنو هي تحسين محركات الذكاء الاصطناعي؟"</em>).</li>
          <li>Track citation share per engine and per language with the MAAROOF Ai visibility tools.</li>
        </ol>

        <p>
          MAAROOF Ai automates these steps for you across nine engines. See the{" "}
          <Link to="/guide" className="text-primary underline">tool guide</Link>{" "}
          or compare with our{" "}
          <Link to="/guide/geo-vs-aeo" className="text-primary underline">GEO vs AEO explainer</Link>.
        </p>
      </main>
    </div>
  );
}
