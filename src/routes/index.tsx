import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { Sandbox } from "@/components/Sandbox";
import { PostSuggester } from "@/components/PostSuggester";
import { SubscribeModal } from "@/components/SubscribeModal";
import { ArrowRight, Sparkles, Globe2, ShieldCheck, Zap, Phone } from "lucide-react";

export const Route = createFileRoute("/")({
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <Page />
      </AuthProvider>
    </I18nProvider>
  ),
});

function Page() {
  const { t } = useI18n();
  const [subOpen, setSubOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute inset-x-0 -top-32 -z-0 mx-auto h-[500px] max-w-5xl rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 md:px-6 md:pb-24 md:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" /> {t("hero_badge")}
            </span>
            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] md:text-6xl lg:text-7xl">
              <span className="text-gradient">{t("hero_title")}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
              {t("hero_sub")}
            </p>
          </div>

          <div id="sandbox" className="mx-auto mt-12 max-w-3xl">
            <Sandbox />
          </div>

          <div id="studio" className="mx-auto mt-8 max-w-3xl">
            <PostSuggester />
          </div>
        </div>
      </section>

      {/* WHY GEO */}
      <section id="features" className="relative border-t border-border/60 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">{t("why_title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("why_sub")}</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <Feature icon={<Zap />} title={t("why_1_t")} desc={t("why_1_d")} />
            <Feature icon={<Globe2 />} title={t("why_2_t")} desc={t("why_2_d")} />
            <Feature icon={<ShieldCheck />} title={t("why_3_t")} desc={t("why_3_d")} />
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="relative border-t border-border/60 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">{t("how_title")}</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <Step n="01" title={t("how_1_t")} desc={t("how_1_d")} />
            <Step n="02" title={t("how_2_t")} desc={t("how_2_d")} />
            <Step n="03" title={t("how_3_t")} desc={t("how_3_d")} />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="relative border-t border-border/60 py-24">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-card to-background p-10 text-center shadow-[var(--shadow-elevated)] md:p-16">
            <div className="absolute -inset-1 -z-10 bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 opacity-60 blur-2xl" />
            <h2 className="font-display text-3xl font-bold md:text-5xl">
              <span className="text-gradient">{t("cta_title")}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{t("cta_sub")}</p>
            <button
              onClick={() => setSubOpen(true)}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-7 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:scale-[1.02]"
            >
              {t("cta_button")} <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </section>

      <SubscribeModal open={subOpen} onClose={() => setSubOpen(false)} />

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        <div>{t("footer")}</div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <a href="tel:+9647733570130" className="inline-flex items-center gap-1.5 text-foreground/80 hover:text-primary">
            <Phone className="size-3.5" /> <span dir="ltr" style={{ unicodeBidi: "isolate" }}>+964 773 357 0130</span>
          </a>
          <Link to="/privacy" className="hover:text-primary">{t("footer_privacy")}</Link>
          <Link to="/terms" className="hover:text-primary">{t("footer_terms")}</Link>
          <Link to="/pricing" className="hover:text-primary">{t("footer_pricing")}</Link>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card/60 p-6 backdrop-blur transition hover:border-primary/40">
      <div className="mb-4 inline-grid size-11 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
        {icon}
      </div>
      <h3 className="mb-2 font-display text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-6">
      <div className="font-mono text-xs text-primary">{n}</div>
      <h3 className="mt-2 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
