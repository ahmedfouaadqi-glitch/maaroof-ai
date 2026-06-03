import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { usePulseI18n } from "@/lib/pulse-i18n";
import { triggerPulseCrawl, updatePulseSettings } from "@/lib/pulse.functions";
import { PulseSubNav } from "@/components/PulseSubNav";
import { PulseHint, PulseInfoCard } from "@/components/PulseInfo";

export const Route = createFileRoute("/admin_/pulse")({
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
  const saveSettings = useServerFn(updatePulseSettings);

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [sources, setSources] = useState<Src[]>([]);
  const [bridgeOn, setBridgeOn] = useState(false);
  const [pulseEnabled, setPulseEnabled] = useState(true);
  const [cronHours, setCronHours] = useState<number>(12);
  const [savingSettings, setSavingSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const refresh = async () => {
    const [{ data: l }, { data: s }, { data: cfgs }] = await Promise.all([
      supabase.from("pulse_scrape_log").select("*").order("started_at", { ascending: false }).limit(30),
      supabase.from("pulse_sources").select("id, key, name_ar, last_success_at"),
      supabase.from("pulse_app_config").select("key, value")
        .in("key", ["geoiraq_bridge_enabled", "pulse_enabled", "pulse_cron_hours"]),
    ]);
    setLogs((l ?? []) as LogRow[]);
    setSources((s ?? []) as Src[]);
    const cfgMap = new Map((cfgs ?? []).map((r: any) => [r.key, r.value]));
    setBridgeOn(Boolean((cfgMap.get("geoiraq_bridge_enabled") as any)?.enabled));
    const pe = cfgMap.get("pulse_enabled") as any;
    setPulseEnabled(pe?.enabled !== false); // default true
    const ph = cfgMap.get("pulse_cron_hours") as any;
    setCronHours(typeof ph?.hours === "number" ? ph.hours : 12);
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
        <div className="rounded-xl border-2 border-destructive/60 bg-destructive/10 p-4 text-sm">
          <div className="font-bold text-destructive mb-1">⛔ نبض موقوف بالكامل (Kill Switch مفعّل في الكود)</div>
          <div className="text-muted-foreground">
            تم تعطيل جميع عمليات الكشط، إلغاء جدولة cron، وتعطيل كل المصادر. الواجهة العامة تعرض شاشة "تحت الصيانة".
            لإعادة التشغيل: (1) أزل ثابت <code className="font-mono">PULSE_KILL_SWITCH</code> من
            <code className="font-mono"> src/routes/api/public/hooks/pulse-crawl.ts</code> ثم (2) فعّل "نبض نشط" أدناه.
          </div>
        </div>
        <PulseSubNav />


        <PulseInfoCard title="لوحة تحكم نبض (للمالك فقط)">
          من هنا تتحكم بنظام نبض بالكامل: تشغيل الكاشط يدوياً لمصدر معين أو لكل المصادر،
          تفعيل/إيقاف <b>جسر MAAROOF Ai</b>، ومتابعة سجل الكشط لمعرفة ما نجح وما فشل.
          الكشط التلقائي يعمل كل 12 ساعة عبر cron.
        </PulseInfoCard>

        {msg && <div className="rounded-lg border border-border bg-card/50 p-3 text-xs font-mono">{msg}</div>}

        <section className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
          <h2 className="text-lg font-bold">نشاط نظام نبض</h2>
          <PulseHint>
            تحكّم بتشغيل نظام نبض بالكامل وبفاصل الكشط التلقائي. عند الإيقاف يتم تعطيل
            cron تلقائياً، ويرفض الـ webhook أي محاولة كشط (يدوية كانت أو مجدوَلة).
          </PulseHint>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pulseEnabled}
                onChange={(e) => setPulseEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium">
                {pulseEnabled ? "نبض نشط" : "نبض موقوف"}
              </span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <span>فاصل الكشط:</span>
              <select
                value={cronHours}
                onChange={(e) => setCronHours(Number(e.target.value))}
                disabled={!pulseEnabled}
                className="rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
              >
                <option value={0}>إيقاف الجدولة</option>
                <option value={1}>كل ساعة</option>
                <option value={2}>كل ساعتين</option>
                <option value={3}>كل 3 ساعات</option>
                <option value={4}>كل 4 ساعات</option>
                <option value={6}>كل 6 ساعات</option>
                <option value={8}>كل 8 ساعات</option>
                <option value={12}>كل 12 ساعة</option>
                <option value={24}>كل 24 ساعة</option>
              </select>
            </label>

            <button
              onClick={async () => {
                setSavingSettings(true); setMsg("");
                try {
                  const r = await saveSettings({ data: { enabled: pulseEnabled, hours: cronHours } });
                  if (r.ok) {
                    setMsg(`✓ تم الحفظ — الجدولة: ${r.schedule}`);
                  } else {
                    setMsg(`✗ فشل: ${r.error}`);
                  }
                  await refresh();
                } finally {
                  setSavingSettings(false);
                }
              }}
              disabled={savingSettings}
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {savingSettings ? "…" : "حفظ"}
            </button>
          </div>
        </section>


        <section className="space-y-2">
          <h2 className="text-lg font-bold">{t("pulse_bridge_geoiraq")}</h2>
          <PulseHint>
            عند تفعيله، يتدفق بيانات نبض إلى وحدات MAAROOF Ai الأخرى (تحليل المحتوى،
            المساعد العام، إلخ). إذا كان معطلاً، يبقى نبض معزولاً.
          </PulseHint>
          <button
            onClick={toggleBridge}
            className={`rounded-full px-4 py-2 text-sm border ${bridgeOn ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
          >
            {bridgeOn ? t("pulse_bridge_on") : t("pulse_bridge_off")}
          </button>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold">{t("pulse_sources")}</h2>
          <PulseHint>
            اضغط <b>تشغيل الكشط الآن</b> بجانب أي مصدر لإجبار سحب فوري منه. وقت بجانب
            كل مصدر هو آخر نجاح. إذا لم يظهر وقت، فالكاشط لم ينجح بعد لهذا المصدر.
          </PulseHint>
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

        <section className="space-y-2">
          <h2 className="text-lg font-bold">{t("pulse_scrape_log")}</h2>
          <PulseHint>
            آخر 30 محاولة كشط. <b>status</b>: success/error، <b>rows</b>: عدد الصفوف
            المُدرجة في قاعدة البيانات، <b>error</b>: رسالة الخطأ إن وُجدت.
          </PulseHint>
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
