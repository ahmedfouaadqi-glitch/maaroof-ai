import { useEffect, useState } from "react";
import { Megaphone, Loader2, Plus, Power, Trash2 } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { ToolLangSelect } from "@/components/ToolLangSelect";
import { ToolHelpBanner } from "@/components/ToolHelpBanner";
import { GeoScopeSelector, getEffectiveScope } from "@/components/GeoScopeSelector";
import type { ExportPayload } from "@/lib/exports";
import { useI18n, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { HandoffMenu } from "@/components/HandoffMenu";
import { apiFetch } from "@/lib/api-client";

const PLATFORMS = ["chatgpt", "gemini", "claude", "perplexity", "copilot", "grok", "mistral", "deepseek"];

export function BrandBoostAgent() {
  const { t, lang } = useI18n();
  const [outLang, setOutLang] = useState<Lang>(lang);
  const { user, profile } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [brand, setBrand] = useState((profile as any)?.brand_name || "");
  const [kw, setKw] = useState((profile as any)?.brand_keywords || "");
  const [freq, setFreq] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [sel, setSel] = useState<string[]>(PLATFORMS);
  const [approved, setApproved] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [err, setErr] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("brand_boost_jobs").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setJobs(data || []);
  };
  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!user || !brand.trim() || !approved) return;
    await supabase.from("brand_boost_jobs").insert({
      user_id: user.id, brand_name: brand, brand_keywords: kw,
      platforms: sel, frequency: freq, approved: true, active: true,
    });
    await load();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("brand_boost_jobs").update({ active: !active }).eq("id", id);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm(t("boost_delete_confirm"))) return;
    await supabase.from("brand_boost_jobs").delete().eq("id", id);
    setReport(null);
    await load();
  };

  const buildExport = (j: any): ExportPayload => ({
    title: t("boost_export_title"),
    subtitle: j.brand_name,
    sections: [
      ...(report?.summary ? [{ heading: t("boost_summary"), kind: "text" as const, text: String(report.summary) }] : []),
      {
        heading: t("boost_title"),
        kind: "table" as const,
        table: {
          columns: [t("boost_platform"), t("boost_signal"), t("boost_actions")],
          data: (report?.plan || []).map((p: any) => [
            String(p.platform || ""),
            String(p.current_signal || ""),
            (p.recommended_actions || []).join(" • "),
          ]),
        },
      },
    ],
  });


  const runNow = async (j: any) => {
    setRunning(j.id); setErr(""); setReport(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await apiFetch("/api/brand-boost", {
        method: "POST", headers,
        body: JSON.stringify({ brand_name: j.brand_name, brand_keywords: j.brand_keywords, platforms: j.platforms, lang: outLang, scope: getEffectiveScope(profile, "brand") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed");
      setReport(data);
      await supabase.from("brand_boost_runs").insert({ job_id: j.id, user_id: user!.id, status: "done", report: data });
      await supabase.from("brand_boost_jobs").update({ last_run_at: new Date().toISOString() }).eq("id", j.id);
      await load();
    } catch (e: any) { setErr(e?.message || "failed"); }
    finally { setRunning(null); }
  };

  return (
    <div className="rounded-2xl border border-accent/30 bg-card/70 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Megaphone className="size-5 text-accent" /> {t("boost_title")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("boost_desc")}</p>
          <div className="mt-1 text-[11px] text-amber-600">{t("boost_addon_note")}</div>
          <ToolHelpBanner toolKey="brand" />
          <div className="mt-3"><GeoScopeSelector compact toolKey="brand" /></div>
        </div>
        <ToolLangSelect value={outLang} onChange={setOutLang} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t("boost_brand")}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
        <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder={t("boost_keywords")}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PLATFORMS.map((p) => (
          <button key={p} onClick={() => setSel(sel.includes(p) ? sel.filter(x => x !== p) : [...sel, p])}
            className={`rounded-full border px-2.5 py-1 text-xs ${sel.includes(p) ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"}`}>
            {p}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select value={freq} onChange={(e) => setFreq(e.target.value as any)}
          className="rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm">
          <option value="daily">{t("boost_freq_daily")}</option>
          <option value="weekly">{t("boost_freq_weekly")}</option>
          <option value="monthly">{t("boost_freq_monthly")}</option>
        </select>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
          {t("boost_approve")}
        </label>
        <button disabled={!approved || !brand.trim()} onClick={create}
          className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">
          <Plus className="size-3.5" /> {t("boost_create")}
        </button>
      </div>

      {jobs.length > 0 && (
        <div className="mt-4 space-y-2">
          {jobs.map((j) => (
            <div key={j.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{j.brand_name}</strong>
                <span className="text-xs text-muted-foreground">· {j.frequency}</span>
                <span className="text-[10px] text-muted-foreground">{j.platforms?.join(", ")}</span>
                <button onClick={() => toggle(j.id, j.active)} className="ms-auto inline-flex items-center gap-1 text-xs">
                  <Power className="size-3" /> {j.active ? t("boost_pause") : t("boost_resume")}
                </button>
                <button disabled={running === j.id} onClick={() => runNow(j)}
                  className="rounded-md bg-primary/15 px-2 py-1 text-xs font-semibold text-primary disabled:opacity-50">
                  {running === j.id ? <Loader2 className="inline size-3 animate-spin" /> : t("boost_run_now")}
                </button>
                <button onClick={() => remove(j.id)} title={t("boost_delete")}
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20">
                  <Trash2 className="inline size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {err && <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{err}</div>}
      {report && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-end">
            <ExportButtons build={() => buildExport(jobs[0] || { brand_name: brand })} />
          </div>
          {report.summary && <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">{report.summary}</div>}
          {(report.plan || []).map((p: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-background/40 p-3 text-xs">
              <strong className="text-foreground">{p.platform}</strong>
              <div className="mt-1 text-muted-foreground">{p.current_signal}</div>
              <ul className="mt-2 list-inside list-disc">
                {(p.recommended_actions || []).map((a: string, j: number) => <li key={j}>{a}</li>)}
              </ul>
            </div>
          ))}
          <HandoffMenu source="boost" getText={() => `${brand}\n${report.summary || ""}\n\n${(report.plan || []).map((p: any) => `${p.platform}: ${(p.recommended_actions || []).join(", ")}`).join("\n")}`} />
        </div>
      )}
    </div>
  );
}
