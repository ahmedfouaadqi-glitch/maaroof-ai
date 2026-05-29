import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { usePulseI18n } from "@/lib/pulse-i18n";
import { PulseSubNav } from "@/components/PulseSubNav";

export const Route = createFileRoute("/pulse")({
  head: () => ({
    meta: [
      { title: "نبض — رصد محافظات العراق كل 12 ساعة" },
      { name: "description", content: "نظام نبض يجمع بيانات المحافظات العراقية الـ18 من المصادر الرسمية كل 12 ساعة." },
      { property: "og:title", content: "نبض — Iraq Pulse" },
      { property: "og:description", content: "رصد سيادي مباشر لمحافظات العراق." },
    ],
  }),
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <PulsePage />
      </AuthProvider>
    </I18nProvider>
  ),
});

type Gov = { id: string; slug: string; name_ar: string; name_en: string; population_base: number | null };
type App = { id: string; app_name: string; category: string | null; rank: number; captured_at: string };
type Src = { id: string; key: string; name_ar: string; last_success_at: string | null };

function PulsePage() {
  const { t, dir } = usePulseI18n();
  const [govs, setGovs] = useState<Gov[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [sources, setSources] = useState<Src[]>([]);
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [g, a, s] = await Promise.all([
        supabase.from("governorates").select("id,slug,name_ar,name_en,population_base").order("name_ar"),
        supabase.from("pulse_trending_apps").select("id,app_name,category,rank,captured_at").is("governorate_id", null).order("captured_at", { ascending: false }).limit(20),
        supabase.from("pulse_sources").select("id,key,name_ar,last_success_at").eq("active", true),
      ]);
      if (g.data) setGovs(g.data as Gov[]);
      if (a.data) setApps(a.data as App[]);
      if (s.data) setSources(s.data as Src[]);
    })();
    setHour(new Date().getHours());
    const timer = setInterval(() => setHour(new Date().getHours()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Uₜ rough preview: hour-curve × demo base. Computed client-only to avoid SSR/CSR hydration mismatch.
  const hourCurve = [0.35,0.25,0.18,0.15,0.18,0.25,0.45,0.65,0.80,0.85,0.88,0.92,0.95,0.90,0.85,0.88,0.95,1.05,1.20,1.35,1.40,1.30,1.05,0.70];
  const ut = hour === null ? null : Math.round(8000 * hourCurve[hour]);


  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{t("pulse_brand")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("pulse_tagline")}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{t("pulse_active_users_now")}</div>
            <div className="text-2xl font-bold text-primary tabular-nums">{ut === null ? "—" : ut.toLocaleString("en-US")}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-10">
        <PulseSubNav />
        <section>
          <h2 className="text-xl font-bold mb-4">المحافظات الـ18</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {govs.map((g) => (
              <Link
                key={g.id}
                to="/pulse/$gov"
                params={{ gov: g.slug }}
                className="rounded-xl border border-border bg-card/50 p-4 hover:bg-card/80 transition"
              >
                <div className="font-bold">{g.name_ar}</div>
                <div className="text-xs text-muted-foreground">{g.name_en}</div>
                {g.population_base && (
                  <div className="text-xs mt-2 text-primary">{(g.population_base / 1_000_000).toFixed(2)}M</div>
                )}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">{t("pulse_trending_apps")}</h2>
          {apps.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("pulse_no_data")}</p>
          ) : (
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
          )}
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">{t("pulse_sources")}</h2>
          <ul className="text-sm space-y-1">
            {sources.map((s) => (
              <li key={s.id} className="flex justify-between border-b border-border/50 py-2">
                <span>{s.name_ar}</span>
                <span className="text-muted-foreground text-xs">
                  {s.last_success_at ? new Date(s.last_success_at).toLocaleString() : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="border-t border-border pt-6 text-xs text-muted-foreground leading-relaxed">
          {t("pulse_disclaimer")}
        </footer>
      </main>
    </div>
  );
}
