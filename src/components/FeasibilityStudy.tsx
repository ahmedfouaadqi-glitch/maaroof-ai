import { useState } from "react";
import { useI18n, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, ClipboardList, AlertTriangle, Target } from "lucide-react";
import { ToolLangSelect } from "./ToolLangSelect";
import { ExportButtons } from "./ExportButtons";
import { ToolHelpBanner } from "./ToolHelpBanner";
import { GeoScopeSelector, getEffectiveScope } from "./GeoScopeSelector";
import type { ExportPayload, ExportSection } from "@/lib/exports";

type Result = any;

export function FeasibilityStudy() {
  const { t, lang } = useI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}

  const [outLang, setOutLang] = useState<Lang>(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const [form, setForm] = useState({
    project_name: "",
    sector: "",
    city: "",
    target_audience: "",
    problem: "",
    solution: "",
    budget_iqd: "",
    team_size: "",
    timeline_months: "",
    revenue_model: "",
    competitors: "",
    notes: "",
  });
  const upd = (k: keyof typeof form) => (e: any) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const run = async () => {
    setError(null); setResult(null);
    if (form.project_name.trim().length < 2) { setError(t("feas_err_name")); return; }
    setBusy(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const session = (await supabase.auth.getSession()).data.session;
      if (session) headers.Authorization = `Bearer ${session.access_token}`;
      const r = await fetch("/api/feasibility", { method: "POST", headers, body: JSON.stringify({ ...form, lang: outLang }) });
      const data = await r.json();
      if (!r.ok) { setError(data?.error || "error"); return; }
      setResult(data.result);
      auth?.refreshProfile();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const buildExport = (): ExportPayload => {
    if (!result) return { title: t("feas_title"), sections: [] };
    const sections: ExportSection[] = [
      { kind: "kv", heading: t("feas_summary"), rows: [
        [t("feas_score"), `${result.viability_score}/100`],
        [t("feas_verdict"), result.verdict],
        [t("feas_confidence"), result.confidence],
      ]},
      { kind: "text", heading: t("feas_executive"), text: result.executive_summary },
      { kind: "kv", heading: t("feas_market"), rows: [
        [t("col_score"), `${result.market.score}/100`],
        [t("feas_market_size"), result.market.size_estimate],
      ]},
      { kind: "list", heading: t("feas_demand"), list: result.market.demand_signals },
      { kind: "list", heading: t("feas_barriers"), list: result.market.barriers },
      { kind: "kv", heading: t("feas_financial"), rows: [
        [t("col_score"), `${result.financial.score}/100`],
        [t("feas_startup"), result.financial.startup_cost_iqd],
        [t("feas_burn"), result.financial.monthly_burn_iqd],
        [t("feas_breakeven"), result.financial.breakeven_months],
      ]},
      { kind: "list", heading: t("feas_revenue_assumptions"), list: result.financial.revenue_assumptions },
      { kind: "kv", heading: t("feas_operational"), rows: [[t("col_score"), `${result.operational.score}/100`]] },
      { kind: "list", heading: t("feas_team_needs"), list: result.operational.team_needs },
      { kind: "list", heading: t("feas_processes"), list: result.operational.key_processes },
      { kind: "list", heading: t("feas_infrastructure"), list: result.operational.infrastructure },
      { kind: "table", heading: t("feas_risks"), table: {
        columns: [t("feas_risk"), t("feas_severity"), t("feas_mitigation")],
        data: result.risks.map((r: any) => [r.risk, r.severity, r.mitigation]),
      }},
      { kind: "table", heading: t("feas_competitors"), table: {
        columns: [t("col_brand"), t("feas_strength"), t("feas_gap")],
        data: result.competitors.map((c: any) => [c.name, c.strength, c.gap]),
      }},
      { kind: "list", heading: t("feas_next_steps"), list: result.next_steps },
      { kind: "list", heading: t("feas_kpis"), list: result.kpis },
    ];
    return { title: t("feas_title"), subtitle: form.project_name, sections };
  };

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5 shadow-[var(--shadow-elevated)] backdrop-blur-xl md:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardList className="size-4 text-primary" />
          <span className="font-mono uppercase tracking-widest text-xs">{t("feas_title")}</span>
        </div>
        <ToolLangSelect value={outLang} onChange={setOutLang} />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("feas_desc")}</p>
      <ToolHelpBanner toolKey="feasibility" />
      <div className="mt-3"><GeoScopeSelector compact toolKey="feasibility" /></div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("feas_f_name")} value={form.project_name} onChange={upd("project_name")} />
        <Field label={t("feas_f_sector")} value={form.sector} onChange={upd("sector")} />
        <Field label={t("feas_f_city")} value={form.city} onChange={upd("city")} />
        <Field label={t("feas_f_audience")} value={form.target_audience} onChange={upd("target_audience")} />
        <Field label={t("feas_f_problem")} value={form.problem} onChange={upd("problem")} textarea />
        <Field label={t("feas_f_solution")} value={form.solution} onChange={upd("solution")} textarea />
        <Field label={t("feas_f_budget")} value={form.budget_iqd} onChange={upd("budget_iqd")} type="number" />
        <Field label={t("feas_f_team")} value={form.team_size} onChange={upd("team_size")} type="number" />
        <Field label={t("feas_f_timeline")} value={form.timeline_months} onChange={upd("timeline_months")} type="number" />
        <Field label={t("feas_f_revenue")} value={form.revenue_model} onChange={upd("revenue_model")} />
        <Field label={t("feas_f_competitors")} value={form.competitors} onChange={upd("competitors")} className="md:col-span-2" />
        <Field label={t("feas_f_notes")} value={form.notes} onChange={upd("notes")} textarea className="md:col-span-2" />
      </div>

      <div className="mt-4 flex justify-end">
        <button onClick={run} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:scale-[1.02] disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy ? t("feas_running") : t("feas_run")}
        </button>
      </div>

      {error && <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-display text-xl font-bold text-primary-foreground">
                {result.viability_score}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("feas_verdict")}</div>
                <div className="font-display text-lg font-bold">
                  <VerdictBadge v={result.verdict} /> · <span className="text-sm text-muted-foreground">{t("feas_confidence")}: {result.confidence}</span>
                </div>
              </div>
            </div>
            <ExportButtons build={buildExport} />
          </div>

          <div className="rounded-xl border border-border bg-background/60 p-4 text-sm leading-relaxed">{result.executive_summary}</div>

          <div className="grid gap-3 md:grid-cols-3">
            <Sub heading={t("feas_market")} score={result.market.score}>
              <p className="text-xs text-foreground/80">{result.market.size_estimate}</p>
              <Bullets label={t("feas_demand")} items={result.market.demand_signals} ok />
              <Bullets label={t("feas_barriers")} items={result.market.barriers} bad />
            </Sub>
            <Sub heading={t("feas_financial")} score={result.financial.score}>
              <KV k={t("feas_startup")} v={result.financial.startup_cost_iqd} />
              <KV k={t("feas_burn")} v={result.financial.monthly_burn_iqd} />
              <KV k={t("feas_breakeven")} v={result.financial.breakeven_months} />
              <Bullets label={t("feas_revenue_assumptions")} items={result.financial.revenue_assumptions} />
            </Sub>
            <Sub heading={t("feas_operational")} score={result.operational.score}>
              <Bullets label={t("feas_team_needs")} items={result.operational.team_needs} />
              <Bullets label={t("feas_processes")} items={result.operational.key_processes} />
              <Bullets label={t("feas_infrastructure")} items={result.operational.infrastructure} />
            </Sub>
          </div>

          {result.risks?.length > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-destructive">
                <AlertTriangle className="size-4" /> {t("feas_risks")}
              </div>
              <ul className="space-y-1.5 text-xs">
                {result.risks.map((r: any, i: number) => (
                  <li key={i}><b className={sevColor(r.severity)}>[{r.severity}]</b> {r.risk} → <span className="text-foreground/70">{r.mitigation}</span></li>
                ))}
              </ul>
            </div>
          )}

          {result.competitors?.length > 0 && (
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{t("feas_competitors")}</div>
              <ul className="grid gap-2 md:grid-cols-2">
                {result.competitors.map((c: any, i: number) => (
                  <li key={i} className="rounded-lg border border-border bg-background/60 p-2 text-xs">
                    <div className="font-semibold">{c.name}</div>
                    <div><b className="text-success">+</b> {c.strength}</div>
                    <div><b className="text-primary">▶</b> {c.gap}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.next_steps?.length > 0 && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-accent"><Target className="size-4" /> {t("feas_next_steps")}</div>
              <ol className="ms-5 list-decimal space-y-1 text-sm">{result.next_steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol>
            </div>
          )}

          {result.kpis?.length > 0 && (
            <div className="rounded-xl border border-border bg-background/40 p-4 text-xs">
              <div className="mb-2 uppercase tracking-widest text-muted-foreground">{t("feas_kpis")}</div>
              <ul className="ms-4 list-disc space-y-0.5">{result.kpis.map((k: string, i: number) => <li key={i}>{k}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, textarea, type = "text", className = "" }: any) {
  return (
    <label className={`block text-xs ${className}`}>
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={onChange} rows={2} className="w-full rounded-xl border border-border bg-background/60 p-2.5 text-sm outline-none focus:border-primary" />
      ) : (
        <input value={value} onChange={onChange} type={type} className="w-full rounded-xl border border-border bg-background/60 p-2.5 text-sm outline-none focus:border-primary" />
      )}
    </label>
  );
}
function VerdictBadge({ v }: { v: string }) {
  const map: any = {
    "go": "bg-success/20 text-success",
    "pivot": "bg-accent/20 text-accent",
    "no-go": "bg-destructive/20 text-destructive",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${map[v] || ""}`}>{v}</span>;
}
function sevColor(s: string) { return s === "high" ? "text-destructive" : s === "medium" ? "text-accent" : "text-muted-foreground"; }
function Sub({ heading, score, children }: any) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{heading}</span><span className="font-mono font-bold text-primary">{score}/100</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Bullets({ label, items, ok, bad }: any) {
  if (!items?.length) return null;
  return (
    <div className="text-[11px]"><b className={ok ? "text-success" : bad ? "text-destructive" : "text-foreground/80"}>{label}:</b>
      <ul className="ms-4 list-disc">{items.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}
function KV({ k, v }: { k: string; v: string }) { return <div className="text-[11px]"><b className="text-foreground/80">{k}:</b> {v || "—"}</div>; }
