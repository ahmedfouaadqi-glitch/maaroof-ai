import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Trash2, Plus, Bell } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api-client";

async function call(action: string, payload: any = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await apiFetch("/api/competitor-monitor", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify({ action, ...payload }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "failed");
  return j;
}

export function CompetitorMonitor() {
  const { t } = useI18n();
  const { lang } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [brand, setBrand] = useState("");
  const [comps, setComps] = useState("");
  const [freq, setFreq] = useState(24);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    try { const j = await call("list"); setItems(j.items || []); } catch {}
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!brand.trim() || !comps.trim()) return;
    setBusy(true); setErr("");
    try {
      await call("create", { brand, competitors: comps.split(",").map((s) => s.trim()).filter(Boolean), frequency_hours: freq, lang });
      setBrand(""); setComps(""); await load();
    } catch (e: any) { setErr(e?.message || "failed"); } finally { setBusy(false); }
  }
  async function recheck(id: string) {
    try { await call("recheck", { id, lang }); await load(); } catch (e: any) { setErr(e?.message || "failed"); }
  }
  async function del(id: string) {
    if (!confirm(t("auto.delete_monitoring"))) return;
    try { await call("delete", { id }); await load(); } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Bell className="size-4 text-primary"/> مراقبة المنافسين</div>
        <p className="mb-3 text-xs text-muted-foreground">{t("auto.keeps_a_baseline_and_records_alerts")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t("auto.your_mark")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={comps} onChange={(e) => setComps(e.target.value)} placeholder={t("auto.competitors_separated_by_commas")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <label>{t("auto.all_hours")}</label>
          <select value={freq} onChange={(e) => setFreq(Number(e.target.value))} className="rounded border border-border bg-background px-2 py-1">
            {[6, 12, 24, 48, 168].map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <button onClick={add} disabled={busy || !brand.trim() || !comps.trim()} className="ml-auto inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="size-3 animate-spin"/> : <Plus className="size-3"/>} إضافة
          </button>
        </div>
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      </div>

      <div className="space-y-2">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{t("auto.no_monitors_yet")}</p> : items.map((w) => (
          <div key={w.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <b>{w.brand}</b> <span className="text-muted-foreground">مقابل {w.competitors.join(", ")}</span>
                <div className="text-xs text-muted-foreground">آخر فحص: {w.last_run_at ? new Date(w.last_run_at).toLocaleString() : "—"} · كل {w.frequency_hours}h</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => recheck(w.id)} className="rounded p-1.5 hover:bg-card" title={t("auto.rescan")}><RefreshCw className="size-4"/></button>
                <button onClick={() => del(w.id)} className="rounded p-1.5 text-destructive hover:bg-card"><Trash2 className="size-4"/></button>
              </div>
            </div>
            {w.alerts?.length > 0 && (
              <div className="mt-2 space-y-1">
                {w.alerts.slice(0, 5).map((a: any, i: number) => (
                  <div key={i} className="rounded border border-accent/30 bg-accent/5 px-2 py-1 text-xs">
                    <b>{a.target}</b>: {a.prev} → {a.now} ({a.delta > 0 ? "+" : ""}{a.delta}) · {new Date(a.at).toLocaleString()}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
