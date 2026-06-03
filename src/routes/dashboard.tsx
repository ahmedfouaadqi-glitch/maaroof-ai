import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { Sandbox } from "@/components/Sandbox";
import { PostSuggester } from "@/components/PostSuggester";
import { CompetitorCompare } from "@/components/CompetitorCompare";
import { FeasibilityStudy } from "@/components/FeasibilityStudy";
import { BizDev } from "@/components/BizDev";
import { SmartResearch } from "@/components/SmartResearch";
import { CompanyOutreach } from "@/components/CompanyOutreach";
import { BrandBoostAgent } from "@/components/BrandBoostAgent";
import { AppliedRanking } from "@/components/AppliedRanking";
import { BrandPulseGauges } from "@/components/BrandPulseGauges";
import { GeoScopeSelector } from "@/components/GeoScopeSelector";
import { SpecialtyBanner } from "@/components/SpecialtyBanner";
import { ExportButtons } from "@/components/ExportButtons";
import type { ExportPayload } from "@/lib/exports";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Sparkles, Crown, Loader2, Bot, ArrowRight, ArrowDown, Trash2, Copy, RefreshCw, Check, ClipboardList, TrendingUp, Search, Mail, Megaphone, Trophy, Zap, X, Eye } from "lucide-react";
import { AIVisibility } from "@/components/AIVisibility";

type ToolKey = "analyze" | "suggest" | "compare" | "feasibility" | "bizdev" | "research" | "outreach" | "boost" | "applied" | "visibility";
const TOOL_COST: Record<ToolKey, number> = {
  analyze: 1, suggest: 1, compare: 1, feasibility: 2, bizdev: 2,
  research: 2, outreach: 1, boost: 5, applied: 2, visibility: 1,
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
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [agentSub, setAgentSub] = useState<any | null>(null);
  const [openTool, setOpenTool] = useState<ToolKey | null>(null);

  // Units balance: derived from quota_overrides.monthly_analyses (admin-controlled) and monthly_analyses_used.
  const unitsLimit = useMemo(() => {
    const override = Number((profile as any)?.quota_overrides?.monthly_analyses || 0);
    if (override > 0) return override;
    return profile?.is_subscribed ? 100 : 5;
  }, [profile]);
  const unitsUsed = profile?.monthly_analyses_used ?? 0;
  const unitsLeft = Math.max(0, unitsLimit - unitsUsed);
  const unitsPct = Math.min(100, Math.round((unitsUsed / Math.max(1, unitsLimit)) * 100));

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin", redirect: "/dashboard" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("analyses").select("*").order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => setAnalyses(data || []));
    supabase.from("suggestions").select("*").order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => setSuggestions(data || []));
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

  const expires = profile?.subscription_expires_at
    ? new Date(profile.subscription_expires_at).toLocaleDateString()
    : "—";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <h1 className="break-words font-display text-2xl font-bold text-gradient sm:text-3xl">{t("dash_welcome")}, {profile?.full_name || profile?.email}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{profile?.email}</p>

        {/* Stats */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat icon={<Activity />} label={t("dashboard_analyses")} value={profile?.monthly_analyses_used ?? 0} />
          <Stat icon={<Sparkles />} label={t("dashboard_suggestions")} value={profile?.monthly_suggestions_used ?? 0} />
          <Stat
            icon={<Crown />}
            label={t("dashboard_subscription")}
            value={profile?.is_subscribed ? profile.subscription_tier || "Pro" : t("pricing_free")}
            sub={profile?.is_subscribed ? `${t("dashboard_expires")}: ${expires}` : ""}
          />
        </div>

        {/* Real-time gauges */}
        <div className="mt-6"><BrandPulseGauges /></div>

        {/* Units balance — live */}
          <div className="mt-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="size-5 text-primary" />
              <span className="font-display text-base font-bold">{t("units_title") || "رصيد الوحدات"}</span>
            </div>
            <div className="text-sm">
              <span className="font-mono text-lg font-bold text-primary">{unitsLeft}</span>
              <span className="text-muted-foreground"> / {unitsLimit} {t("units_left") || "متبقّية"}</span>
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background/60">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${unitsPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("units_hint") || "كل أداة تستهلك عدداً من الوحدات حسب نوعها — الخصم لحظي."}
          </p>
        </div>

        {/* Tools — card grid; click opens modal */}
        <div className="mt-10">
          <h2 className="font-display text-2xl font-bold">{t("dash_tools_title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("dash_tools_intro")}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ToolGridCard icon={<Activity className="size-5" />} title={t("dash_tool_analyze_t")} desc={t("dash_tool_analyze_d")} cost={TOOL_COST.analyze} onOpen={() => setOpenTool("analyze")} />
            <ToolGridCard icon={<Sparkles className="size-5" />} title={t("dash_tool_suggest_t")} desc={t("dash_tool_suggest_d")} cost={TOOL_COST.suggest} onOpen={() => setOpenTool("suggest")} />
            <ToolGridCard icon={<Search className="size-5" />} title={t("compare_title")} desc={t("compare_desc") || ""} cost={TOOL_COST.compare} onOpen={() => setOpenTool("compare")} />
            <ToolGridCard icon={<ClipboardList className="size-5" />} title={t("dash_tool_feas_t")} desc={t("dash_tool_feas_d")} cost={TOOL_COST.feasibility} onOpen={() => setOpenTool("feasibility")} />
            <ToolGridCard icon={<TrendingUp className="size-5" />} title={t("dash_tool_biz_t")} desc={t("dash_tool_biz_d")} cost={TOOL_COST.bizdev} onOpen={() => setOpenTool("bizdev")} />
            <ToolGridCard icon={<Search className="size-5" />} title={t("research_title")} desc={t("research_desc") || ""} cost={TOOL_COST.research} onOpen={() => setOpenTool("research")} />
            <ToolGridCard icon={<Eye className="size-5" />} title={t("ag_vis_title")} desc={t("ag_vis_desc") || ""} cost={TOOL_COST.visibility} onOpen={() => setOpenTool("visibility")} />
            <ToolGridCard icon={<Mail className="size-5" />} title={t("outreach_title")} desc={t("outreach_desc") || ""} cost={TOOL_COST.outreach} onOpen={() => setOpenTool("outreach")} />
            <ToolGridCard icon={<Megaphone className="size-5" />} title={t("boost_title")} desc={t("boost_desc") || ""} cost={TOOL_COST.boost} onOpen={() => setOpenTool("boost")} />
            <ToolGridCard icon={<Trophy className="size-5" />} title={t("dash_tool_applied_t")} desc={""} cost={TOOL_COST.applied} onOpen={() => setOpenTool("applied")} />
            <ToolCard icon={<Bot className="size-5" />} title={t("dash_tool_agent_t")} desc={t("dash_tool_agent_d")} cta={t("dash_open_agent")} to="/agent" badge={agentSub ? t("dash_agent_active") : t("dash_agent_inactive")} badgeOk={!!agentSub} />
            
          </div>
        </div>

        {/* How they connect */}
        <div className="mt-10 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5 p-6">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold">
            <ArrowDown className="size-5 text-accent" /> {t("dash_flow_title")}
          </h3>
          <ol className="mt-4 space-y-3 text-sm">
            <FlowStep n={1} text={t("dash_flow_step1")} />
            <FlowStep n={2} text={t("dash_flow_step2")} />
            <FlowStep n={3} text={t("dash_flow_step3")} />
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">{t("dash_flow_solo")}</p>
        </div>

        <div className="mt-10 rounded-2xl border border-primary/40 bg-card/70 p-6 shadow-[var(--shadow-glow)]">
          <h3 className="font-display text-lg font-bold text-gradient">{t("dash_request_title")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t("dash_request_desc")}</p>
          <Link to="/pricing" className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground">
            {t("dash_request_cta")} <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-8"><SpecialtyBanner /></div>
        <div className="mt-8"><GeoScopeSelector /></div>

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
              {openTool === "research" && <SmartResearch />}
              {openTool === "outreach" && <CompanyOutreach />}
              {openTool === "boost" && <BrandBoostAgent />}
              {openTool === "applied" && <AppliedRanking />}
              {openTool === "visibility" && <AIVisibility />}
            </div>
          </DialogContent>
        </Dialog>


        {/* Activity & summary export */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-4">
          <div className="flex items-center gap-2 text-sm">
            <Activity className="size-4 text-primary" />
            <span className="font-semibold">{t("export_summary")}</span>
            <span className="text-xs text-muted-foreground">— {t("export_activity_title")}</span>
          </div>
          <ExportButtons build={() => buildActivityExport(t, profile, analyses, suggestions)} />
        </div>

        {/* History */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card title={`${t("dashboard_history")} — ${t("dashboard_analyses")}`} actions={
            analyses.length > 0 ? <ExportButtons size="xs" build={() => buildAnalysesExport(t, analyses)} /> : null
          }>
            {analyses.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard_no_history")}</p>
            ) : (
              <ul className="space-y-2">
                {analyses.map((a) => (
                  <li key={a.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                      <span className="font-display text-lg font-bold text-primary">{a.score}</span>
                    </div>
                    <p className="mt-1 truncate text-foreground/80">{a.input_text.slice(0, 100)}…</p>
                    <HistoryActions
                      text={a.input_text}
                      onReuse={() => {
                        window.dispatchEvent(new CustomEvent("geo:reuse-analyze", { detail: { text: a.input_text } }));
                        document.getElementById("analyze")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      onDelete={async () => {
                        if (!confirm(t("hist_confirm_delete"))) return;
                        await supabase.from("analyses").delete().eq("id", a.id);
                        setAnalyses((cur) => cur.filter((x) => x.id !== a.id));
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={`${t("dashboard_history")} — ${t("dashboard_suggestions")}`} actions={
            suggestions.length > 0 ? <ExportButtons size="xs" build={() => buildSuggestionsExport(t, suggestions)} /> : null
          }>
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard_no_history")}</p>
            ) : (
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <li key={s.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
                    <div className="font-mono text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()} · {s.mode}</div>
                    <p className="mt-1 line-clamp-2 text-foreground/80">{s.output}</p>
                    <HistoryActions
                      text={s.output}
                      onReuse={s.input ? () => {
                        window.dispatchEvent(new CustomEvent("geo:reuse-suggest", { detail: { text: s.input } }));
                        document.getElementById("suggest")?.scrollIntoView({ behavior: "smooth" });
                      } : undefined}
                      onDelete={async () => {
                        if (!confirm(t("hist_confirm_delete"))) return;
                        await supabase.from("suggestions").delete().eq("id", s.id);
                        setSuggestions((cur) => cur.filter((x) => x.id !== s.id));
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-primary hover:underline">← {t("back_home")}</Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: any; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <span className="text-primary">{icon}</span> {label}
      </div>
      <div className="font-display text-3xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function HistoryActions({ text, onReuse, onDelete }: { text: string; onReuse?: () => void; onDelete: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button onClick={copy} className="inline-flex items-center gap-1 rounded-full border border-border bg-background/50 px-2.5 py-1 text-[11px] text-foreground/80 hover:bg-background">
        {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />} {copied ? t("hist_copied") : t("hist_copy")}
      </button>
      {onReuse && (
        <button onClick={onReuse} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20">
          <RefreshCw className="size-3" /> {t("hist_reuse")}
        </button>
      )}
      <button onClick={onDelete} className="ms-auto inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/20">
        <Trash2 className="size-3" /> {t("hist_delete")}
      </button>
    </div>
  );
}

function Card({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  );
}

function buildActivityExport(t: (k: string) => string, profile: any, analyses: any[], suggestions: any[]): ExportPayload {
  return {
    title: t("export_activity_title"),
    subtitle: profile?.email || "",
    sections: [
      {
        kind: "kv", heading: t("dashboard_subscription"),
        rows: [
          [t("dashboard_analyses"), profile?.monthly_analyses_used ?? 0],
          [t("dashboard_suggestions"), profile?.monthly_suggestions_used ?? 0],
          [t("dashboard_subscription"), profile?.is_subscribed ? (profile.subscription_tier || "Pro") : "Free"],
          [t("dashboard_expires"), profile?.subscription_expires_at ? new Date(profile.subscription_expires_at).toLocaleDateString() : "—"],
        ],
      },
      {
        kind: "table", heading: `${t("dashboard_history")} — ${t("dashboard_analyses")}`,
        table: {
          columns: [t("col_date"), t("col_score"), t("col_input")],
          data: analyses.map((a) => [new Date(a.created_at).toLocaleString(), a.score ?? "-", String(a.input_text || "").slice(0, 200)]),
        },
      },
      {
        kind: "table", heading: `${t("dashboard_history")} — ${t("dashboard_suggestions")}`,
        table: {
          columns: [t("col_date"), t("col_mode"), t("col_output")],
          data: suggestions.map((s) => [new Date(s.created_at).toLocaleString(), s.mode || "-", String(s.output || "").slice(0, 300)]),
        },
      },
    ],
  };
}

function buildAnalysesExport(t: (k: string) => string, analyses: any[]): ExportPayload {
  return {
    title: t("export_analyses_title"),
    sections: [{
      kind: "table", heading: t("export_analyses_title"),
      table: {
        columns: [t("col_date"), t("col_score"), t("col_input")],
        data: analyses.map((a) => [new Date(a.created_at).toLocaleString(), a.score ?? "-", String(a.input_text || "")]),
      },
    }],
  };
}

function buildSuggestionsExport(t: (k: string) => string, suggestions: any[]): ExportPayload {
  return {
    title: t("export_suggestions_title"),
    sections: [{
      kind: "table", heading: t("export_suggestions_title"),
      table: {
        columns: [t("col_date"), t("col_mode"), t("col_output")],
        data: suggestions.map((s) => [new Date(s.created_at).toLocaleString(), s.mode || "-", String(s.output || "")]),
      },
    }],
  };
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

function FlowStep({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
        {n}
      </span>
      <span className="text-foreground/90">{text}</span>
    </li>
  );
}

function toolTitle(k: ToolKey, t: (k: string) => string): string {
  const map: Record<ToolKey, string> = {
    analyze: t("dash_tool_analyze_t"),
    suggest: t("dash_tool_suggest_t"),
    compare: t("compare_title"),
    feasibility: t("dash_tool_feas_t"),
    bizdev: t("dash_tool_biz_t"),
    research: t("research_title"),
    outreach: t("outreach_title"),
    boost: t("boost_title"),
    applied: t("dash_tool_applied_t"),
    visibility: t("ag_vis_title"),
  };
  return map[k] || k;
}

function ToolGridCard({ icon, title, desc, cost, onOpen }: { icon: React.ReactNode; title: string; desc: string; cost: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full rounded-2xl border border-border bg-card/70 p-5 text-start transition hover:border-primary/40 hover:shadow-[var(--shadow-glow)]"
    >
      <div className="flex items-center justify-between">
        <div className="inline-grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
          {icon}
        </div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
          {cost} {cost === 1 ? "وحدة" : "وحدات"}
        </span>
      </div>
      <h3 className="mt-3 font-display text-base font-bold">أداة · {title.replace(/^\d+\)\s*/, "").replace(/^أداة\s*/, "")}</h3>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{desc}</p>
      <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:gap-2 transition-all">
        فتح الأداة <ArrowRight className="size-3.5" />
      </div>
    </button>
  );
}
