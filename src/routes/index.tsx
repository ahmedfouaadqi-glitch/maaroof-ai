import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { Sandbox } from "@/components/Sandbox";
import { PostSuggester } from "@/components/PostSuggester";

import { SubscribeModal } from "@/components/SubscribeModal";
import {
  ArrowRight, Sparkles, Globe2, ShieldCheck, Zap, Phone, Bot, Wrench,
  Search, Lightbulb, PenSquare, Megaphone, LineChart, Coins,
} from "lucide-react";
import { TOOL_CATALOG, type ToolKey } from "@/lib/tool-catalog";
import { EnginesOrbit } from "@/components/EnginesOrbit";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GEO-Iraq · Become the Source AI Trusts" },
      { name: "description", content: "Score, optimize and publish content so ChatGPT, Gemini and Claude cite your brand. Built for Iraq, in EN, AR, KU." },
      { property: "og:title", content: "GEO-Iraq · Become the Source AI Trusts" },
      { property: "og:description", content: "Score, optimize and publish content so ChatGPT, Gemini and Claude cite your brand. Built for Iraq, in EN, AR, KU." },
      { property: "og:url", content: "https://geoiraq.com/" },
    ],
    links: [{ rel: "canonical", href: "https://geoiraq.com/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "GEO-Iraq",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://geoiraq.com/",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description: "Generative Engine Optimization toolkit for Iraq — analyze, score, generate and publish content optimized for AI search engines.",
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

const ENGINES = [
  { name: "ChatGPT",    grad: "from-emerald-400/30 to-emerald-500/10" },
  { name: "Gemini",     grad: "from-blue-400/30 to-violet-500/10" },
  { name: "Claude",     grad: "from-orange-400/30 to-amber-500/10" },
  { name: "Perplexity", grad: "from-cyan-400/30 to-teal-500/10" },
  { name: "Copilot",    grad: "from-indigo-400/30 to-sky-500/10" },
  { name: "Grok",       grad: "from-zinc-300/30 to-zinc-500/10" },
  { name: "Mistral",    grad: "from-fuchsia-400/30 to-rose-500/10" },
  { name: "DeepSeek",   grad: "from-sky-400/30 to-blue-600/10" },
];

function Page() {
  const { t, lang } = useI18n();
  const L = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  const [subOpen, setSubOpen] = useState(false);

  const howtoKey = (k: ToolKey) => {
    const map: Record<ToolKey, string> = {
      analyze: "guide_how_analyze",
      suggest: "guide_how_suggest",
      compare: "guide_how_compare",
      feasibility: "guide_how_feasibility",
      bizdev: "guide_how_bizdev",
      research: "guide_how_research",
      brand_boost: "guide_how_brand_boost",
      company_email: "guide_how_company_email",
      applied_ranking: "guide_how_company_email",
      "agent.command": "guide_how_agent_command",
      "agent.run_targets": "guide_how_agent_targets",
      "agent.visibility": "guide_how_agent_visibility",
    };
    return map[k];
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Agent promo banner */}
      <div className="border-b border-accent/30 bg-gradient-to-r from-accent/15 via-primary/10 to-accent/15">
        <Link
          to="/pricing"
          className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-center text-xs hover:bg-accent/10 md:text-sm"
        >
          <Bot className="size-4 text-accent" />
          <span className="font-semibold text-accent">{t("agent_banner_title")}</span>
          <span className="text-muted-foreground">— {t("agent_banner_desc")}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline">
            {t("agent_banner_cta")} <ArrowRight className="size-3" />
          </span>
        </Link>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute inset-x-0 -top-32 -z-0 mx-auto h-[600px] max-w-5xl rounded-full bg-primary/15 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute end-1/4 top-40 -z-0 size-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 md:px-6 md:pb-24 md:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="size-3.5 animate-pulse" /> {t("hero_badge")}
            </span>

            <div className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent/90">
              {t("hero_kicker")}
            </div>

            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] md:text-6xl lg:text-7xl">
              <span className="text-gradient">{t("hero_title")}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
              {t("hero_sub")}
            </p>

            {/* Engine logos strip */}
            <div className="mx-auto mt-7 flex max-w-2xl flex-wrap items-center justify-center gap-2">
              {ENGINES.map((e) => (
                <span
                  key={e.name}
                  className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-gradient-to-br ${e.grad} px-3 py-1.5 text-xs font-semibold text-foreground/90 backdrop-blur transition hover:scale-105 hover:border-primary/40`}
                >
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                  {e.name}
                </span>
              ))}
            </div>

            {/* Quick chips */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/40 px-2.5 py-1"><Sparkles className="size-3 text-primary" />{t("hero_chip_engines")}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/40 px-2.5 py-1"><Globe2 className="size-3 text-primary" />{t("hero_chip_langs")}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/40 px-2.5 py-1"><Bot className="size-3 text-accent" />{t("hero_chip_agent")}</span>
            </div>

            {/* CTAs */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#sandbox"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:scale-[1.03]"
              >
                {t("hero_cta_primary")} <ArrowRight className="size-4" />
              </a>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/50 px-6 py-3 text-sm font-semibold text-foreground/90 backdrop-blur transition hover:border-primary/60 hover:bg-card/80"
              >
                {t("hero_cta_secondary")}
              </a>
            </div>
          </div>

          <div id="sandbox" className="mx-auto mt-14 max-w-3xl">
            <Sandbox />
          </div>

          <div id="studio" className="mx-auto mt-8 max-w-3xl">
            <PostSuggester />
          </div>

        </div>
      </section>

      {/* AI ENGINES */}
      <section id="engines" className="relative border-t border-border/60 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold text-accent">
              <span className="grid size-4 place-items-center rounded-full bg-accent/20 font-mono text-[10px]">8</span>
              AI Engines
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">{t("engines_title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("engines_sub")}</p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {ENGINES.map((e) => (
              <div key={e.name} className={`group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${e.grad} p-4 text-center transition hover:scale-[1.03] hover:border-primary/40`}>
                <div className="mx-auto mb-2 grid size-10 place-items-center rounded-xl bg-background/60 backdrop-blur">
                  <span className="font-mono text-xs font-bold text-foreground/80">{e.name.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="font-display text-sm font-semibold">{e.name}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <FeedStep n="1" icon={<Search className="size-4" />} text={t("engines_how_1")} />
            <FeedStep n="2" icon={<LineChart className="size-4" />} text={t("engines_how_2")} />
            <FeedStep n="3" icon={<Bot className="size-4" />} text={t("engines_how_3")} />
          </div>
        </div>
      </section>

      {/* WHY GEO / WHY NOW */}
      <section id="features" className="relative border-t border-border/60 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">
              <span className="text-gradient">{t("why_now_title")}</span>
            </h2>
            <p className="mt-3 text-muted-foreground">{t("why_now_sub")}</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <Feature icon={<Zap />}         title={t("why_now_1_t")} desc={t("why_now_1_d")} />
            <Feature icon={<Globe2 />}      title={t("why_now_2_t")} desc={t("why_now_2_d")} />
            <Feature icon={<Bot />}         title={t("why_now_3_t")} desc={t("why_now_3_d")} />
            <Feature icon={<ShieldCheck />} title={t("why_now_4_t")} desc={t("why_now_4_d")} />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (with consumption) */}
      <section id="how" className="relative border-t border-border/60 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">{t("how_title")}</h2>
            <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs text-primary">
              <Coins className="size-3.5" />
              <span className="font-semibold">{t("home_consume_title")}</span>
              <span className="text-primary/80">·</span>
              <span className="font-mono">{t("home_consume_legend")}</span>
            </div>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <Step n="01" cost="1×" title={t("how_1_t")} desc={t("how_1_d")} />
            <Step n="02" cost="1-2×" title={t("how_2_t")} desc={t("how_2_d")} />
            <Step n="03" cost="1-3×" title={t("how_3_t")} desc={t("how_3_d")} />
            <Step n="04" cost="auto" title={t("how_4_t")} desc={t("how_4_d")} />
          </div>
        </div>
      </section>

      {/* HOW TOOLS ARE LINKED */}
      <section id="link-tools" className="relative border-t border-border/60 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">{t("link_tools_title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("link_tools_sub")}</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <FlowCard icon={<Search />}     title={t("link_step_1_t")} desc={t("link_step_1_d")} />
            <FlowCard icon={<Lightbulb />}  title={t("link_step_2_t")} desc={t("link_step_2_d")} />
            <FlowCard icon={<PenSquare />}  title={t("link_step_3_t")} desc={t("link_step_3_d")} />
            <FlowCard icon={<Megaphone />}  title={t("link_step_4_t")} desc={t("link_step_4_d")} />
            <FlowCard icon={<LineChart />}  title={t("link_step_5_t")} desc={t("link_step_5_d")} />
          </div>
        </div>
      </section>

      {/* ENGINES ORBIT — replaces the previous tools catalog grid */}
      <EnginesOrbit />

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

function Step({ n, cost, title, desc }: { n: string; cost?: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-6">
      <div className="flex items-center justify-between">
        <div className="font-mono text-xs text-primary">{n}</div>
        {cost && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
            {cost}
          </span>
        )}
      </div>
      <h3 className="mt-2 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function FeedStep({ n, icon, text }: { n: string; icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/40 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
        {icon}
      </span>
      <div>
        <div className="font-mono text-xs text-primary">{n}</div>
        <p className="mt-1 text-sm text-foreground/85 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function FlowCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="relative rounded-2xl border border-border bg-card/60 p-5 transition hover:border-primary/40 hover:shadow-[var(--shadow-elevated)]">
      <div className="mb-3 inline-grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
        {icon}
      </div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}
