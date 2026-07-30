import { createFileRoute, notFound } from "@tanstack/react-router";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";

type Page = {
  slug: string;
  title_ar: string | null; title_en: string | null; title_ku: string | null;
  body_ar: string | null; body_en: string | null; body_ku: string | null;
  meta_description_ar: string | null; meta_description_en: string | null; meta_description_ku: string | null;
  published: boolean;
};

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("custom_pages")
      .select("slug,title_ar,title_en,title_ku,body_ar,body_en,body_ku,meta_description_ar,meta_description_en,meta_description_ku,published")
      .eq("slug", params.slug)
      .eq("published", true)
      .maybeSingle();
    if (!data) throw notFound();
    return data as Page;
  },
  head: ({ params, loaderData }) => {
    const p = loaderData as Page | undefined;
    const title = p ? (p.title_en || p.title_ar || p.title_ku || p.slug) : params.slug;
    const desc = p ? (p.meta_description_en || p.meta_description_ar || p.meta_description_ku || "") : "";
    const url = `https://geoiraq.com/p/${params.slug}`;
    const meta: Array<{ title?: string; name?: string; property?: string; content?: string }> = [
      { title: `${title} · MAAROOF Ai` },
      { property: "og:title", content: `${title} · MAAROOF Ai` },
      { property: "og:url", content: url },
      { property: "og:type", content: "article" },
    ];
    if (desc) {
      meta.push({ name: "description", content: desc });
      meta.push({ property: "og:description", content: desc });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: `${title}`,
            ...(desc ? { description: desc } : {}),
            inLanguage: ["ar", "en", "ku"],
            mainEntityOfPage: url,
            url,
            author: { "@type": "Organization", name: "MAAROOF Ai" },
            publisher: {
              "@type": "Organization",
              name: "MAAROOF Ai",
              logo: { "@type": "ImageObject", url: "https://geoiraq.com/icon-512.png" },
            },
          }),
        },
      ],
    };
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <CustomPage />
      </AuthProvider>
    </I18nProvider>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">404</div>
  ),
  errorComponent: () => (
    <div className="min-h-screen grid place-items-center text-sm text-destructive">Error</div>
  ),
});

function CustomPage() {
  const page = Route.useLoaderData() as Page;
  const { lang } = useI18n();
  const L = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  const title = (page as any)[`title_${L}`] || page.title_en || page.title_ar || page.slug;
  const body = (page as any)[`body_${L}`] || page.body_en || page.body_ar || "";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-4xl font-bold text-gradient">{title}</h1>
        <article className="prose prose-invert mt-6 max-w-none whitespace-pre-wrap text-foreground/85">
          {body}
        </article>
      </main>
    </div>
  );
}
