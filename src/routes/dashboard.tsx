import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { BlurText } from "@/components/motion/BlurText";
import { Sandbox } from "@/components/Sandbox";
import { PostSuggester } from "@/components/PostSuggester";
import { CompetitorCompare } from "@/components/CompetitorCompare";
import { FeasibilityStudy } from "@/components/FeasibilityStudy";
import { BizDev } from "@/components/BizDev";
import { BrandBoostAgent } from "@/components/BrandBoostAgent";
import { AppliedRanking } from "@/components/AppliedRanking";
import { SocialAnalysis } from "@/components/SocialAnalysis";
import { CompetitorMonitor } from "@/components/CompetitorMonitor";
import { GeoStrategist } from "@/components/GeoStrategist";
import { WhatIfSimulator } from "@/components/WhatIfSimulator";
import { ReportBuilder } from "@/components/ReportBuilder";
import { SpecialtyBanner } from "@/components/SpecialtyBanner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Sparkles, Loader2, Bot, ArrowRight, ClipboardList, TrendingUp, Search, Megaphone, Trophy, Share2, Bell, Target, FlaskConical, FileText } from "lucide-react";
import { useVisibility, useToolPrice } from "@/lib/visibility";
import { TokensBar } from "@/components/TokensBar";
import { CostBadge } from "@/components/CostBadge";

type ToolKey = "analyze" | "suggest" | "compare" | "feasibility" | "bizdev" | "boost" | "applied" | "social" | "monitor" | "strategist" | "whatif" | "report";

// Maps dashboard ToolKey → TOOL_CATALOG key used in ui_visibility.tools
const DASH_TO_CATALOG: Record<ToolKey, string | null> = {
  analyze: "analyze", suggest: "suggest", compare: "compare", feasibility: "feasibility",
  bizdev: "bizdev", boost: "brand_boost", applied: "applied_ranking", social: "social_analysis",
  monitor: "competitor_monitor", strategist: "geo_strategist", whatif: "what_if", report: null,
};

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your AI Visibility Dashboard · MAAROOF Ai" },
      { name: "description", content: "Run analyses, suggest posts, compare competitors, and track how AI engines cite your brand from a single MAAROOF Ai dashboard." },
      { name: "robots", content: "noindex,follow" },
      { property: "og:title", content: "Your AI Visibility Dashboard · MAAROOF Ai" },
      { property: "og:description", content: "Run analyses, suggest posts, compare competitors, and track how AI engines cite your brand from a single MAAROOF Ai dashboard." },
    ],
  }),
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <DashboardPage />
      </AuthProvider>
    </I18nProvider>
  ),
});

function DashboardPage() {
  const { t } = useI18n();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const vis = useVisibility();
  const [agentSub, setAgentSub] = useState<any | null>(null);
  const [openTool, setOpenTool] = useState<ToolKey | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin", redirect: "/dashboard" } });
  }, [loading, user, navigate]);

  // Page-level gate: admin hid the dashboard page itself
  useEffect(() => {
    if (!vis.loading && !vis.isPageVisible("dashboard")) navigate({ to: "/" });
  }, [vis.loading]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_agent_subscriptions").select("*").eq("user_id", user.id).eq("status", "active").maybeSingle()
      .then(({ data }) => setAgentSub(data));
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const showCard = (k: ToolKey) => {
    const catKey = DASH_TO_CATALOG[k];
    return catKey ? vis.isToolVisible(catKey) : true;
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <BlurText
          as="h1"
          text={`${t("dash_welcome")}, ${profile?.full_name || profile?.email || ""}`}
          delay={60}
          stepDuration={0.26}
          center={false}
          segmentClassName="text-gradient"
          className="break-words font-display text-2xl font-bold sm:text-3xl"
        />
        <p className="mt-1 text-sm text-muted-foreground">{profile?.email}</p>

        <div className="mt-6"><TokensBar /></div>

        {vis.isWidgetVisible("specialty_banner") && <div className="mt-8"><SpecialtyBanner /></div>}

        {/* Tools — card grid; click opens modal */}
        <div className="mt-10">
          <h2 className="font-display text-2xl font-bold">{t("dash_tools_title")}</h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {showCard("analyze") && <ToolGridCard toolKey="analyze" icon={<Activity className="size-5" />} title={t("dash_tool_analyze_t")} desc={t("dash_tool_analyze_d")} onOpen={() => setOpenTool("analyze")} t={t} />}
            {showCard("suggest") && <ToolGridCard toolKey="suggest" icon={<Sparkles className="size-5" />} title={t("dash_tool_suggest_t")} desc={t("dash_tool_suggest_d")} onOpen={() => setOpenTool("suggest")} t={t} />}
            {showCard("compare") && <ToolGridCard toolKey="compare" icon={<Search className="size-5" />} title={t("compare_title")} desc={t("compare_desc") || ""} onOpen={() => setOpenTool("compare")} t={t} />}
            {showCard("feasibility") && <ToolGridCard toolKey="feasibility" icon={<ClipboardList className="size-5" />} title={t("dash_tool_feas_t")} desc={t("dash_tool_feas_d")} onOpen={() => setOpenTool("feasibility")} t={t} />}
            {showCard("bizdev") && <ToolGridCard toolKey="bizdev" icon={<TrendingUp className="size-5" />} title={t("dash_tool_biz_t")} desc={t("dash_tool_biz_d")} onOpen={() => setOpenTool("bizdev")} t={t} />}
            {showCard("boost") && <ToolGridCard toolKey="brand_boost" icon={<Megaphone className="size-5" />} title={t("boost_title")} desc={t("boost_desc") || ""} onOpen={() => setOpenTool("boost")} t={t} />}
            {showCard("applied") && <ToolGridCard toolKey="applied_ranking" icon={<Trophy className="size-5" />} title={t("dash_tool_applied_t")} desc={""} onOpen={() => setOpenTool("applied")} t={t} />}
            {showCard("social") && <ToolGridCard toolKey="social_analysis" icon={<Share2 className="size-5" />} title={t("dash_tool_social_t")} desc={t("dash_tool_social_d")} onOpen={() => setOpenTool("social")} t={t} />}
            {showCard("monitor") && <ToolGridCard toolKey="competitor_monitor" icon={<Bell className="size-5" />} title={t("dash_tool_monitor_t")} desc={t("dash_tool_monitor_d")} onOpen={() => setOpenTool("monitor")} t={t} />}
            {showCard("strategist") && <ToolGridCard toolKey="geo_strategist" icon={<Target className="size-5" />} title={t("dash_tool_strat_t")} desc={t("dash_tool_strat_d")} onOpen={() => setOpenTool("strategist")} t={t} />}
            {showCard("whatif") && <ToolGridCard toolKey="what_if" icon={<FlaskConical className="size-5" />} title={t("dash_tool_whatif_t")} desc={t("dash_tool_whatif_d")} onOpen={() => setOpenTool("whatif")} t={t} />}
            {showCard("report") && <ToolGridCard icon={<FileText className="size-5" />} title={t("dash_tool_report_t")} desc={t("dash_tool_report_d")} onOpen={() => setOpenTool("report")} t={t} />}
            {vis.isPageVisible("agent") && <ToolCard icon={<Bot className="size-5" />} title={t("dash_tool_agent_t")} desc={t("dash_tool_agent_d")} cta={t("dash_open_agent")} to="/agent" badge={agentSub ? t("dash_agent_active") : t("dash_agent_inactive")} badgeOk={!!agentSub} />}
          </div>
        </div>

        {/* Tool modal */}
        <Dialog open={openTool !== null} onOpenChange={(o) => !o && setOpenTool(null)}>
          <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-5xl overflow-y-auto p-3 sm:w-[calc(100vw-2rem)] sm:p-6">
            <DialogHeader>
              <DialogTitle>{openTool ? toolTitle(openTool, t) : ""}</DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              {openTool === "analyze" && <Sandbox />}
              {openTool === "suggest" && <PostSuggester />}
              {openTool === "compare" && <CompetitorCompare />}
              {openTool === "feasibility" && <FeasibilityStudy />}
              {openTool === "bizdev" && <BizDev />}
              {openTool === "boost" && <BrandBoostAgent />}
              {openTool === "applied" && <AppliedRanking />}
              {openTool === "social" && <SocialAnalysis />}
              {openTool === "monitor" && <CompetitorMonitor />}
              {openTool === "strategist" && <GeoStrategist />}
              {openTool === "whatif" && <WhatIfSimulator />}
              {openTool === "report" && <ReportBuilder />}
            </div>
          </DialogContent>
        </Dialog>

        <div className="mt-10 text-center">
          <Link to="/" className="text-sm text-primary hover:underline">← {t("back_home")}</Link>
        </div>
      </div>
    </div>
  );
}

function ToolCard({
  icon, title, desc, cta, href, to, badge, badgeOk,
}: {
  icon: React.ReactNode; title: string; desc: string; cta: string;
  href?: string; to?: string; badge?: string; badgeOk?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <div className="inline-grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
          {icon}
        </div>
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeOk ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
            {badge}
          </span>
        )}
      </div>
      <h3 className="mt-3 font-display text-base font-bold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
        {cta} <ArrowRight className="size-3.5" />
      </div>
    </>
  );
  const cls = "block rounded-2xl border border-border bg-card/70 p-5 transition hover:border-primary/40 hover:shadow-[var(--shadow-glow)]";
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  return <a href={href} className={cls}>{inner}</a>;
}

function toolTitle(k: ToolKey, t: (k: string) => string): string {
  const map: Record<ToolKey, string> = {
    analyze: t("dash_tool_analyze_t"),
    suggest: t("dash_tool_suggest_t"),
    compare: t("compare_title"),
    feasibility: t("dash_tool_feas_t"),
    bizdev: t("dash_tool_biz_t"),
    boost: t("boost_title"),
    applied: t("dash_tool_applied_t"),
    social: t("dash_tool_social_t"),
    monitor: t("dash_tool_monitor_t"),
    strategist: t("dash_tool_strat_t"),
    whatif: t("dash_tool_whatif_t"),
    report: t("dash_tool_report_t"),
  };
  return map[k] || k;
}

function ToolGridCard({ icon, title, desc, onOpen, t, toolKey }: { icon: React.ReactNode; title: string; desc: string; onOpen: () => void; t: (k: string) => string; toolKey?: string }) {
  const price = useToolPrice(toolKey || "");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full rounded-2xl border border-border bg-card/70 p-5 text-start transition hover:border-primary/40 hover:shadow-[var(--shadow-glow)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="inline-grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
          {icon}
        </div>
        {toolKey && <CostBadge tokens={price.tokens} usd={price.usd} compact />}
      </div>
      <h3 className="mt-3 font-display text-base font-bold">{title.replace(/^\d+\)\s*/, "")}</h3>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{desc}</p>
      <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:gap-2 transition-all">
        {t("dash_open_tool")} <ArrowRight className="size-3.5" />
      </div>
    </button>
  );
}
