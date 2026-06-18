import { createFileRoute, Link } from "@tanstack/react-router";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { BookOpen, Wrench, Bot, Globe2, User } from "lucide-react";
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
  "agent.command": "guide_how_agent_command",
  "agent.run_targets": "guide_how_agent_targets",
  "agent.visibility": "guide_how_agent_visibility",
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
