import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { Sandbox } from "@/components/Sandbox";
import { PostSuggester } from "@/components/PostSuggester";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Sparkles, Crown, Loader2, Bot, ArrowRight, ArrowDown, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
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
        <h1 className="font-display text-3xl font-bold text-gradient">{t("dash_welcome")}, {profile?.full_name || profile?.email}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{profile?.email}</p>

        {/* Stats */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat icon={<Activity />} label={t("dashboard_analyses")} value={profile?.monthly_analyses_used ?? 0} />
          <Stat icon={<Sparkles />} label={t("dashboard_suggestions")} value={profile?.monthly_suggestions_used ?? 0} />
          <Stat
            icon={<Crown />}
            label={t("dashboard_subscription")}
            value={profile?.is_subscribed ? profile.subscription_tier || "Pro" : t("pricing_free")}
            sub={profile?.is_subscribed ? `${t("dashboard_expires")}: ${expires}` : ""}
          />
        </div>

        {/* Tools intro */}
        <div className="mt-10">
          <h2 className="font-display text-2xl font-bold">{t("dash_tools_title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("dash_tools_intro")}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <ToolCard
              icon={<Activity className="size-5" />}
              title={t("dash_tool_analyze_t")}
              desc={t("dash_tool_analyze_d")}
              cta={t("dash_open_analyze")}
              href="#analyze"
            />
            <ToolCard
              icon={<Sparkles className="size-5" />}
              title={t("dash_tool_suggest_t")}
              desc={t("dash_tool_suggest_d")}
              cta={t("dash_open_suggest")}
              href="#suggest"
            />
            <ToolCard
              icon={<Bot className="size-5" />}
              title={t("dash_tool_agent_t")}
              desc={t("dash_tool_agent_d")}
              cta={t("dash_open_agent")}
              to="/agent"
              badge={agentSub ? t("dash_agent_active") : t("dash_agent_inactive")}
              badgeOk={!!agentSub}
            />
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

        {/* Request subscription panel */}
        <div className="mt-10 rounded-2xl border border-primary/40 bg-card/70 p-6 shadow-[var(--shadow-glow)]">
          <h3 className="font-display text-lg font-bold text-gradient">{t("dash_request_title")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t("dash_request_desc")}</p>
          <Link
            to="/pricing"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            {t("dash_request_cta")} <ArrowRight className="size-4" />
          </Link>
        </div>

        {/* Embedded tools */}
        <div id="analyze" className="mt-12 scroll-mt-24">
          <Sandbox />
        </div>
        <div id="suggest" className="mt-8 scroll-mt-24">
          <PostSuggester />
        </div>

        {/* History */}
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <Card title={`${t("dashboard_history")} — ${t("dashboard_analyses")}`}>
            {analyses.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard_no_history")}</p>
            ) : (
              <ul className="space-y-2">
                {analyses.map((a) => (
                  <li key={a.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                      <span className="font-display text-lg font-bold text-primary">{a.score}</span>
                    </div>
                    <p className="mt-1 truncate text-foreground/80">{a.input_text.slice(0, 100)}…</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={`${t("dashboard_history")} — ${t("dashboard_suggestions")}`}>
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard_no_history")}</p>
            ) : (
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <li key={s.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
                    <div className="font-mono text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()} · {s.mode}</div>
                    <p className="mt-1 line-clamp-2 text-foreground/80">{s.output}</p>
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur">
      <h2 className="mb-4 font-display text-lg font-semibold">{title}</h2>
      {children}
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
