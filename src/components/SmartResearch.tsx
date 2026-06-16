import { useEffect, useState } from "react";
import { Search, Loader2, ExternalLink, Sparkles, Radio, Zap, TrendingUp, Building2, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

import { ToolHelpBanner } from "@/components/ToolHelpBanner";
import { GeoScopeSelector, getEffectiveScope } from "@/components/GeoScopeSelector";
import { HandoffMenu } from "@/components/HandoffMenu";
import { consumeHandoff } from "@/lib/tool-handoff";
import { apiFetch } from "@/lib/api-client";
import { ProactiveNextStep } from "@/components/ProactiveNextStep";
import { summarizeInput, summarizeOutput } from "@/lib/cognition-summary";
import { SourcesList } from "@/components/SourcesList";


const CHANNEL_OPTIONS = [
  "website", "linkedin", "twitter", "instagram", "facebook", "youtube", "telegram", "whatsapp", "email",
] as const;

type SearchMode = "web" | "company";

export function SmartResearch() {
  const { t, lang } = useI18n();
  const { profile, session } = useAuth();
  const specialty = (profile as any)?.specialty || "";
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<SearchMode>("web");
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState("");
  const [includeChannels, setIncludeChannels] = useState(false);
  const [channelTypes, setChannelTypes] = useState<string[]>(["website", "linkedin", "instagram", "email"]);

  const toggleChannel = (c: string) =>
    setChannelTypes((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  useEffect(() => {
    const onReuse = (e: Event) => {
      const txt = (e as CustomEvent).detail?.text;
      if (txt) { setQ(String(txt).slice(0, 500)); setOut(null); setErr(""); }
    };
    window.addEventListener("geo:reuse-research", onReuse);
    const pending = consumeHandoff("research");
    if (pending) { setQ(pending.slice(0, 500)); setOut(null); setErr(""); }
    return () => window.removeEventListener("geo:reuse-research", onReuse);
  }, []);

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true); setErr(""); setOut(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await apiFetch("/api/research", {
        method: "POST", headers,
        body: JSON.stringify({
          query: q, lang, scope: getEffectiveScope(profile, "research"),
          mode,
          include_channels: includeChannels || mode === "company",
          channel_types: (includeChannels || mode === "company") ? channelTypes : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "failed");
      setOut(j);
    } catch (e: any) { setErr(e?.message || "failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2">
        <Search className="size-5 text-primary" /> {t("research_title")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("research_desc")}</p>
      <ToolHelpBanner toolKey="research" />
      <div className="mt-3"><GeoScopeSelector compact toolKey="research" /></div>
      {specialty && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
          <Sparkles className="size-3" /> {t("specialty_active")}: <b>{specialty}</b>
        </div>
      )}

      {/* Mode toggle: web vs company */}
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-border bg-background/40 p-1">
        <button onClick={() => { setMode("web"); setOut(null); }}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${mode === "web" ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
          <Globe className="size-3.5" /> {t("research_mode_web") || "بحث عام في الويب"}
        </button>
        <button onClick={() => { setMode("company"); setOut(null); setIncludeChannels(true); }}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${mode === "company" ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
          <Building2 className="size-3.5" /> {t("research_mode_company") || "بحث عن شركة"}
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={mode === "company" ? (t("research_company_ph") || "اسم الشركة أو العلامة") : t("research_ph")}
          className="flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
        <button disabled={loading} onClick={run}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {t("research_run")}
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-border/70 bg-background/40 p-3">
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={includeChannels} onChange={(e) => setIncludeChannels(e.target.checked)} />
          <Radio className="size-3.5 text-accent" /> {t("research_include_channels")}
        </label>
        {includeChannels && (
          <>
            <div className="mt-2 text-[11px] text-muted-foreground">{t("research_channels_hint")}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CHANNEL_OPTIONS.map((c) => {
                const active = channelTypes.includes(c);
                return (
                  <button key={c} type="button" onClick={() => toggleChannel(c)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${active ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/50 text-muted-foreground hover:bg-background"}`}>
                    {t(`ch_${c}`)}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {err && <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{err}</div>}
      {out && (
        <div className="mt-4 space-y-3" id="research-result">
          {out.sge_summary && (
            <div className="rounded-lg border border-accent/40 bg-gradient-to-br from-accent/10 to-primary/5 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-accent font-bold">
                <Zap className="size-3.5" /> {t("research_sge")}
                <span title={t("research_sge_tooltip")} className="cursor-help text-muted-foreground">ⓘ</span>
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{out.sge_summary}</div>
            </div>
          )}
          {out.answer && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm whitespace-pre-wrap leading-relaxed">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-primary font-semibold">{t("research_answer")}</div>
              {out.answer}
            </div>
          )}
          {out.key_findings?.length > 0 && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm">
              <div className="mb-1 text-xs font-semibold text-accent">{t("research_findings")}</div>
              <ul className="ms-5 list-disc space-y-1">
                {out.key_findings.map((k: string, i: number) => <li key={i}>{k}</li>)}
              </ul>
            </div>
          )}
          {out.visibility_opportunities?.length > 0 && (
            <div className="rounded-lg border border-success/40 bg-success/5 p-3 text-sm">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-success">
                <TrendingUp className="size-3.5" /> {t("research_opportunities")}
                <span title={t("research_opportunities_tooltip")} className="cursor-help text-muted-foreground">ⓘ</span>
              </div>
              <ul className="ms-5 list-decimal space-y-1">
                {out.visibility_opportunities.map((k: string, i: number) => <li key={i}>{k}</li>)}
              </ul>
            </div>
          )}
          {/* Chain to other tools */}
          {(out.sge_summary || out.answer) && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const txt = `${q}\n\n${out.sge_summary || out.answer}`;
                  window.dispatchEvent(new CustomEvent("geo:reuse-suggest", { detail: { text: txt } }));
                  document.getElementById("suggest")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20">
                <Sparkles className="size-3" /> {t("research_send_suggest")}
              </button>
              <button
                onClick={() => {
                  const txt = out.answer || out.sge_summary;
                  window.dispatchEvent(new CustomEvent("geo:reuse-analyze", { detail: { text: txt } }));
                  document.getElementById("analyze")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-semibold text-accent hover:bg-accent/20">
                <Zap className="size-3" /> {t("research_send_analyze")}
              </button>
            </div>
          )}
          {includeChannels && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Radio className="size-3.5 text-accent" /> {t("research_channels")} ({out.channels?.length || 0})
              </div>
              {out.channels?.length ? (
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {out.channels.map((c: any, i: number) => (
                    <li key={i} className="rounded-lg border border-border bg-background/40 p-2 text-xs">
                      <div className="text-[10px] font-semibold uppercase text-accent">{t(`ch_${c.type}`) || c.type}</div>
                      <a href={c.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 font-medium text-primary hover:underline break-all">
                        {c.label} <ExternalLink className="size-3 shrink-0" />
                      </a>
                      {c.source && <div className="mt-0.5 text-[10px] text-muted-foreground">{c.source}</div>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-border bg-background/40 p-2 text-xs text-muted-foreground">{t("research_no_channels")}</div>
              )}
            </div>
          )}
          {out.sources?.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">{t("research_sources")} ({out.sources.length})</div>
              <ul className="space-y-1.5">
                {out.sources.map((s: any, i: number) => (
                  <li key={i} className="rounded-lg border border-border bg-background/40 p-2 text-xs">
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                      [{i + 1}] {s.title} <ExternalLink className="size-3" />
                    </a>
                    {s.domain && <div className="mt-0.5 text-[10px] text-muted-foreground">{s.domain}</div>}
                    {s.description && <div className="mt-1 text-foreground/80">{s.description.slice(0, 200)}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <HandoffMenu source="research" getText={() => `${q}\n\n${out.sge_summary || out.answer || ""}`} />
          <ProactiveNextStep
            toolKey="research"
            inputSummary={summarizeInput({ query: q, mode })}
            outputSummary={summarizeOutput(out)}
            handoffText={`${q}\n\n${out.sge_summary || out.answer || ""}`}
          />
        </div>
      )}
    </div>
  );
}
