import { createFileRoute, Link } from "@tanstack/react-router";
import { BlurText } from "@/components/motion/BlurText";
import { SiteHeader } from "@/components/SiteHeader";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";

const TITLE = "What is GEO? Generative Engine Optimization Explained";
const DESC =
  "GEO (Generative Engine Optimization) is how brands get cited inside AI answers from ChatGPT, Gemini, Perplexity and Copilot. Here is how it works and how it differs from SEO.";
const URL = "https://geoiraq.com/guide/what-is-geo";

export const Route = createFileRoute("/guide/what-is-geo")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      {
        property: "og:description",
        content:
          "A plain-English definition of Generative Engine Optimization: what it is, why it matters, and how it differs from traditional SEO.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
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
          mainEntityOfPage: URL,
          url: URL,
          author: { "@type": "Organization", name: "MAAROOF Ai" },
          publisher: {
            "@type": "Organization",
            name: "MAAROOF Ai",
            logo: { "@type": "ImageObject", url: "https://geoiraq.com/icon-512.png" },
          },
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
              name: "What is GEO?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "GEO stands for Generative Engine Optimization: structuring content, evidence and schema so AI engines such as ChatGPT, Gemini, Perplexity and Copilot cite your brand inside their generated answers.",
              },
            },
            {
              "@type": "Question",
              name: "How is GEO different from SEO?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "SEO competes for a ranked position on a results page. GEO competes to be the source an AI model quotes in a single synthesized answer, which rewards clear claims, verifiable data, structured markup and topical authority over keyword density.",
              },
            },
            {
              "@type": "Question",
              name: "Does GEO replace SEO?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "No. AI engines still crawl and retrieve from the indexed web, so technical SEO remains the foundation. GEO adds a citation layer on top of it.",
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
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <BlurText as="h1" text={TITLE} delay={70} stepDuration={0.28} center={false} segmentClassName="text-gradient" className="font-display text-3xl font-bold" />
        <p className="mt-3 text-sm text-muted-foreground">{DESC}</p>

        <Section title="The short definition">
          <p>
            GEO — Generative Engine Optimization — is the practice of preparing your content so that
            generative AI engines quote it. Instead of chasing a blue link on page one, you are
            competing to be the source a model names when it writes an answer for a user.
          </p>
        </Section>

        <Section title="Why it matters now">
          <p>
            A growing share of buying research never reaches a results page. People ask ChatGPT,
            Gemini, Perplexity or Copilot and act on the synthesized answer. If your brand is not in
            that answer, you are invisible for that query, no matter how well you rank.
          </p>
        </Section>

        <Section title="How GEO differs from traditional SEO">
          <ul className="list-disc space-y-2 ps-5">
            <li>
              <strong>Unit of victory.</strong> SEO wins a ranked position; GEO wins a citation
              inside one generated answer.
            </li>
            <li>
              <strong>What gets rewarded.</strong> Explicit claims, numbers, dates, named entities
              and sources — content a model can safely restate.
            </li>
            <li>
              <strong>Structure.</strong> Question-shaped headings, short answer-first paragraphs
              and JSON-LD schema make passages easy to extract.
            </li>
            <li>
              <strong>Authority.</strong> Consistent entity information across your site, profiles
              and third-party mentions raises the odds a model trusts you.
            </li>
            <li>
              <strong>Language.</strong> Coverage in Arabic, Kurdish and English matters where your
              audience actually asks its questions.
            </li>
          </ul>
        </Section>

        <Section title="What a GEO workflow looks like">
          <ol className="list-decimal space-y-2 ps-5">
            <li>Score existing pages for citation-worthiness.</li>
            <li>Rewrite weak passages into answer-first, evidence-backed blocks.</li>
            <li>Add schema so engines can parse entities and facts.</li>
            <li>Publish consistently on the questions your buyers ask.</li>
            <li>Track which engines cite you and where the gaps remain.</li>
          </ol>
        </Section>

        <Section title="Where MAAROOF Ai fits">
          <p>
            MAAROOF Ai runs that loop for you: it analyzes a page, gives it a GEO score, proposes
            concrete rewrites, generates publish-ready content in Arabic, Kurdish and English, and
            monitors which AI engines cite your brand.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/guide/geo-vs-aeo"
              className="rounded-lg border border-border bg-background/60 px-4 py-2 text-sm font-semibold"
            >
              GEO vs AEO →
            </Link>
            <Link
              to="/pricing"
              className="rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              See plans
            </Link>
          </div>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
