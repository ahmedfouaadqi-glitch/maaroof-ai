import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { usePulseI18n } from "@/lib/pulse-i18n";
import { triggerPulseCrawl } from "@/lib/pulse.functions";
import { PulseSubNav } from "@/components/PulseSubNav";

export const Route = createFileRoute("/admin/pulse")({
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <AdminPulse />
      </AuthProvider>
    </I18nProvider>
  ),
});

type LogRow = {
  id: string; source_id: string | null; started_at: string; finished_at: string | null;
  status: string; rows_inserted: number | null; error: string | null;
};
type Src = { id: string; key: string; name_ar: string; last_success_at: string | null };

function AdminPulse() {
  const { t, dir } = usePulseI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch { /* no provider */ }
  const trigger = useServerFn(triggerPulseCrawl);

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [sources, setSources] = useState<Src[]>([]);
  const [bridgeOn, setBridgeOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const refresh = async () => {
    const [{ data: l }, { data: s }, { data: cfg }] = await Promise.all([
      supabase.from("pulse_scrape_log").select("*").order("started_at", { ascending: false }).limit(30),
      supabase.from("pulse_sources").select("id, key, name_ar, last_success_at"),
      supabase.from("pulse_app_config").select("value").eq("key", "geoiraq_bridge_enabled").maybeSingle(),
    ]);
    setLogs((l ?? []) as LogRow[]);
    setSources((s ?? []) as Src[]);
    setBridgeOn(Boolean((cfg?.value as any)?.enabled));
  };

  useEffect(() => { void refresh(); }, []);

  if (auth && !auth.loading && !auth.isAdmin) {
    return <Navigate to="/dashboard" />;
  }

  const runCrawl = async (sourceKey?: string) => {
    setBusy(true); setMsg("");
    try {
      const r = await trigger({ data: sourceKey ? { sourceKey } : {} });
      setMsg(`status ${r.status ?? "?"}: ${("body" in r ? r.body : r.error) ?? ""}`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggleBridge = async () => {
    const next = !bridgeOn;
    await supabase.from("pulse_app_config").upsert({
      key: "geoiraq_bridge_enabled",
      value: { enabled: next },
    });
    setBridgeOn(next);
  };

  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">← Admin</Link>
            <h1 className="text-3xl font-extrabold mt-1">{t("pulse_brand")} — {t("pulse_admin")}</h1>
          </div>
          <button
            onClick={() => runCrawl()}
            disabled={busy}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "…" : t("pulse_run_crawl_now")}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        <PulseSubNav />
        {msg && <div className="rounded-lg border border-border bg-card/50 p-3 text-xs font-mono">{msg}</div>}

        <section>
          <h2 className="text-lg font-bold mb-3">{t("pulse_bridge_geoiraq")}</h2>
          <button
            onClick={toggleBridge}
            className={`rounded-full px-4 py-2 text-sm border ${bridgeOn ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
          >
            {bridgeOn ? t("pulse_bridge_on") : t("pulse_bridge_off")}
          </button>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-3">{t("pulse_sources")}</h2>
          <ul className="space-y-2">
            {sources.map((s) => (
              <li key={s.id} className="rounded-lg border border-border bg-card/50 p-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-medium">{s.name_ar}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.last_success_at ? new Date(s.last_success_at).toLocaleString() : "—"}
                  </div>
                </div>
                <button
                  onClick={() => runCrawl(s.key)}
                  disabled={busy}
                  className="text-xs rounded-full border border-border px-3 py-1.5 hover:bg-muted/40"
                >
                  {t("pulse_run_crawl_now")}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-3">{t("pulse_scrape_log")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-start p-2">started</th>
                  <th className="text-start p-2">status</th>
                  <th className="text-start p-2">rows</th>
                  <th className="text-start p-2">error</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border/30">
                    <td className="p-2">{new Date(l.started_at).toLocaleString()}</td>
                    <td className={`p-2 ${l.status === "error" ? "text-destructive" : "text-green-500"}`}>{l.status}</td>
                    <td className="p-2 tabular-nums">{l.rows_inserted ?? 0}</td>
                    <td className="p-2 text-destructive">{l.error?.slice(0, 80) ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
