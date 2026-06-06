import { useEffect, useMemo, useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ExportButtons } from "@/components/ExportButtons";
import type { ExportPayload } from "@/lib/exports";

const METRICS = [
  { id: "analyses", label: "تحليلات GEO" },
  { id: "suggestions", label: "اقتراحات المنشورات" },
  { id: "strategies", label: "استراتيجيات GEO" },
  { id: "whatif", label: "سيناريوهات What-If" },
  { id: "watch", label: "مراقبة المنافسين" },
  { id: "activity", label: "سجل النشاط" },
];

function range(days: number) {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}

export function ReportBuilder() {
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const user = auth?.user;
  const [selected, setSelected] = useState<string[]>(["analyses", "activity"]);
  const [days, setDays] = useState(30);
  const [title, setTitle] = useState("تقرير مخصّص");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Record<string, any[]>>({});

  function toggle(id: string) { setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]); }

  async function loadData() {
    if (!user) return;
    setBusy(true);
    const since = range(days);
    const out: Record<string, any[]> = {};
    for (const k of selected) {
      try {
        const table = k === "watch" ? "competitor_watch" : k === "whatif" ? "whatif_scenarios" : k === "strategies" ? "geo_strategies" : k === "activity" ? "activity_log" : k;
        const { data: rows } = await supabase.from(table as any).select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(200);
        out[k] = rows || [];
      } catch { out[k] = []; }
    }
    setData(out);
    setBusy(false);
  }

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [user]);

  const payload = useMemo<() => ExportPayload>(() => () => {
    const sections: any[] = [];
    for (const k of selected) {
      const rows = data[k] || [];
      const label = METRICS.find((m) => m.id === k)?.label || k;
      if (rows.length === 0) {
        sections.push({ kind: "text", heading: label, body: "لا توجد بيانات في هذه الفترة." });
        continue;
      }
      const cols = Object.keys(rows[0]).filter((c) => !["user_id", "id"].includes(c)).slice(0, 6);
      sections.push({
        kind: "table",
        heading: label,
        columns: cols,
        rows: rows.slice(0, 50).map((r) => cols.map((c) => {
          const v = (r as any)[c];
          if (v == null) return "";
          if (typeof v === "object") return JSON.stringify(v).slice(0, 120);
          return String(v).slice(0, 200);
        })),
      });
    }
    return { title, sections };
  }, [selected, data, title]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileText className="size-4 text-primary"/> منشئ التقارير المخصّصة</div>
        <p className="mb-3 text-xs text-muted-foreground">اختر المقاييس والفترة الزمنية ثم صدّر بصيغة PDF / CSV.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان التقرير" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {[7, 30, 90, 180, 365].map((d) => <option key={d} value={d}>آخر {d} يوم</option>)}
          </select>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button key={m.id} onClick={() => toggle(m.id)} className={`rounded-full px-3 py-1 text-xs border ${selected.includes(m.id) ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{m.label}</button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={loadData} disabled={busy} className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-1.5 text-xs">
            {busy ? <Loader2 className="size-3 animate-spin"/> : <Download className="size-3"/>} تحديث المعاينة
          </button>
          <ExportButtons build={payload} />
        </div>
      </div>

      <div className="space-y-3">
        {selected.map((k) => {
          const rows = data[k] || [];
          return (
            <div key={k} className="rounded-lg border border-border bg-background/40 p-3 text-xs">
              <div className="mb-1 flex justify-between"><b>{METRICS.find((m) => m.id === k)?.label}</b><span className="text-muted-foreground">{rows.length} صف</span></div>
              {rows.length > 0 && <pre className="overflow-x-auto text-[10px] text-muted-foreground">{JSON.stringify(rows[0], null, 2).slice(0, 300)}...</pre>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
