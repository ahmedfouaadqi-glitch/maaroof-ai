import { createFileRoute, Link } from "@tanstack/react-router";

import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";

import { ArrowRight, Sparkles, Globe2, Bot, Phone } from "lucide-react";
import { EnginesOrbit } from "@/components/EnginesOrbit";
import { ENGINES } from "@/components/engine-logos";
import { useCountry } from "@/lib/use-country";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MAAROOF Ai — GEO - SEO - AEO , Cited by ChatGPT & Gemini" },
      { name: "description", content: "Score, optimize and publish content so 9 AI engines cite your brand in English, Arabic and Kurdish." },
      { property: "og:title", content: "MAAROOF Ai — Get cited by ChatGPT, Gemini & Perplexity" },
      { property: "og:description", content: "Analyze, score and publish GEO-ready content so AI answer engines cite your brand across MENA." },
      { property: "og:url", content: "https://geoiraq.com/" },
    ],
    links: [{ rel: "canonical", href: "https://geoiraq.com/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "MAAROOF Ai",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://geoiraq.com/",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description: "Generative Engine Optimization toolkit — analyze, score, generate and publish content optimized for 9 AI search engines.",
      }),
    }],
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
  const { t, lang } = useI18n();
  const { info: country } = useCountry();
  const welcomeName = country
    ? lang === "ar" ? country.name_ar : lang === "ku" ? country.name_ku : country.name_en
    : "";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        {/* Agent promo banner */}
        <div className="border-b border-accent/30 bg-gradient-to-r from-accent/15 via-primary/10 to-accent/15">
          <Link to="/pricing" className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-center text-xs hover:bg-accent/10 md:text-sm">
            <Bot className="size-4 text-accent" />
            <span className="font-semibold text-accent">{t("agent_banner_title")}</span>
            <span className="text-muted-foreground">— {t("agent_banner_desc")}</span>
            <span className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline">
              {t("agent_banner_cta")} <ArrowRight className="size-3" />
            </span>
          </Link>
        </div>

        {/* HERO — 9 engines, concise */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-40" />
          <div className="absolute inset-x-0 -top-32 -z-0 mx-auto h-[600px] max-w-5xl rounded-full bg-primary/15 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
          <div className="absolute end-1/4 top-40 -z-0 size-72 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-14 md:px-6 md:pb-16 md:pt-20">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
                <Sparkles className="size-3.5 animate-pulse" /> {t("hero_badge")}
              </span>

              {country && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs text-foreground/80">
                  <span className="text-base leading-none">{country.flag}</span>
                  <span>
                    {lang === "ar" ? `مرحباً بزوارنا من ${welcomeName}`
                      : lang === "ku" ? `بەخێرهاتنی میوانانمان لە ${welcomeName}`
                      : `Welcome, visitors from ${welcomeName}`}
                  </span>
                </div>
              )}

              <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] md:text-6xl lg:text-7xl">
                <span className="text-gradient">{t("hero_title")}</span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
                {t("hero_sub")}
              </p>

              {/* 9 engine chips */}
              <div className="mx-auto mt-7 flex max-w-3xl flex-wrap items-center justify-center gap-2.5">
                {ENGINES.map((e) => (
                  <span key={e.name} className={`inline-flex items-center gap-2 rounded-full border border-border bg-gradient-to-br ${e.tint} px-3 py-1.5 text-xs font-semibold text-foreground/90 backdrop-blur transition hover:scale-105 hover:border-primary/50`}>
                    <e.Logo size={14} />
                    {e.name}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/40 px-2.5 py-1"><Sparkles className="size-3 text-primary" />{t("hero_chip_engines")}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/40 px-2.5 py-1"><Globe2 className="size-3 text-primary" />{t("hero_chip_langs")}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/40 px-2.5 py-1"><Bot className="size-3 text-accent" />{t("hero_chip_agent")}</span>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:scale-[1.03]">
                  {t("hero_cta_primary")} <ArrowRight className="size-4" />
                </Link>
                <Link to="/guide" className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/50 px-6 py-3 text-sm font-semibold text-foreground/90 backdrop-blur transition hover:border-primary/60 hover:bg-card/80">
                  {t("hero_cta_secondary")}
                </Link>
              </div>
            </div>

            <div className="mt-10">
              <EnginesOrbit />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="cta" className="relative border-t border-border/60 py-20">
          <div className="mx-auto max-w-4xl px-4 md:px-6">
            <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-card to-background p-10 text-center shadow-[var(--shadow-elevated)] md:p-14">
              <div className="absolute -inset-1 -z-10 bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 opacity-60 blur-2xl" />
              <h2 className="font-display text-3xl font-bold md:text-5xl">
                <span className="text-gradient">{t("cta_title")}</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{t("cta_sub")}</p>
              <Link to="/pricing" className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-7 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:scale-[1.02]">
                {t("cta_button")} <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        <div>{t("footer")}</div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link to="/contact" className="inline-flex items-center gap-1.5 text-foreground/80 hover:text-primary">
            <Phone className="size-3.5" /> {t("nav_contact")}
          </Link>
          <Link to="/privacy" className="hover:text-primary">{t("footer_privacy")}</Link>
          <Link to="/terms" className="hover:text-primary">{t("footer_terms")}</Link>
          <Link to="/pricing" className="hover:text-primary">{t("footer_pricing")}</Link>
          <Link to="/guide" className="hover:text-primary">{t("guide_title")}</Link>
        </div>
      </footer>
    </div>
  );
}
