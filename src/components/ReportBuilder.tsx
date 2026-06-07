import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Save, RefreshCw, Trash2, BarChart3, LineChart as LineIcon, Radar as RadarIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ExportButtons } from "@/components/ExportButtons";
import type { ExportPayload } from "@/lib/exports";
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type MetricId = "suggestions" | "strategies" | "whatif" | "watch" | "visibility" | "compare";
type ChartType = "bar" | "line" | "radar";

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
  const { t } = useI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const user = auth?.user;

  const METRICS: { id: MetricId; label: string; table: string }[] = [
    { id: "suggestions", label: t("report_metric_suggestions"), table: "suggestions" },
    { id: "strategies", label: t("report_metric_strategies"), table: "geo_strategies" },
    { id: "whatif", label: t("report_metric_whatif"), table: "whatif_scenarios" },
    { id: "watch", label: t("report_metric_watch"), table: "competitor_watch" },
    { id: "visibility", label: t("report_metric_visibility"), table: "analyses" },
    { id: "compare", label: t("report_metric_compare"), table: "brand_boost_runs" },
  ];

  const [selected, setSelected] = useState<MetricId[]>(["suggestions", "visibility"]);
  const [days, setDays] = useState(30);
  const [title, setTitle] = useState(t("report_title_default"));
  const [chart, setChart] = useState<ChartType>("bar");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Record<string, any[]>>({});
  const [templates, setTemplates] = useState<any[]>([]);
  const [tplName, setTplName] = useState("");

  function toggle(id: MetricId) { setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]); }

  async function loadData() {
    if (!user) return;
    setBusy(true);
    const since = range(days);
    const out: Record<string, any[]> = {};
    for (const k of selected) {
      const m = METRICS.find((x) => x.id === k);
      if (!m) continue;
      try {
        const { data: rows } = await supabase.from(m.table as any).select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(200);
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
  function applyTemplate(tpl: any) {
    const c = tpl.config || {};
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
        sections.push({ kind: "text", heading: label, text: t("report_no_data") });
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
    sections.push({ kind: "kv", heading: t("report_preview_title"), rows: selected.map((k) => [METRICS.find((m) => m.id === k)?.label || k, (data[k] || []).length]) });
    return { title, sections };
  }, [selected, data, title, t]);

  const chartButtons: { id: ChartType; label: string; Icon: any }[] = [
    { id: "bar", label: t("report_chart_bar"), Icon: BarChart3 },
    { id: "line", label: t("report_chart_line"), Icon: LineIcon },
    { id: "radar", label: t("report_chart_radar"), Icon: RadarIcon },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card/60 to-card/30 p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileText className="size-4 text-primary"/> {t("dash_tool_report_t")}</div>
        <p className="mb-3 text-xs text-muted-foreground">{t("report_intro")}</p>

        <div className="grid gap-2 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("report_title_label")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {[7, 30, 90, 180, 365].map((d) => <option key={d} value={d}>{t("report_period_last").replace("{n}", String(d))}</option>)}
          </select>
        </div>

        {/* Metric pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button key={m.id} onClick={() => toggle(m.id)} className={`rounded-full px-3 py-1 text-xs border transition ${selected.includes(m.id) ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border hover:border-primary/40"}`}>{m.label}</button>
          ))}
        </div>

        {/* Chart-type segmented */}
        <div className="mt-3 inline-flex rounded-full border border-border bg-background p-1">
          {chartButtons.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setChart(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${chart === id ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={loadData} disabled={busy} className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-1.5 text-xs hover:border-primary/40">
            {busy ? <Loader2 className="size-3 animate-spin"/> : <RefreshCw className="size-3"/>} {t("report_refresh")}
          </button>
          <ExportButtons build={payload} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder={t("report_tpl_name_ph")} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs" />
          <button onClick={saveTemplate} disabled={!tplName.trim()} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary disabled:opacity-50">
            <Save className="size-3"/> {t("report_tpl_save")}
          </button>
          {templates.map((tpl) => (
            <span key={tpl.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px]">
              <button onClick={() => applyTemplate(tpl)} className="hover:text-primary">{tpl.name}</button>
              <button onClick={() => delTemplate(tpl.id)} className="text-destructive hover:opacity-70"><Trash2 className="size-3"/></button>
            </span>
          ))}
        </div>
      </div>

      {/* Visual preview */}
      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">{t("report_preview_title")}</div>
          <div className="text-[11px] text-muted-foreground">{selected.length} · {chart}</div>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chart === "bar" ? (
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {selected.map((k, i) => <Bar key={k} dataKey={k} fill={palette[i % palette.length]} name={METRICS.find((m) => m.id === k)?.label} radius={[4, 4, 0, 0]} />)}
              </BarChart>
            ) : chart === "line" ? (
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {selected.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={palette[i % palette.length]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name={METRICS.find((m) => m.id === k)?.label} />)}
              </LineChart>
            ) : (
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                <Radar dataKey="value" stroke={palette[0]} fill={palette[0]} fillOpacity={0.4} strokeWidth={2} />
                <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </RadarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Metric summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {selected.map((k, i) => {
          const rows = data[k] || [];
          const label = METRICS.find((m) => m.id === k)?.label;
          return (
            <div key={k} className="rounded-xl border border-border bg-card/40 p-4">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: palette[i % palette.length] }} />
                <div className="text-sm font-semibold">{label}</div>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <div className="font-display text-2xl font-bold text-gradient">{rows.length}</div>
                <div className="text-[11px] text-muted-foreground">/ {days}d</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
