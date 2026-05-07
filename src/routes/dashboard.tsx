import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Sparkles, Crown, Loader2 } from "lucide-react";

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

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin", redirect: "/dashboard" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("analyses").select("*").order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => setAnalyses(data || []));
    supabase.from("suggestions").select("*").order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => setSuggestions(data || []));
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
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <h1 className="mb-2 font-display text-3xl font-bold text-gradient">{t("dashboard_title")}</h1>
        <p className="mb-8 text-sm text-muted-foreground">{profile?.email}</p>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Stat icon={<Activity />} label={t("dashboard_analyses")} value={profile?.monthly_analyses_used ?? 0} />
          <Stat icon={<Sparkles />} label={t("dashboard_suggestions")} value={profile?.monthly_suggestions_used ?? 0} />
          <Stat
            icon={<Crown />}
            label={t("dashboard_subscription")}
            value={profile?.is_subscribed ? profile.subscription_tier || "Pro" : t("pricing_free")}
            sub={profile?.is_subscribed ? `${t("dashboard_expires")}: ${expires}` : ""}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={`${t("dashboard_history")} — ${t("dashboard_analyses")}`}>
            {analyses.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard_no_history")}</p>
            ) : (
              <ul className="space-y-2">
                {analyses.map((a) => (
                  <li key={a.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
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
                    <div className="font-mono text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleString()} · {s.mode}
                    </div>
                    <p className="mt-1 line-clamp-2 text-foreground/80">{s.output}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="mt-8 flex justify-center">
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
