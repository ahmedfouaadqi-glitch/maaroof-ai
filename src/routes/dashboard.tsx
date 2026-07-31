import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { BlurText } from "@/components/motion/BlurText";
import { MagicRings } from "@/components/backgrounds/MagicRings";
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
import { Activity, Sparkles, Loader2, Bot, ArrowRight, ClipboardList, TrendingUp, Search, Megaphone, Trophy, Share2, Bell, Target, FlaskConical, FileText, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";
import { useVisibility, useToolPrice } from "@/lib/visibility";
import { TokensBar } from "@/components/TokensBar";
import { CostBadge } from "@/components/CostBadge";

type ToolKey = "analyze" | "suggest" | "compare" | "feasibility" | "bizdev" | "boost" | "applied" | "social" | "monitor" | "strategist" | "whatif" | "report";

type ToolDef = {
  key: ToolKey;
  icon: React.ReactNode;
  /** TOOL_CATALOG key used in ui_visibility.tools + pricing (null = always shown, free) */
  catalog: string | null;
  titleKey: string;
  descKey?: string;
  render: () => React.ReactNode;
};

const TOOLS: ToolDef[] = [
  { key: "analyze", icon: <Activity className="size-5" />, catalog: "analyze", titleKey: "dash_tool_analyze_t", descKey: "dash_tool_analyze_d", render: () => <Sandbox /> },
  { key: "suggest", icon: <Sparkles className="size-5" />, catalog: "suggest", titleKey: "dash_tool_suggest_t", descKey: "dash_tool_suggest_d", render: () => <PostSuggester /> },
  { key: "compare", icon: <Search className="size-5" />, catalog: "compare", titleKey: "compare_title", descKey: "compare_desc", render: () => <CompetitorCompare /> },
  { key: "feasibility", icon: <ClipboardList className="size-5" />, catalog: "feasibility", titleKey: "dash_tool_feas_t", descKey: "dash_tool_feas_d", render: () => <FeasibilityStudy /> },
  { key: "bizdev", icon: <TrendingUp className="size-5" />, catalog: "bizdev", titleKey: "dash_tool_biz_t", descKey: "dash_tool_biz_d", render: () => <BizDev /> },
  { key: "boost", icon: <Megaphone className="size-5" />, catalog: "brand_boost", titleKey: "boost_title", descKey: "boost_desc", render: () => <BrandBoostAgent /> },
  { key: "applied", icon: <Trophy className="size-5" />, catalog: "applied_ranking", titleKey: "dash_tool_applied_t", render: () => <AppliedRanking /> },
  { key: "social", icon: <Share2 className="size-5" />, catalog: "social_analysis", titleKey: "dash_tool_social_t", descKey: "dash_tool_social_d", render: () => <SocialAnalysis /> },
  { key: "monitor", icon: <Bell className="size-5" />, catalog: "competitor_monitor", titleKey: "dash_tool_monitor_t", descKey: "dash_tool_monitor_d", render: () => <CompetitorMonitor /> },
  { key: "strategist", icon: <Target className="size-5" />, catalog: "geo_strategist", titleKey: "dash_tool_strat_t", descKey: "dash_tool_strat_d", render: () => <GeoStrategist /> },
  { key: "whatif", icon: <FlaskConical className="size-5" />, catalog: "what_if", titleKey: "dash_tool_whatif_t", descKey: "dash_tool_whatif_d", render: () => <WhatIfSimulator /> },
  { key: "report", icon: <FileText className="size-5" />, catalog: null, titleKey: "dash_tool_report_t", descKey: "dash_tool_report_d", render: () => <ReportBuilder /> },
];

const isToolKey = (v: unknown): v is ToolKey => TOOLS.some((x) => x.key === v);

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s: Record<string, unknown>) => ({
    tool: isToolKey(s.tool) ? s.tool : undefined,
  }),
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
  const { t, lang } = useI18n();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const vis = useVisibility();
  const { tool: openTool } = Route.useSearch();
  const [agentSub, setAgentSub] = useState<any | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const railSignRef = useRef<number | null>(null);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  const setOpenTool = (k: ToolKey | null) => {
    navigate({ to: "/dashboard", search: { tool: k ?? undefined }, replace: false });
  };

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

  const tools = useMemo(
    () => TOOLS.filter((x) => (x.catalog ? vis.isToolVisible(x.catalog) : true)),
    [vis.loading, vis],
  );

  const active = openTool ? tools.find((x) => x.key === openTool) ?? null : null;

  // Smooth-scroll to the workspace when a tool opens.
  useEffect(() => {
    if (!active) return;
    workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [active?.key]);

  // Keyboard: Esc back to grid, arrows to move between tools.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (e.key === "Escape") { setOpenTool(null); return; }
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const rtl = lang !== "en";
      const forward = rtl ? e.key === "ArrowLeft" : e.key === "ArrowRight";
      const i = tools.findIndex((x) => x.key === active.key);
      const next = tools[(i + (forward ? 1 : tools.length - 1)) % tools.length];
      if (next) setOpenTool(next.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active?.key, tools, lang]);

  // Scroll-state for the sticky tool rail.
  const updateScrollState = () => {
    const el = railRef.current;
    if (!el) return;
    const isRtl = getComputedStyle(el).direction === "rtl";
    const maxScroll = el.scrollWidth - el.clientWidth;
    const start = isRtl ? maxScroll - el.scrollLeft : el.scrollLeft;
    const end = isRtl ? el.scrollLeft : maxScroll - el.scrollLeft;
    setCanScrollStart(start > 1);
    setCanScrollEnd(end > 1);
  };

  const scrollRail = (dir: "start" | "end") => {
    const el = railRef.current;
    if (!el) return;
    const isRtl = getComputedStyle(el).direction === "rtl";
    const distance = Math.max(120, el.clientWidth * 0.55);
    const delta = dir === "end"
      ? (isRtl ? -distance : distance)
      : (isRtl ? distance : -distance);
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [tools.length, active?.key]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const allToolsLabel = lang === "ar" ? "كل الأدوات" : lang === "ku" ? "هەموو ئامرازەکان" : "All tools";

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

        {vis.isWidgetVisible("specialty_banner") && !active && <div className="mt-8"><SpecialtyBanner /></div>}

        <div className="mt-10" ref={workspaceRef}>
          {!active ? (
            <>
              <h2 className="font-display text-2xl font-bold">{t("dash_tools_title")}</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {tools.map((tool) => (
                  <ToolGridCard
                    key={tool.key}
                    icon={tool.icon}
                    title={t(tool.titleKey)}
                    desc={tool.descKey ? t(tool.descKey) || "" : ""}
                    toolKey={tool.catalog ?? undefined}
                    onOpen={() => setOpenTool(tool.key)}
                    t={t}
                  />
                ))}
                {vis.isPageVisible("agent") && (
                  <ToolCard
                    icon={<Bot className="size-5" />}
                    title={t("dash_tool_agent_t")}
                    desc={t("dash_tool_agent_d")}
                    cta={t("dash_open_agent")}
                    to="/agent"
                    badge={agentSub ? t("dash_agent_active") : t("dash_agent_inactive")}
                    badgeOk={!!agentSub}
                  />
                )}
              </div>
            </>
          ) : (
            <section className="overflow-hidden rounded-3xl border border-border/70 bg-card/60 backdrop-blur">
              {/* Sticky rail — the remaining cards, one click away */}
              <div className="sticky top-0 z-20 border-b border-border/70 bg-card/85 backdrop-blur-xl">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setOpenTool(null)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  >
                    <LayoutGrid className="size-3.5" /> {allToolsLabel}
                  </button>
                  <div className="h-6 w-px shrink-0 bg-border" />

                  <div className="relative flex min-w-0 flex-1 items-center">
                    {/* Scroll back */}
                    <button
                      type="button"
                      onClick={() => scrollRail("start")}
                      disabled={!canScrollStart}
                      aria-label={lang === "ar" ? "تمرير للخلف" : lang === "ku" ? "هاتینە پاشەوە" : "Scroll back"}
                      className={`absolute left-0 z-10 inline-grid size-7 place-items-center rounded-full border border-border bg-background/80 text-muted-foreground shadow-sm transition hover:border-primary/40 hover:text-foreground ${
                        canScrollStart ? "opacity-100" : "pointer-events-none opacity-40"
                      }`}
                    >
                      {lang !== "en" ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
                    </button>

                    <div ref={railRef} className="flex min-w-0 flex-1 gap-2 overflow-x-auto px-9 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {tools.map((tool) => {
                        const on = tool.key === active.key;
                        return (
                          <button
                            key={tool.key}
                            type="button"
                            onClick={() => setOpenTool(tool.key)}
                            aria-current={on ? "true" : undefined}
                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                              on
                                ? "border-primary/50 bg-primary/15 text-primary shadow-[var(--shadow-glow)]"
                                : "border-border bg-background/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                            }`}
                          >
                            <span className="[&>svg]:size-3.5">{tool.icon}</span>
                            <span className="max-w-[10rem] truncate">{t(tool.titleKey).replace(/^\d+\)\s*/, "")}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Scroll forward */}
                    <button
                      type="button"
                      onClick={() => scrollRail("end")}
                      disabled={!canScrollEnd}
                      aria-label={lang === "ar" ? "تمرير للأمام" : lang === "ku" ? "هاتینە پێشەوە" : "Scroll forward"}
                      className={`absolute right-0 z-10 inline-grid size-7 place-items-center rounded-full border border-border bg-background/80 text-muted-foreground shadow-sm transition hover:border-primary/40 hover:text-foreground ${
                        canScrollEnd ? "opacity-100" : "pointer-events-none opacity-40"
                      }`}
                    >
                      {lang !== "en" ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-25">
                  <MagicRings
                    color="#6E3AF7"
                    colorTwo="#4FC3E8"
                    ringCount={5}
                    speed={0.6}
                    opacity={0.7}
                    lineThickness={1.4}
                    noiseAmount={0.04}
                  />
                </div>
                <div className="relative p-4 sm:p-6">
                  <h2 className="font-display text-xl font-bold sm:text-2xl">
                    {t(active.titleKey).replace(/^\d+\)\s*/, "")}
                  </h2>
                  <div className="mt-4">{active.render()}</div>
                </div>
              </div>
            </section>
          )}
        </div>

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

function ToolGridCard({ icon, title, desc, onOpen, t, toolKey }: { icon: React.ReactNode; title: string; desc: string; onOpen: () => void; t: (k: string) => string; toolKey?: string }) {
  const price = useToolPrice(toolKey || "");
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 text-start backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/80 hover:shadow-[var(--shadow-glow)]"
    >
      {/* Identity face — MagicRings glow behind the content */}
      <div className="pointer-events-none absolute inset-0 -z-0 transition-opacity duration-500" style={{ opacity: hover ? 0.55 : 0.22 }}>
        <MagicRings
          color="#7A46F8"
          colorTwo="#55B6F0"
          ringCount={6}
          speed={hover ? 1 : 0.5}
          attenuation={12}
          lineThickness={1.6}
          baseRadius={0.28}
          radiusStep={0.09}
          noiseAmount={0.03}
          hoverScale={1.12}
          parallax={0.04}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-0 bg-gradient-to-b from-transparent via-card/40 to-card/80" />

      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="inline-grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-accent/25 text-primary ring-1 ring-inset ring-primary/20">
          {icon}
        </div>
        {toolKey && <CostBadge tokens={price.tokens} usd={price.usd} compact />}
      </div>
      <h3 className="relative z-10 mt-3 font-display text-base font-bold">{title.replace(/^\d+\)\s*/, "")}</h3>
      <p className="relative z-10 mt-1 line-clamp-2 text-xs text-muted-foreground">{desc}</p>
      <div className="relative z-10 mt-auto pt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all group-hover:gap-2">
        {t("dash_open_tool")} <ArrowRight className="size-3.5" />
      </div>
    </button>
  );
}
