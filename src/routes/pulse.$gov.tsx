import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePulseI18n } from "@/lib/pulse-i18n";
import { useAuth } from "@/lib/auth";
import { exportPulseReport } from "@/lib/pulse-export";

export const Route = createFileRoute("/pulse/$gov")({
  component: GovPage,
});

type Gov = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  population_base: number | null;
};

type Metric = {
  id: string;
  metric_key: string;
  sector: string;
  value: number | null;
  unit: string | null;
  captured_at: string;
};

type App = { id: string; app_name: string; category: string | null; rank: number };

const HOUR_CURVE = [
  0.35, 0.25, 0.18, 0.15, 0.18, 0.25, 0.45, 0.65, 0.80, 0.85, 0.88, 0.92,
  0.95, 0.90, 0.85, 0.88, 0.95, 1.05, 1.20, 1.35, 1.40, 1.30, 1.05, 0.70,
];

const SECTOR_ORDER_BY_SPECIALTY: Record<string, string[]> = {
  engineer: ["telecom", "infrastructure", "economy", "population", "humanitarian"],
  doctor: ["population", "humanitarian", "economy", "telecom"],
  trader: ["isx", "currency", "economy", "telecom", "apps"],
  default: ["economy", "population", "telecom", "isx", "currency", "apps", "humanitarian", "infrastructure", "search_trends"],
};

function GovPage() {
  const { gov: slug } = Route.useParams();
  const { t, dir, lang } = usePulseI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch { /* not in provider */ }
  const specialty = (auth?.profile as any)?.specialty ?? null;

  const [gov, setGov] = useState<Gov | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [hour, setHour] = useState(new Date().getHours());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: g } = await supabase
        .from("governorates")
        .select("id, slug, name_ar, name_en, population_base")
        .eq("slug", slug)
        .maybeSingle();
      if (!g) { setLoading(false); return; }
      setGov(g as Gov);

      const [{ data: m }, { data: a }] = await Promise.all([
        supabase
          .from("pulse_metrics")
          .select("id, metric_key, sector, value, unit, captured_at")
          .or(`governorate_id.eq.${g.id},governorate_id.is.null`)
          .order("captured_at", { ascending: false })
          .limit(60),
        supabase
          .from("pulse_trending_apps")
          .select("id, app_name, category, rank")
          .eq("governorate_id", g.id)
          .order("rank", { ascending: true })
          .limit(15),
      ]);
      setMetrics((m ?? []) as Metric[]);
      setApps((a ?? []) as App[]);
      setLoading(false);

      // Log behavior (RLS allows users to insert their own row)
      if (auth?.user) {
        void supabase.from("pulse_user_behavior").insert({
          user_id: auth.user.id,
          governorate_id: g.id,
          action: "view_governorate",
          weight: 1,
        });
      }
    })();
    const timer = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Uₜ: population × digital penetration (~0.78) × hourly curve × tiny noise
  const ut = useMemo(() => {
    if (!gov?.population_base) return null;
    const base = gov.population_base * 0.78;
    return Math.round(base * HOUR_CURVE[hour] * 0.045);
  }, [gov, hour]);

  // Group metrics by sector, latest per metric_key
  const bySector = useMemo(() => {
    const seen = new Set<string>();
    const groups: Record<string, Metric[]> = {};
    for (const m of metrics) {
      const k = `${m.sector}::${m.metric_key}`;
      if (seen.has(k)) continue;
      seen.add(k);
      (groups[m.sector] ||= []).push(m);
    }
    const order = SECTOR_ORDER_BY_SPECIALTY[specialty as string] ?? SECTOR_ORDER_BY_SPECIALTY.default;
    return Object.entries(groups).sort(
      ([a], [b]) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)),
    );
  }, [metrics, specialty]);

  const handleExport = () => {
    if (!gov) return;
    exportPulseReport({
      title: `${t("pulse_brand")} — ${gov.name_ar}`,
      subtitle: `${t("pulse_governorate")}: ${gov.name_en}`,
      lang,
      metrics: metrics.map((m) => ({
        metric_key: m.metric_key,
        sector: m.sector,
        value: m.value,
        unit: m.unit,
        captured_at: m.captured_at,
        governorate: gov.name_ar,
      })),
      apps: apps.map((a) => ({ ...a, governorate: gov.name_ar })),
    });
  };

  if (loading) return <div dir={dir} className="min-h-screen bg-background text-foreground p-8">…</div>;
  if (!gov) return <div dir={dir} className="min-h-screen bg-background text-foreground p-8">404</div>;

  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link to="/pulse" className="text-xs text-muted-foreground hover:text-foreground">← {t("pulse_brand")}</Link>
            <h1 className="text-3xl font-extrabold mt-1">{gov.name_ar}</h1>
            <p className="text-sm text-muted-foreground">{gov.name_en}</p>
          </div>
          <div className="flex items-center gap-6">
            {ut !== null && (
              <div className="text-end">
                <div className="text-xs text-muted-foreground">{t("pulse_active_users_now")}</div>
                <div className="text-2xl font-bold text-primary tabular-nums">{ut.toLocaleString()}</div>
              </div>
            )}
            <button
              onClick={handleExport}
              className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              {t("pulse_export")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {specialty && (
          <div className="text-xs text-muted-foreground">
            {t("pulse_specialty_lens")}: <span className="text-primary font-medium">{specialty}</span>
          </div>
        )}

        {bySector.length === 0 ? (
          <p className="text-muted-foreground">{t("pulse_no_data")}</p>
        ) : (
          bySector.map(([sector, rows]) => (
            <section key={sector}>
              <h2 className="text-lg font-bold mb-3 capitalize text-primary">{sector}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {rows.map((m) => (
                  <div key={m.id} className="rounded-xl border border-border bg-card/50 p-4">
                    <div className="text-xs text-muted-foreground">{m.metric_key}</div>
                    <div className="text-xl font-bold tabular-nums mt-1">
                      {m.value !== null ? m.value.toLocaleString() : "—"}
                      {m.unit && <span className="text-xs text-muted-foreground ms-1">{m.unit}</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-2">
                      {new Date(m.captured_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

        {apps.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-3 text-primary">{t("pulse_trending_apps")}</h2>
            <ol className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {apps.map((a) => (
                <li key={a.id} className="rounded-lg border border-border bg-card/50 px-3 py-2 flex items-center gap-3">
                  <span className="text-primary font-bold w-6">{a.rank}</span>
                  <div className="flex-1">
                    <div className="font-medium">{a.app_name}</div>
                    {a.category && <div className="text-xs text-muted-foreground">{a.category}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        <footer className="border-t border-border pt-6 text-xs text-muted-foreground leading-relaxed">
          {t("pulse_disclaimer")}
        </footer>
      </main>
    </div>
  );
}
