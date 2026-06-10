import { createFileRoute, notFound } from "@tanstack/react-router";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Page = {
  slug: string;
  title_ar: string | null; title_en: string | null; title_ku: string | null;
  body_ar: string | null; body_en: string | null; body_ku: string | null;
  meta_description_ar: string | null; meta_description_en: string | null; meta_description_ku: string | null;
  published: boolean;
};

export const Route = createFileRoute("/p/$slug")({
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
  const { slug } = Route.useParams();
  const { lang } = useI18n();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("custom_pages")
        .select("slug,title_ar,title_en,title_ku,body_ar,body_en,body_ku,meta_description_ar,meta_description_en,meta_description_ku,published")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      setPage(data as Page | null);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="grid h-[60vh] place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
    </div>
  );
  if (!page) throw notFound();

  const L = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  const title = page ? ((page as any)[`title_${L}`] || page.title_en || page.title_ar || page.slug) : "";
  const body = page ? ((page as any)[`body_${L}`] || page.body_en || page.body_ar || "") : "";

  useEffect(() => {
    if (!page || !title) return;
    document.title = `${title} · MAAROOF Ai`;
    const desc = (page as any)[`meta_description_${L}`] || page.meta_description_en;
    if (desc) {
      let m = document.querySelector('meta[name="description"]');
      if (!m) { m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); }
      m.setAttribute("content", desc);
    }
  }, [title, L, page]);

  if (!page) throw notFound();

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
