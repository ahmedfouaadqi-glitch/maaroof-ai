import { createFileRoute, Link } from "@tanstack/react-router";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { BookOpen, Wrench, Bot, Globe2, User, Share2 } from "lucide-react";
import { TOOL_CATALOG, type ToolKey } from "@/lib/tool-catalog";
import { HowItWorks } from "@/components/HowItWorks";
import { usePageGuard } from "@/lib/visibility";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "Guide · MAAROOF Ai" },
      { name: "description", content: "How to use every MAAROOF Ai tool and the AI Agent — analyze, suggest, compare, brand boost, applied ranking and more." },
      { property: "og:title", content: "Guide · MAAROOF Ai" },
      { property: "og:description", content: "How to use every MAAROOF Ai tool and the AI Agent." },
      { property: "og:url", content: "https://geoiraq.com/guide" },
    ],
    links: [{ rel: "canonical", href: "https://geoiraq.com/guide" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "MAAROOF Ai Guide",
          description:
            "How to use every MAAROOF Ai tool and the AI Agent — analyze, suggest, compare, brand boost, applied ranking and more.",
          url: "https://geoiraq.com/guide",
          isPartOf: { "@type": "WebSite", name: "MAAROOF Ai", url: "https://geoiraq.com" },
          hasPart: TOOL_CATALOG.filter((td) =>
            ["analyze", "suggest", "compare", "visibility", "brand_boost"].includes(td.key),
          ).map((td) => ({
            "@type": "WebPage",
            name: td.labels.en,
            url: `https://geoiraq.com/tools/${td.key}`,
          })),
        }),
      },
    ],
  }),
  component: () => <I18nProvider><GuidePage /></I18nProvider>,
});

const HOWTO_KEY: Record<ToolKey, string> = {
  analyze: "guide_how_analyze",
  suggest: "guide_how_suggest",
  compare: "guide_how_compare",
  feasibility: "guide_how_feasibility",
  bizdev: "guide_how_bizdev",
  research: "guide_how_research",
  visibility: "guide_how_visibility",
  brand_boost: "guide_how_brand_boost",
  company_email: "guide_how_company_email",
  applied_ranking: "guide_how_applied_ranking",
  geo_strategist: "guide_how_geo_strategist",
  competitor_monitor: "guide_how_competitor_monitor",
  social_analysis: "guide_how_social_analysis",
  what_if: "guide_how_what_if",
  brand_authority: "guide_how_brand_authority",
  geo_rewrite: "guide_how_geo_rewrite",
  maaroof: "guide_how_maaroof",
  translate: "guide_how_translate",
  "agent.command": "guide_how_agent_command",
  "agent.run_targets": "guide_how_agent_targets",
  "agent.visibility": "guide_how_agent_visibility",
  teach_space: "guide_how_teach_space",
};

function GuidePage() {
  const { t, lang } = useI18n();
  const L = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  usePageGuard();


  const tools = TOOL_CATALOG.filter((x) => x.group === "tools");
  const agent = TOOL_CATALOG.filter((x) => x.group === "agent");

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold text-gradient flex items-center gap-2">
          <BookOpen /> {t("guide_title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("guide_intro")}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/guide/what-is-geo" className="rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm font-semibold text-primary hover:underline">
            What is GEO? →
          </Link>
          <Link to="/guide/geo-vs-aeo" className="rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm font-semibold text-primary hover:underline">
            GEO vs AEO →
          </Link>
          <Link to="/guide/arabic-kurdish-geo" className="rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm font-semibold text-primary hover:underline">
            Arabic & Kurdish GEO →
          </Link>
        </div>



        <Section icon={<Bot className="size-5" />} title={t("guide_maaroof_title")}>
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-5">
            <p className="text-sm leading-relaxed text-foreground/85">{t("guide_maaroof_intro")}</p>
            <ol className="mt-4 space-y-1.5 text-sm text-foreground/85">
              {(["guide_maaroof_step1", "guide_maaroof_step2", "guide_maaroof_step3", "guide_maaroof_step4", "guide_maaroof_step5"] as const).map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ol>
            <Link to="/maaroof" search={{ tab: "chat" as const }} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground">
              <Bot className="size-4" /> {t("guide_maaroof_title")}
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {([
              { tab: "tasks", t: "guide_mrf_tasks_t", d: "guide_mrf_tasks_d" },
              { tab: "channels", t: "guide_mrf_channels_t", d: "guide_mrf_channels_d" },
              { tab: "approvals", t: "guide_mrf_approvals_t", d: "guide_mrf_approvals_d" },
              { tab: "knowledge", t: "guide_mrf_knowledge_t", d: "guide_mrf_knowledge_d" },
            ] as const).map((f) => (
              <div key={f.tab} className="rounded-2xl border border-border bg-card/70 p-4">
                <h3 className="font-display text-base font-bold">{t(f.t)}</h3>
                <p className="mt-1 text-sm text-foreground/85 leading-relaxed">{t(f.d)}</p>
                <Link to="/maaroof" search={{ tab: f.tab }} className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">
                  {t("mrf_tab_" + f.tab as any)} →
                </Link>
              </div>
            ))}
            <div className="rounded-2xl border border-border bg-card/70 p-4">
              <h3 className="font-display text-base font-bold">{t("guide_mrf_memory_t")}</h3>
              <p className="mt-1 text-sm text-foreground/85 leading-relaxed">{t("guide_mrf_memory_d")}</p>
              <Link to="/maaroof/memory" className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">{t("auto.memory")} →</Link>
            </div>
          </div>
        </Section>

        <Section icon={<Share2 className="size-5" />} title={t("guide_channels_title")}>
          <div className="rounded-2xl border border-accent/30 bg-card/70 p-5">
            <p className="text-sm leading-relaxed text-foreground/85">{t("guide_channels_intro")}</p>
            <ol className="mt-4 space-y-1.5 text-sm text-foreground/85">
              {(["guide_channels_s1", "guide_channels_s2", "guide_channels_s3", "guide_channels_s4", "guide_channels_s5"] as const).map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ol>
            <p className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/85">
              {t("guide_channels_security")}
            </p>
            <Link to="/maaroof" search={{ tab: "channels" as const }} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground">
              <Share2 className="size-4" /> {t("mrf_tab_channels")}
            </Link>
          </div>
        </Section>

        <Section icon={<Wrench className="size-5" />} title={t("guide_tools_section")}>

          {tools.map((td) => (
            <ToolRow key={td.key} toolKey={td.key} name={td.labels[L]} cost={td.costPerRun} body={t(HOWTO_KEY[td.key] as any)} />
          ))}
        </Section>

        <Section icon={<Bot className="size-5" />} title={t("guide_agent_section")}>
          {agent.map((td) => (
            <ToolRow key={td.key} toolKey={td.key} name={td.labels[L]} cost={td.costPerRun} body={t(HOWTO_KEY[td.key] as any)} />
          ))}
        </Section>

        <Section icon={<Globe2 className="size-5" />} title={t("geo_scope_title")}>
          <p className="text-sm text-foreground/85 leading-relaxed">{t("guide_geo_body")}</p>
        </Section>

        <Section icon={<User className="size-5" />} title={t("profile_title")}>
          <p className="text-sm text-foreground/85 leading-relaxed">{t("guide_profile_body")}</p>
        </Section>

        <div className="mt-8 text-center"><Link to="/dashboard" className="text-sm text-primary hover:underline">← {t("nav_dashboard")}</Link></div>
      </main>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold text-gradient">
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">{icon}</span>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ToolRow({ toolKey, name, cost, body }: { toolKey: ToolKey; name: string; cost: number; body?: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-bold">{name}</h3>
        <span className="ms-auto rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
          {cost}× {t("guide_cost_unit")}
        </span>
      </div>
      {body && <p className="text-sm text-foreground/85 leading-relaxed">{body}</p>}
      <HowItWorks toolKey={toolKey} />
    </div>
  );
}
