import { useEffect, useState } from "react";
import { useI18n, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy, Users, Sparkles, Lightbulb } from "lucide-react";
import { ToolLangSelect } from "./ToolLangSelect";

import { ToolHelpBanner } from "./ToolHelpBanner";
import { GeoScopeSelector, getEffectiveScope } from "./GeoScopeSelector";
import type { ExportPayload } from "@/lib/exports";
import { HandoffMenu } from "@/components/HandoffMenu";
import { consumeHandoff } from "@/lib/tool-handoff";
import { apiFetch } from "@/lib/api-client";
import { ProactiveNextStep } from "@/components/ProactiveNextStep";
import { summarizeInput, summarizeOutput } from "@/lib/cognition-summary";
import { toast } from "sonner";
import { SourcesList } from "@/components/SourcesList";


type Brand = {
  name: string;
  is_main: boolean;
  visibility_percent: number;
  geo_score: number;
  sentiment: "positive" | "neutral" | "negative";
  platform_presence?: Record<string, number>;
  platform_reasons?: Record<string, string>;
  platform_basis?: Record<string, string>;
  strengths: string[];
  weaknesses: string[];
  rank?: number;
  evidence_count?: number;
  confidence?: "high" | "medium" | "low";
};
type SeoSge = {
  url: string;
  seo_score: number;
  sge_score: number;
  signals: Record<string, any>;
  issues: string[];
  platform_tips: Record<string, string>;
};
type Result = {
  brands: Brand[];
  winner: string;
  winner_reason?: string;
  overview: string;
  content_gaps?: string[];
  recommendations: string[];
  specialty?: string | null;
  sources?: { brand: string; kind: string; title: string; url: string; snippet: string }[];
  official_sites?: Record<string, string>;
  official_site_status?: Record<string, { status: "confirmed" | "candidate" | "user" | "missing"; reason: string }>;
  seo_sge?: Record<string, SeoSge>;
  platform_measured?: Record<string, string[]>;
  live_search?: { ok: boolean; sources_count: number; failed_queries: number };
};

const PLATFORMS = ["chatgpt","gemini","claude","perplexity","copilot","grok","mistral","deepseek","kimi"] as const;

export function CompetitorCompare() {
  const { t, lang } = useI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}

  const [brand, setBrand] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [keywords, setKeywords] = useState("");
  const [websitesText, setWebsitesText] = useState("");
  const [outLang, setOutLang] = useState<Lang>(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const parseWebsites = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const raw of websitesText.split(/\n+/)) {
      const line = raw.trim();
      if (!line) continue;
      const idx = line.indexOf("=");
      if (idx <= 0) continue;
      const name = line.slice(0, idx).trim();
      const url = line.slice(idx + 1).trim();
      if (name && /^https?:\/\//i.test(url)) out[name] = url;
    }
    return out;
  };

  const errorText = (code: string) => {
    const key = `error_${code}` as any;
    return t(key) || code;
  };

  useEffect(() => {
    const onReuse = (e: Event) => { const txt = (e as CustomEvent).detail?.text; if (txt) setBrand(String(txt).split("\n")[0].slice(0, 100)); };
    window.addEventListener("geo:reuse-compare", onReuse);
    const pending = consumeHandoff("compare");
    if (pending) setBrand(pending.split("\n")[0].slice(0, 100));
    return () => window.removeEventListener("geo:reuse-compare", onReuse);
  }, []);

  const run = async () => {
    setError(null); setResult(null);
    if (brand.trim().length < 2) { setError(t("compare_brand_required")); return; }
    const list = competitors.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 4);
    if (list.length === 0) { setError(t("compare_brand_required")); return; }

    setBusy(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const session = (await supabase.auth.getSession()).data.session;
      if (session) headers.Authorization = `Bearer ${session.access_token}`;
      const r = await apiFetch("/api/compare", {
        method: "POST", headers,
        body: JSON.stringify({ brand: brand.trim(), competitors: list, keywords: keywords.trim(), lang: outLang, scope: getEffectiveScope(auth?.profile, "compare"), websites: parseWebsites() }),
      });
      const data = await r.json();
      if (!r.ok) { setError(errorText(data?.error || "error")); return; }
      setResult(data.result);
      {
        const L = (outLang === "en" || outLang === "ku" ? outLang : "ar");
        toast.success(L === "ar" ? "تم خصم التوكنز ✓ — تحقق من الرصيد في الأعلى"
          : L === "ku" ? "تۆکن کەمکرایەوە ✓ — باڵانس لە سەرەوە بپشکنە"
          : "Tokens charged ✓ — see updated balance above");
      }
      if (auth) auth.refreshProfile();
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  const buildExport = (): ExportPayload => {
    if (!result) return { title: t("export_competitor_title"), sections: [] };
    return {
      title: t("export_competitor_title"),
      subtitle: `${brand} vs ${result.brands.filter(b => !b.is_main).map(b => b.name).join(", ")}`,
      sections: [
        { kind: "kv", heading: t("compare_winner"), rows: [[t("compare_winner"), result.winner]] },
        { kind: "text", heading: t("compare_overview"), text: result.overview },
        {
          kind: "table",
          heading: t("compare_title"),
          table: {
            columns: [t("col_brand"), t("col_visibility"), t("col_geo"), t("col_sentiment"), t("col_strengths"), t("col_weaknesses")],
            data: result.brands.map((b) => [
              b.name + (b.is_main ? " ★" : ""),
              `${b.visibility_percent}%`,
              `${b.geo_score}/100`,
              b.sentiment,
              b.strengths.map((s) => s.startsWith("sw_") ? t(s) : s).join(" · "),
              b.weaknesses.map((s) => s.startsWith("sw_") ? t(s) : s).join(" · "),
            ]),
          },
        },
        ...(result.recommendations.length ? [{ kind: "list" as const, heading: t("compare_recommendations"), list: result.recommendations }] : []),
      ],
    };
  };

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5 shadow-[var(--shadow-elevated)] backdrop-blur-xl md:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4 text-primary" />
          <span className="font-mono uppercase tracking-widest text-xs">{t("compare_title")}</span>
        </div>
        <ToolLangSelect value={outLang} onChange={setOutLang} />
      </div>
      <p className="mb-2 text-sm text-muted-foreground">{t("compare_desc")}</p>
      <ToolHelpBanner toolKey="compare" />
      <div className="mt-3"><GeoScopeSelector compact toolKey="compare" /></div>
      {(auth?.profile as any)?.specialty && (
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
          <Sparkles className="size-3" /> {t("specialty_active")}: <b>{(auth?.profile as any).specialty}</b>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t("compare_brand")}
          className="rounded-xl border border-border bg-background/60 p-3 text-sm outline-none focus:border-primary" />
        <input value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder={t("compare_competitors")}
          className="rounded-xl border border-border bg-background/60 p-3 text-sm outline-none focus:border-primary md:col-span-2" />
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t("compare_keywords")}
          className="rounded-xl border border-border bg-background/60 p-3 text-sm outline-none focus:border-primary md:col-span-3" />
        <div className="md:col-span-3">
          <label className="mb-1 block text-[11px] text-muted-foreground">{t("compare_websites_label")}</label>
          <textarea value={websitesText} onChange={(e) => setWebsitesText(e.target.value)} rows={2}
            placeholder={t("compare_websites_placeholder")}
            className="w-full rounded-xl border border-border bg-background/60 p-3 text-xs font-mono outline-none focus:border-primary" />
        </div>
      </div>

      <details className="mt-4 rounded-xl border border-border/60 bg-background/40 p-3 text-xs">
        <summary className="cursor-pointer select-none font-semibold text-foreground/90">
          ℹ️ {t("compare_how_it_works")}
        </summary>
        <ul className="mt-3 space-y-2 text-muted-foreground leading-relaxed">
          <li><b className="text-foreground">% {t("col_visibility")}:</b> {t("compare_how_visibility")}</li>
          <li><b className="text-foreground">{t("col_geo")}:</b> {t("compare_how_geo")}</li>
          <li><b className="text-foreground">{t("compare_platform_presence")}:</b> {t("compare_how_platforms")}</li>
          <li><b className="text-foreground">{t("compare_seo_score")}:</b> {t("compare_how_seo")}</li>
          <li><b className="text-foreground">{t("compare_sge_score")}:</b> {t("compare_how_sge")}</li>
          <li><b className="text-foreground">{t("specialty_active")}:</b> {t("compare_how_profile")}</li>
          <li><b className="text-foreground">⟳</b> {t("compare_how_live")}</li>
        </ul>
      </details>


      <div className="mt-4 flex justify-end">
        <button onClick={run} disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:scale-[1.02] disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy ? t("compare_running") : t("compare_run")}
        </button>
      </div>

      {error && <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {result && (
        <div className="mt-6 space-y-4">
          {result.live_search && (
            <div className="rounded-xl border border-border bg-background/50 p-3 text-xs text-muted-foreground">
              <b className="text-foreground">{t("compare_live_search_status")}:</b>{" "}
              {t("compare_live_search_ok")} · {result.live_search.sources_count} {t("compare_sources_for")}
              {result.live_search.failed_queries > 0 && ` · ${result.live_search.failed_queries} ${t("compare_live_search_failed_queries")}`}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-4">
            <div className="flex items-start gap-2">
              <Trophy className="size-5 text-accent shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("compare_winner")}</div>
                <div className="font-display text-lg font-bold text-gradient">{result.winner}</div>
                {result.winner_reason && (
                  <div className="mt-1 text-xs text-muted-foreground max-w-md">{result.winner_reason}</div>
                )}
              </div>
            </div>
            
          </div>

          {result.overview && (
            <div className="rounded-xl border border-border bg-background/60 p-4 text-sm leading-relaxed">{result.overview}</div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {result.brands.map((b, i) => (
              <div key={i} className={`rounded-xl border p-4 ${b.is_main ? "border-primary/50 bg-primary/5" : "border-border bg-background/40"}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-semibold flex items-center gap-1.5">
                    {b.rank && (
                      <span className={`inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${b.rank === 1 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{b.rank}</span>
                    )}
                    {b.name}
                    {b.is_main && <span className="ms-1 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] text-primary">★</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    {(() => {
                      const st = result.official_site_status?.[b.name];
                      const url = result.official_sites?.[b.name];
                      if (!st && !url) {
                        return <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-destructive" title={t("compare_official_missing_hint")}>{t("compare_official_missing")}</span>;
                      }
                      const s = st?.status || "candidate";
                      const cls = s === "confirmed" || s === "user" ? "bg-success/15 text-success" : "bg-primary/15 text-primary";
                      const label = s === "confirmed" ? t("compare_official_confirmed") : s === "user" ? t("compare_official_user") : t("compare_official_candidate");
                      return url ? (
                        <a href={url} target="_blank" rel="noreferrer" className={`rounded-full px-1.5 py-0.5 hover:underline ${cls}`} title={st?.reason || ""}>✓ {label}</a>
                      ) : null;
                    })()}
                    {b.confidence && (
                      <span className={`rounded-full px-1.5 py-0.5 ${b.confidence === "high" ? "bg-success/15 text-success" : b.confidence === "medium" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {t("compare_confidence")}: {t(`compare_confidence_${b.confidence}`)}
                      </span>
                    )}
                    {typeof b.evidence_count === "number" && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground" title={t("compare_evidence_count_hint")}>
                        {b.evidence_count} {t("compare_sources_for")}
                      </span>
                    )}
                    <span className="text-muted-foreground">{b.sentiment}</span>
                  </div>
                </div>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <Bar label={t("col_visibility")} value={b.visibility_percent} hint={t("compare_how_visibility")} />
                  <Bar label={t("col_geo")} value={b.geo_score} hint={t("compare_how_geo")} />

                </div>
                {b.platform_presence && Object.values(b.platform_presence).some((v) => v > 0) && (
                  <div className="mb-3 rounded-lg border border-border/60 bg-background/40 p-2">
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <span>{t("compare_platform_presence")}</span>
                      <span className="flex items-center gap-2 normal-case tracking-normal">
                        <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-success" />{t("platform_measured")}</span>
                        <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-muted-foreground/60" />{t("platform_inferred")}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PLATFORMS.map((p) => {
                        const isMeasured = result.platform_measured?.[b.name]?.includes(p);
                        const reason = b.platform_reasons?.[p] || "";
                        const tip = reason || (isMeasured ? t("platform_measured_hint") : t("platform_inferred_hint"));
                        return (
                          <div key={p} className="flex items-center gap-1.5 text-[10px]" title={tip}>
                            <span className={`size-1.5 shrink-0 rounded-full ${isMeasured ? "bg-success" : "bg-muted-foreground/40"}`} />
                            <span className="w-14 truncate capitalize text-muted-foreground">{p}</span>
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className={`h-full rounded-full ${isMeasured ? "bg-gradient-to-r from-success to-primary" : "bg-gradient-to-r from-primary to-accent"}`} style={{ width: `${b.platform_presence?.[p] || 0}%` }} />
                            </div>
                            <span className="w-7 text-end font-mono text-foreground/80">{b.platform_presence?.[p] || 0}</span>
                          </div>
                        );
                      })}

                    </div>
                  </div>
                )}
                {b.strengths.length > 0 && (
                  <div className="text-xs"><b className="text-success">✓ {t("col_strengths")}:</b> {b.strengths.map((s) => s.startsWith("sw_") ? t(s) : s).join(" · ")}</div>
                )}
                {b.weaknesses.length > 0 && (
                  <div className="mt-1 text-xs"><b className="text-destructive">⚠ {t("col_weaknesses")}:</b> {b.weaknesses.map((s) => s.startsWith("sw_") ? t(s) : s).join(" · ")}</div>
                )}
                <div className="mt-1 text-[10px] text-muted-foreground">● {t("sw_signal_badge")}</div>

              </div>
            ))}
          </div>

          {result.content_gaps && result.content_gaps.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
                <Sparkles className="size-4" /> {t("compare_content_gaps")}
              </div>
              <ul className="ms-5 list-disc space-y-1 text-sm">
                {result.content_gaps.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          )}

          {result.recommendations.length > 0 && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-accent">
                <Lightbulb className="size-4" /> {t("compare_recommendations")}
              </div>
              <ol className="ms-5 list-decimal space-y-1 text-sm">
                {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ol>
            </div>
          )}

          {result.sources && result.sources.length > 0 && (
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("compare_sources_used")} · {result.sources.length}
              </div>
              <div className="space-y-3">
                {[brand, ...competitors.split(/[,،\n]/).map(s => s.trim()).filter(Boolean)].map((bName) => {
                  const brandSources = result.sources!.filter((s) => s.brand === bName);
                  const officialUrl = result.official_sites?.[bName];
                  return (
                    <div key={bName} className="rounded-lg border border-border/60 bg-card/40 p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <strong className="text-sm">{bName}</strong>
                        <span className="text-[10px] text-muted-foreground">{brandSources.length} {t("compare_sources_for")}</span>
                        {officialUrl && (
                          <a href={officialUrl} target="_blank" rel="noreferrer"
                            className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] text-success hover:underline">
                            ✓ {t("compare_official_site")}
                          </a>
                        )}
                      </div>
                      {brandSources.length === 0 ? (
                        <div className="text-xs italic text-muted-foreground">{t("compare_no_evidence")}</div>
                      ) : (
                        <ol className="space-y-1 text-xs">
                          {brandSources.slice(0, 8).map((s, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="mt-0.5 rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">{s.kind}</span>
                              <a href={s.url} target="_blank" rel="noreferrer"
                                className="flex-1 break-all text-primary hover:underline">{s.title || s.url}</a>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result.seo_sge && Object.keys(result.seo_sge).length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-primary">
                🔍 {t("compare_seo_sge_title")}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[brand, ...competitors.split(/[,،\n]/).map(s => s.trim()).filter(Boolean)].map((bName) => {
                  const r = result.seo_sge?.[bName];
                  if (!r) return (
                    <div key={bName} className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                      <strong className="block text-foreground">{bName}</strong>
                      {t("compare_no_site_scanned")}
                    </div>
                  );
                  return (
                    <div key={bName} className="rounded-xl border border-border bg-background/50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <strong className="text-sm">{bName}</strong>
                        <a href={r.url} target="_blank" rel="noreferrer" className="truncate text-[10px] text-primary hover:underline max-w-[60%]">{r.url}</a>
                      </div>
                      <div className="mb-3 grid grid-cols-2 gap-2">
                        <Bar label={t("compare_seo_score")} value={r.seo_score} hint={t("compare_how_seo")} />
                        <Bar label={t("compare_sge_score")} value={r.sge_score} hint={t("compare_how_sge")} />

                      </div>
                      {r.issues.length > 0 && (
                        <div className="mb-2">
                          <div className="mb-1 text-[10px] uppercase tracking-widest text-destructive">⚠ {t("compare_issues_to_fix")}</div>
                          <ul className="ms-4 list-disc space-y-0.5 text-[11px]">
                            {r.issues.slice(0, 6).map((k, i) => <li key={i}>{t(`issue_${k}` as any) || k}</li>)}
                          </ul>
                        </div>
                      )}
                      <div className="mt-2">
                        <div className="mb-1 text-[10px] uppercase tracking-widest text-accent">💡 {t("compare_platform_tips")}</div>
                        <div className="grid grid-cols-1 gap-0.5 text-[11px]">
                          {PLATFORMS.map((p) => {
                            const tipKey = r.platform_tips?.[p];
                            if (!tipKey) return null;
                            return (
                              <div key={p} className="flex gap-1.5">
                                <span className="w-16 shrink-0 capitalize text-muted-foreground">{p}:</span>
                                <span className="flex-1">{t(tipKey as any) || tipKey}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <SourcesList sources={(result as any).sources} sourcesUsed={(result as any).sources_used} rarityScore={(result as any).rarity_score} uniquenessNotes={(result as any).uniqueness_notes} evidenceMissing={(result as any).evidence_missing} />
          <HandoffMenu source="compare" getText={() => `${brand} vs ${competitors}\n${result.overview || ""}\n\n${(result.recommendations || []).join("\n")}`} />

          <ProactiveNextStep
            toolKey="compare"
            inputSummary={summarizeInput({ brand, competitors, keywords })}
            outputSummary={summarizeOutput(result)}
            handoffText={`${brand} vs ${competitors}\n${result.overview || ""}`}
          />
        </div>
      )}
    </div>
  );
}

function Bar({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div title={hint}>
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{label}{hint ? " ⓘ" : ""}</span><span className="font-mono text-foreground">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

