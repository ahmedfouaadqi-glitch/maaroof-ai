import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Save, RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ExportButtons } from "@/components/ExportButtons";
import type { ExportPayload } from "@/lib/exports";
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
} from "recharts";

const METRICS = [
  { id: "analyses", label: "تحليلات GEO" },
  { id: "suggestions", label: "اقتراحات المنشورات" },
  { id: "strategies", label: "استراتيجيات GEO" },
  { id: "whatif", label: "سيناريوهات What-If" },
  { id: "watch", label: "مراقبة المنافسين" },
  { id: "activity", label: "سجل النشاط" },
];

type ChartType = "line" | "bar" | "radar";

function range(days: number) {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}

function bucketByDay(rows: any[]): { day: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = (r.created_at || "").slice(0, 10);
    if (!d) continue;
    map.set(d, (map.get(d) || 0) + 1);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count }));
}

export function ReportBuilder() {
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const user = auth?.user;
  const [selected, setSelected] = useState<string[]>(["analyses", "activity"]);
  const [days, setDays] = useState(30);
  const [title, setTitle] = useState("تقرير مخصّص");
  const [chart, setChart] = useState<ChartType>("bar");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Record<string, any[]>>({});
  const [templates, setTemplates] = useState<any[]>([]);
  const [tplName, setTplName] = useState("");

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

  async function loadTemplates() {
    if (!user) return;
    const { data: rows } = await supabase.from("report_templates").select("*").order("updated_at", { ascending: false });
    setTemplates(rows || []);
  }

  useEffect(() => { loadData(); loadTemplates(); /* eslint-disable-next-line */ }, [user]);

  async function saveTemplate() {
    if (!user || !tplName.trim()) return;
    await supabase.from("report_templates").insert({ user_id: user.id, name: tplName.trim(), config: { selected, days, chart, title } });
    setTplName("");
    loadTemplates();
  }
  function applyTemplate(t: any) {
    const c = t.config || {};
    if (Array.isArray(c.selected)) setSelected(c.selected);
    if (c.days) setDays(c.days);
    if (c.chart) setChart(c.chart);
    if (c.title) setTitle(c.title);
    setTimeout(loadData, 50);
  }
  async function delTemplate(id: string) {
    await supabase.from("report_templates").delete().eq("id", id);
    loadTemplates();
  }

  // Aggregated chart data: one series per selected metric, x = day
  const chartData = useMemo(() => {
    const byDay: Record<string, any> = {};
    for (const k of selected) {
      const series = bucketByDay(data[k] || []);
      for (const { day, count } of series) {
        if (!byDay[day]) byDay[day] = { day };
        byDay[day][k] = count;
      }
    }
    return Object.values(byDay).sort((a: any, b: any) => a.day.localeCompare(b.day));
  }, [data, selected]);

  // Radar: total per metric
  const radarData = useMemo(
    () => selected.map((k) => ({ metric: METRICS.find((m) => m.id === k)?.label || k, value: (data[k] || []).length })),
    [data, selected],
  );

  const palette = ["hsl(var(--primary))", "hsl(var(--accent))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  const payload = useMemo<() => ExportPayload>(() => () => {
    const sections: any[] = [];
    for (const k of selected) {
      const rows = data[k] || [];
      const label = METRICS.find((m) => m.id === k)?.label || k;
      if (rows.length === 0) {
        sections.push({ kind: "text", heading: label, text: "لا توجد بيانات في هذه الفترة." });
        continue;
      }
      const cols = Object.keys(rows[0]).filter((c) => !["user_id", "id"].includes(c)).slice(0, 6);
      sections.push({
        kind: "table",
        heading: label,
        table: {
          columns: cols,
          data: rows.slice(0, 50).map((r) => cols.map((c) => {
            const v = (r as any)[c];
            if (v == null) return "";
            if (typeof v === "object") return JSON.stringify(v).slice(0, 120);
            return String(v).slice(0, 200);
          })),
        },
      });
    }
    sections.push({ kind: "kv", heading: "ملخّص", rows: selected.map((k) => [METRICS.find((m) => m.id === k)?.label || k, (data[k] || []).length]) });
    return { title, sections };
  }, [selected, data, title]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileText className="size-4 text-primary"/> منشئ التقارير المخصّصة</div>
        <p className="mb-3 text-xs text-muted-foreground">اختر المقاييس، نوع الرسم، الفترة، ثم صدّر PDF/Excel/CSV — أو احفظ كقالب لإعادة الاستخدام.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان التقرير" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {[7, 30, 90, 180, 365].map((d) => <option key={d} value={d}>آخر {d} يوم</option>)}
          </select>
          <select value={chart} onChange={(e) => setChart(e.target.value as ChartType)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="bar">عمودي</option>
            <option value="line">خطّي</option>
            <option value="radar">رادار</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button key={m.id} onClick={() => toggle(m.id)} className={`rounded-full px-3 py-1 text-xs border ${selected.includes(m.id) ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{m.label}</button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={loadData} disabled={busy} className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-1.5 text-xs">
            {busy ? <Loader2 className="size-3 animate-spin"/> : <RefreshCw className="size-3"/>} تحديث المعاينة
          </button>
          <ExportButtons build={payload} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="اسم القالب" className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs" />
          <button onClick={saveTemplate} disabled={!tplName.trim()} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary disabled:opacity-50">
            <Save className="size-3"/> حفظ قالب
          </button>
          {templates.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px]">
              <button onClick={() => applyTemplate(t)} className="hover:text-primary">{t.name}</button>
              <button onClick={() => delTemplate(t.id)} className="text-destructive hover:opacity-70"><Trash2 className="size-3"/></button>
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-3">
        <div className="mb-2 text-xs font-semibold">المعاينة المرئية</div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chart === "bar" ? (
              <BarChart data={chartData}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <RTooltip />
                {selected.map((k, i) => <Bar key={k} dataKey={k} fill={palette[i % palette.length]} name={METRICS.find((m) => m.id === k)?.label} />)}
              </BarChart>
            ) : chart === "line" ? (
              <LineChart data={chartData}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <RTooltip />
                {selected.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={palette[i % palette.length]} strokeWidth={2} dot={false} name={METRICS.find((m) => m.id === k)?.label} />)}
              </LineChart>
            ) : (
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                <Radar dataKey="value" stroke={palette[0]} fill={palette[0]} fillOpacity={0.35} />
                <RTooltip />
              </RadarChart>
            )}
          </ResponsiveContainer>
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
