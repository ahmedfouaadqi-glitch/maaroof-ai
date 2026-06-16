import { useEffect, useState } from "react";
import { useI18n, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, TrendingUp, Target, Rocket } from "lucide-react";
import { ToolLangSelect } from "./ToolLangSelect";

import { ToolHelpBanner } from "./ToolHelpBanner";
import { GeoScopeSelector, getEffectiveScope } from "./GeoScopeSelector";
import type { ExportPayload, ExportSection } from "@/lib/exports";
import { HandoffMenu } from "@/components/HandoffMenu";
import { ProactiveNextStep } from "@/components/ProactiveNextStep";
import { summarizeInput, summarizeOutput } from "@/lib/cognition-summary";
import { consumeHandoff } from "@/lib/tool-handoff";
import { apiFetch } from "@/lib/api-client";
import { SourcesList } from "@/components/SourcesList";


export function BizDev() {
  const { t, lang } = useI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const [outLang, setOutLang] = useState<Lang>(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [form, setForm] = useState({
    business_name: "", stage: "", sector: "", city: "",
    current_revenue_iqd: "", monthly_customers: "", team_size: "",
    channels: "", goals: "", challenges: "", budget_iqd: "", notes: "",
  });
  const upd = (k: keyof typeof form) => (e: any) => setForm((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    const apply = (txt: string) => setForm((p) => ({ ...p, notes: (p.notes ? p.notes + "\n\n" : "") + txt.slice(0, 4000) }));
    const onReuse = (e: Event) => { const t = (e as CustomEvent).detail?.text; if (t) apply(String(t)); };
    window.addEventListener("geo:reuse-bizdev", onReuse);
    const pending = consumeHandoff("bizdev");
    if (pending) apply(pending);
    return () => window.removeEventListener("geo:reuse-bizdev", onReuse);
  }, []);

  const run = async () => {
    setError(null); setResult(null);
    if (form.business_name.trim().length < 2) { setError(t("biz_err_name")); return; }
    setBusy(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const session = (await supabase.auth.getSession()).data.session;
      if (session) headers.Authorization = `Bearer ${session.access_token}`;
      const r = await apiFetch("/api/bizdev", { method: "POST", headers, body: JSON.stringify({ ...form, lang: outLang, scope: getEffectiveScope(auth?.profile, "bizdev") }) });
      const data = await r.json();
      if (!r.ok) { setError(data?.error || "error"); return; }
      setResult(data.result);
      auth?.refreshProfile();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const buildExport = (): ExportPayload => {
    if (!result) return { title: t("biz_title"), sections: [] };
    const sections: ExportSection[] = [
      { kind: "kv", heading: t("biz_summary"), rows: [
        [t("biz_score"), `${result.growth_score}/100`],
        [t("biz_north_star"), result.north_star_metric],
      ]},
      { kind: "text", heading: t("biz_stage"), text: result.stage_assessment },
      { kind: "list", heading: "SWOT — " + t("biz_strengths"), list: result.swot.strengths },
      { kind: "list", heading: "SWOT — " + t("biz_weaknesses"), list: result.swot.weaknesses },
      { kind: "list", heading: "SWOT — " + t("biz_opportunities"), list: result.swot.opportunities },
      { kind: "list", heading: "SWOT — " + t("biz_threats"), list: result.swot.threats },
      { kind: "table", heading: t("biz_levers"), table: {
        columns: [t("biz_lever"), t("biz_impact"), t("biz_effort"), t("biz_outcome")],
        data: result.growth_levers.map((l: any) => [l.title, l.impact, l.effort, l.expected_outcome]),
      }},
      { kind: "table", heading: t("biz_channels"), table: {
        columns: [t("biz_channel"), t("biz_fit"), t("biz_budget"), t("biz_kpi"), t("biz_first_action")],
        data: result.channel_plan.map((c: any) => [c.channel, c.fit, c.monthly_budget_iqd, c.primary_kpi, c.first_action]),
      }},
      { kind: "list", heading: t("biz_roadmap_1_3"), list: result.roadmap.month_1_3 },
      { kind: "list", heading: t("biz_roadmap_4_6"), list: result.roadmap.month_4_6 },
      { kind: "list", heading: t("biz_roadmap_7_12"), list: result.roadmap.month_7_12 },
      { kind: "list", heading: t("biz_quick_wins"), list: result.quick_wins },
    ];
    return { title: t("biz_title"), subtitle: form.business_name, sections };
  };

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5 shadow-[var(--shadow-elevated)] backdrop-blur-xl md:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="size-4 text-primary" />
          <span className="font-mono uppercase tracking-widest text-xs">{t("biz_title")}</span>
        </div>
        <ToolLangSelect value={outLang} onChange={setOutLang} />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("biz_desc")}</p>
      <ToolHelpBanner toolKey="bizdev" />
      <div className="mt-3"><GeoScopeSelector compact toolKey="bizdev" /></div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("biz_f_name")} value={form.business_name} onChange={upd("business_name")} />
        <Field label={t("biz_f_stage")} value={form.stage} onChange={upd("stage")} placeholder="idea / mvp / early-revenue / growth" />
        <Field label={t("biz_f_sector")} value={form.sector} onChange={upd("sector")} />
        <Field label={t("biz_f_city")} value={form.city} onChange={upd("city")} />
        <Field label={t("biz_f_revenue")} value={form.current_revenue_iqd} onChange={upd("current_revenue_iqd")} type="number" />
        <Field label={t("biz_f_customers")} value={form.monthly_customers} onChange={upd("monthly_customers")} type="number" />
        <Field label={t("biz_f_team")} value={form.team_size} onChange={upd("team_size")} type="number" />
        <Field label={t("biz_f_budget")} value={form.budget_iqd} onChange={upd("budget_iqd")} type="number" />
        <Field label={t("biz_f_channels")} value={form.channels} onChange={upd("channels")} className="md:col-span-2" />
        <Field label={t("biz_f_goals")} value={form.goals} onChange={upd("goals")} textarea className="md:col-span-2" />
        <Field label={t("biz_f_challenges")} value={form.challenges} onChange={upd("challenges")} textarea className="md:col-span-2" />
        <Field label={t("biz_f_notes")} value={form.notes} onChange={upd("notes")} textarea className="md:col-span-2" />
      </div>

      <div className="mt-4 flex justify-end">
        <button onClick={run} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:scale-[1.02] disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy ? t("biz_running") : t("biz_run")}
        </button>
      </div>

      {error && <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-display text-xl font-bold text-primary-foreground">{result.growth_score}</div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("biz_north_star")}</div>
                <div className="font-display text-base font-bold">{result.north_star_metric || "—"}</div>
              </div>
            </div>
            
          </div>

          {result.stage_assessment && <div className="rounded-xl border border-border bg-background/60 p-4 text-sm">{result.stage_assessment}</div>}

          <div className="grid gap-3 md:grid-cols-2">
            <SwotBox title={t("biz_strengths")} items={result.swot.strengths} cls="border-success/30 bg-success/5" />
            <SwotBox title={t("biz_weaknesses")} items={result.swot.weaknesses} cls="border-destructive/30 bg-destructive/5" />
            <SwotBox title={t("biz_opportunities")} items={result.swot.opportunities} cls="border-primary/30 bg-primary/5" />
            <SwotBox title={t("biz_threats")} items={result.swot.threats} cls="border-accent/30 bg-accent/5" />
          </div>

          {result.growth_levers?.length > 0 && (
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground"><Rocket className="size-4" /> {t("biz_levers")}</div>
              <ul className="space-y-2 text-sm">
                {result.growth_levers.map((l: any, i: number) => (
                  <li key={i} className="rounded-lg border border-border bg-background/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <b>{l.title}</b>
                      <div className="flex gap-1 text-[10px]"><Pill v={l.impact} label={t("biz_impact")} /><Pill v={l.effort} label={t("biz_effort")} /></div>
                    </div>
                    <div className="mt-1 text-xs text-foreground/80">→ {l.expected_outcome}</div>
                    {l.how_to?.length > 0 && <ol className="mt-1 ms-5 list-decimal text-xs text-muted-foreground">{l.how_to.map((s: string, j: number) => <li key={j}>{s}</li>)}</ol>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.channel_plan?.length > 0 && (
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{t("biz_channels")}</div>
              <div className="grid gap-2 md:grid-cols-2">
                {result.channel_plan.map((c: any, i: number) => (
                  <div key={i} className="rounded-lg border border-border bg-background/60 p-3 text-xs">
                    <div className="flex items-center justify-between"><b>{c.channel}</b><Pill v={c.fit} label={t("biz_fit")} /></div>
                    <div className="mt-1"><b>{t("biz_budget")}:</b> {c.monthly_budget_iqd}</div>
                    <div><b>{t("biz_kpi")}:</b> {c.primary_kpi}</div>
                    <div className="mt-1 text-foreground/80">▶ {c.first_action}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <Phase title={t("biz_roadmap_1_3")} items={result.roadmap.month_1_3} />
            <Phase title={t("biz_roadmap_4_6")} items={result.roadmap.month_4_6} />
            <Phase title={t("biz_roadmap_7_12")} items={result.roadmap.month_7_12} />
          </div>

          {result.quick_wins?.length > 0 && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-accent"><Target className="size-4" /> {t("biz_quick_wins")}</div>
              <ol className="ms-5 list-decimal space-y-1 text-sm">{result.quick_wins.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol>
            </div>
          )}

          <HandoffMenu source="bizdev" getText={() => `${form.business_name}\n${result.stage_assessment || ""}\n\n${(result.quick_wins || []).join("\n")}`} />
          <ProactiveNextStep
            toolKey="bizdev"
            inputSummary={summarizeInput(form)}
            outputSummary={summarizeOutput(result)}
            handoffText={`${form.business_name}\n${result.stage_assessment || ""}`}
          />
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, textarea, type = "text", className = "", placeholder }: any) {
  return (
    <label className={`block text-xs ${className}`}>
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={onChange} rows={2} placeholder={placeholder} className="w-full rounded-xl border border-border bg-background/60 p-2.5 text-sm outline-none focus:border-primary" />
      ) : (
        <input value={value} onChange={onChange} type={type} placeholder={placeholder} className="w-full rounded-xl border border-border bg-background/60 p-2.5 text-sm outline-none focus:border-primary" />
      )}
    </label>
  );
}
function SwotBox({ title, items, cls }: any) {
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
      {items?.length ? <ul className="ms-4 list-disc text-xs">{items.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul> : <p className="text-xs text-muted-foreground">—</p>}
    </div>
  );
}
function Phase({ title, items }: any) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="mb-1 text-[10px] uppercase tracking-widest text-primary">{title}</div>
      {items?.length ? <ol className="ms-4 list-decimal text-xs">{items.map((x: string, i: number) => <li key={i}>{x}</li>)}</ol> : <p className="text-xs text-muted-foreground">—</p>}
    </div>
  );
}
function Pill({ v, label }: { v: string; label: string }) {
  const c = v === "high" ? "bg-success/20 text-success" : v === "low" ? "bg-muted text-muted-foreground" : "bg-accent/20 text-accent";
  return <span className={`rounded-full px-2 py-0.5 ${c}`}>{label}: {v}</span>;
}
