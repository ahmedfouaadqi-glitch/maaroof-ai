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
const MAX_PLATFORMS_PER_RUN = 5;

export function BrandBoostAgent() {
  const { t, lang } = useI18n();
  const [outLang, setOutLang] = useState<Lang>(lang);
  const { user, profile } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [brand, setBrand] = useState((profile as any)?.brand_name || "");
  const [kw, setKw] = useState((profile as any)?.brand_keywords || "");
  const [freq, setFreq] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [sel, setSel] = useState<string[]>(PLATFORMS.slice(0, MAX_PLATFORMS_PER_RUN));
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
    const platforms = sel.slice(0, MAX_PLATFORMS_PER_RUN);
    await supabase.from("brand_boost_jobs").insert({
      user_id: user.id, brand_name: brand, brand_keywords: kw,
      platforms, frequency: freq, approved: true, active: true,
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
        body: JSON.stringify({ brand_name: j.brand_name, brand_keywords: j.brand_keywords, platforms: (j.platforms || []).slice(0, MAX_PLATFORMS_PER_RUN), lang: outLang, scope: getEffectiveScope(profile, "brand") }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text.slice(0, 200) || `http_${res.status}` }; }
      if (!res.ok) throw new Error(data.error || `http_${res.status}`);
      setReport(data);
      await supabase.from("brand_boost_runs").insert({ job_id: j.id, user_id: user!.id, status: "done", report: data });
      await supabase.from("brand_boost_jobs").update({ last_run_at: new Date().toISOString() }).eq("id", j.id);
      await load();
    } catch (e: any) { setErr(e?.message || "failed"); }
    finally { setRunning(null); }
  };

  return (
    <div className="max-w-full overflow-hidden rounded-2xl border border-accent/30 bg-card/70 p-3 backdrop-blur sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold sm:text-lg">
            <Megaphone className="size-5 text-accent" /> {t("boost_title")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("boost_desc")}</p>
          <div className="mt-1 text-[11px] text-amber-600">{t("boost_addon_note")}</div>
          <ToolHelpBanner toolKey="brand" />
          <div className="mt-3"><GeoScopeSelector compact toolKey="brand" /></div>
        </div>
        <ToolLangSelect value={outLang} onChange={setOutLang} className="w-full flex-wrap sm:w-auto sm:justify-end" />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t("boost_brand")}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
        <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder={t("boost_keywords")}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PLATFORMS.map((p) => (
          <button key={p} onClick={() => setSel(sel.includes(p) ? sel.filter(x => x !== p) : [...sel, p].slice(0, MAX_PLATFORMS_PER_RUN))}
            className={`rounded-full border px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${sel.includes(p) ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"}`}
            disabled={!sel.includes(p) && sel.length >= MAX_PLATFORMS_PER_RUN}>
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
        <span className="text-[11px] text-muted-foreground">{sel.length}/{MAX_PLATFORMS_PER_RUN} · 5 credits</span>
        <button disabled={!approved || !brand.trim() || sel.length === 0} onClick={create}
          className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">
          <Plus className="size-3.5" /> {t("boost_create")}
        </button>
      </div>

      {jobs.length > 0 && (
        <div className="mt-4 space-y-2">
          {jobs.map((j) => (
            <div key={j.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="max-w-full break-words">{j.brand_name}</strong>
                <span className="text-xs text-muted-foreground">· {j.frequency}</span>
                <span className="max-w-full break-words text-[10px] text-muted-foreground">{j.platforms?.slice(0, MAX_PLATFORMS_PER_RUN).join(", ")}</span>
                <button onClick={() => toggle(j.id, j.active)} className="sm:ms-auto inline-flex items-center gap-1 text-xs">
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
            <div key={i} className="rounded-lg border border-border bg-background/40 p-3 text-xs space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-foreground uppercase">{p.platform}</strong>
                <span className="max-w-full break-all rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{p.model_used}</span>
                {p.is_proxy && <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600">proxy</span>}
                <span className="ms-auto rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{p.current_signal}</span>
              </div>
              {p.current_answer ? (
                <div className="rounded-md border border-border bg-card/50 p-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{lang === "ar" ? "ما قاله المحرك الآن" : lang === "ku" ? "وەڵامی ئێستا" : "What the engine said just now"}</div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-foreground/90">{p.current_answer}</div>
                </div>
              ) : (
                <div className="text-muted-foreground italic">{p.probe_error ? `(${p.probe_error})` : (lang === "ar" ? "(لا توجد إشارة)" : "(no signal)")}</div>
              )}
              {p.feeding_basis && (
                 <div className="break-words text-muted-foreground"><span className="font-semibold text-foreground/80">{lang === "ar" ? "كيف تمت تغذيته:" : lang === "ku" ? "چۆن خوێندراوەتەوە:" : "How it was fed:"}</span> {p.feeding_basis}</div>
              )}
              {p.feed_strategy && (
                 <div className="break-words"><span className="font-semibold text-foreground/80">{lang === "ar" ? "استراتيجية التغذية:" : lang === "ku" ? "ستراتیژی خواردن:" : "Feed strategy:"}</span> {p.feed_strategy}</div>
              )}
              {(p.recommended_actions || []).length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{lang === "ar" ? "إجراءات التحسين" : lang === "ku" ? "کردارەکانی باشترکردن" : "Improvement actions"}</div>
                  <ul className="mt-1 list-inside list-disc break-words">
                    {(p.recommended_actions || []).map((a: string, j: number) => <li key={j}>{a}</li>)}
                  </ul>
                </div>
              )}
              {(p.content_pieces || []).length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{lang === "ar" ? "محتوى مقترح" : lang === "ku" ? "ناوەڕۆکی پێشنیار" : "Content pieces"}</div>
                  <ul className="mt-1 list-inside list-disc break-words">
                    {(p.content_pieces || []).map((c: string, j: number) => <li key={j}>{c}</li>)}
                  </ul>
                </div>
              )}
              {p.injection_pack && (
                <div className="rounded-md border border-accent/30 bg-accent/5 p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">{lang === "ar" ? "حقنة جاهزة للنشر" : lang === "ku" ? "پاکێجی ئامادە بۆ بڵاوکردنەوە" : "Ready-to-publish injection"}</span>
                    {p.injection_pack.channel && <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground">{p.injection_pack.channel}</span>}
                  </div>
                  {p.injection_pack.title && <div className="font-semibold text-foreground">{p.injection_pack.title}</div>}
                  {p.injection_pack.article_markdown && (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase text-muted-foreground">Article</span>
                        <button onClick={() => navigator.clipboard.writeText(String(p.injection_pack.article_markdown))} className="text-[10px] underline text-primary">copy</button>
                      </div>
                      <pre className="mt-1 max-h-48 max-w-full overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2 text-[11px] text-foreground/90">{p.injection_pack.article_markdown}</pre>
                    </div>
                  )}
                  {Array.isArray(p.injection_pack.qa_pairs) && p.injection_pack.qa_pairs.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase text-muted-foreground">Q&amp;A</div>
                      {p.injection_pack.qa_pairs.map((qa: any, k: number) => (
                        <div key={k} className="break-words rounded bg-background/60 p-2 text-[11px]"><strong>Q:</strong> {qa.q}<br/><strong>A:</strong> {qa.a}</div>
                      ))}
                    </div>
                  )}
                  {p.injection_pack.json_ld && (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase text-muted-foreground">JSON-LD</span>
                        <button onClick={() => navigator.clipboard.writeText(String(p.injection_pack.json_ld))} className="text-[10px] underline text-primary">copy</button>
                      </div>
                      <pre className="mt-1 max-h-32 max-w-full overflow-auto whitespace-pre-wrap break-all rounded bg-background/60 p-2 text-[10px] font-mono text-foreground/80">{p.injection_pack.json_ld}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {Array.isArray(report.evidence) && report.evidence.length > 0 && (
            <div className="rounded-lg border border-border bg-background/40 p-3 text-xs">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{lang === "ar" ? "الأدلة العامة المُستخدَمة في التغذية" : lang === "ku" ? "بەڵگە گشتییەکانی خواردن" : "Public evidence used as feeding"}</div>
              <ol className="mt-1 list-inside list-decimal space-y-1">
                {report.evidence.map((e: any, j: number) => (
                  <li key={j}><a href={e.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{e.title || e.url}</a></li>
                ))}
              </ol>
            </div>
          )}
          <HandoffMenu source="boost" getText={() => `${brand}\n${report.summary || ""}\n\n${(report.plan || []).map((p: any) => `${p.platform}: ${(p.recommended_actions || []).join(", ")}`).join("\n")}`} />
        </div>
      )}
    </div>
  );
}
