import { useEffect, useState } from "react";
import { useI18n, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy, Users, Sparkles, Lightbulb } from "lucide-react";
import { ToolLangSelect } from "./ToolLangSelect";
import { ExportButtons } from "./ExportButtons";
import { ToolHelpBanner } from "./ToolHelpBanner";
import { GeoScopeSelector, getEffectiveScope } from "./GeoScopeSelector";
import type { ExportPayload } from "@/lib/exports";
import { HandoffMenu } from "@/components/HandoffMenu";
import { consumeHandoff } from "@/lib/tool-handoff";
import { apiFetch } from "@/lib/api-client";

type Brand = {
  name: string;
  is_main: boolean;
  visibility_percent: number;
  geo_score: number;
  sentiment: "positive" | "neutral" | "negative";
  platform_presence?: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  rank?: number;
};
type Result = {
  brands: Brand[];
  winner: string;
  winner_reason?: string;
  overview: string;
  content_gaps?: string[];
  recommendations: string[];
  specialty?: string | null;
};

const PLATFORMS = ["chatgpt","gemini","claude","perplexity","copilot","grok","mistral","deepseek"] as const;

export function CompetitorCompare() {
  const { t, lang } = useI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}

  const [brand, setBrand] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [keywords, setKeywords] = useState("");
  const [outLang, setOutLang] = useState<Lang>(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

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
        body: JSON.stringify({ brand: brand.trim(), competitors: list, keywords: keywords.trim(), lang: outLang, scope: getEffectiveScope(auth?.profile, "compare") }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data?.error || "error"); return; }
      setResult(data.result);
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
              b.strengths.join(" · "),
              b.weaknesses.join(" · "),
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
      </div>

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
            <ExportButtons build={buildExport} />
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
                  <div className="text-xs text-muted-foreground">{b.sentiment}</div>
                </div>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <Bar label={t("col_visibility")} value={b.visibility_percent} />
                  <Bar label={t("col_geo")} value={b.geo_score} />
                </div>
                {b.platform_presence && Object.values(b.platform_presence).some((v) => v > 0) && (
                  <div className="mb-3 rounded-lg border border-border/60 bg-background/40 p-2">
                    <div className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">{t("compare_platform_presence")}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PLATFORMS.map((p) => (
                        <div key={p} className="flex items-center gap-1.5 text-[10px]">
                          <span className="w-16 truncate capitalize text-muted-foreground">{p}</span>
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${b.platform_presence?.[p] || 0}%` }} />
                          </div>
                          <span className="w-7 text-end font-mono text-foreground/80">{b.platform_presence?.[p] || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {b.strengths.length > 0 && (
                  <div className="text-xs"><b className="text-success">✓ {t("col_strengths")}:</b> {b.strengths.join(" · ")}</div>
                )}
                {b.weaknesses.length > 0 && (
                  <div className="mt-1 text-xs"><b className="text-destructive">⚠ {t("col_weaknesses")}:</b> {b.weaknesses.join(" · ")}</div>
                )}
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

          <HandoffMenu source="compare" getText={() => `${brand} vs ${competitors}\n${result.overview || ""}\n\n${(result.recommendations || []).join("\n")}`} />
        </div>
      )}
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{label}</span><span className="font-mono text-foreground">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
