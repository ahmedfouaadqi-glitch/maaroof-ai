import { useEffect, useState } from "react";
import { Eye, Loader2, Sparkles } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { ExportButtons } from "@/components/ExportButtons";
import { ToolLangSelect } from "@/components/ToolLangSelect";
import { ToolHelpBanner } from "@/components/ToolHelpBanner";
import { GeoScopeSelector, getEffectiveScope } from "@/components/GeoScopeSelector";
import { ENGINES } from "@/components/engine-logos";

type PanelProps = {
  /** When provided, the panel uses the parent's brand and skips the inner brand input. */
  brand?: string;
  /** When provided, the panel uses the parent's keywords and skips the inner keywords input. */
  keywords?: string;
  /** When provided, the panel uses the parent's output language and hides its own language picker. */
  lang?: Lang;
  /** Hide the outer card chrome (used when embedded inside another card / tab). */
  embedded?: boolean;
  /** Override which tool's geo-scope is used. Defaults to "research" to preserve old behavior. */
  toolKey?: "research" | "brand";
};

export function VisibilityPanel({ brand: brandProp, keywords: kwProp, lang: langProp, embedded = false, toolKey = "research" }: PanelProps) {
  const { t, lang: uiLang } = useI18n();
  const [outLang, setOutLang] = useState<Lang>(langProp || uiLang);
  useEffect(() => { if (langProp) setOutLang(langProp); }, [langProp]);

  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}

  const controlled = brandProp !== undefined;
  const [innerBrand, setInnerBrand] = useState((auth?.profile as any)?.brand_name || "");
  const [innerKw, setInnerKw] = useState((auth?.profile as any)?.brand_keywords || "");
  const brand = controlled ? (brandProp || "") : innerBrand;
  const keywords = controlled ? (kwProp || "") : innerKw;

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [out, setOut] = useState<any>(null);

  useEffect(() => {
    if (controlled) return;
    const p: any = auth?.profile;
    if (p?.brand_name && !innerBrand) setInnerBrand(p.brand_name);
    if (p?.brand_keywords && !innerKw) setInnerKw(p.brand_keywords);
  }, [auth?.profile]);

  const run = async () => {
    if (!brand.trim() || busy) return;
    setBusy(true); setErr(""); setOut(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await apiFetch("/api/visibility", {
        method: "POST", headers,
        body: JSON.stringify({ brand, keywords, lang: outLang, scope: getEffectiveScope(auth?.profile, toolKey) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || `http_${res.status}`);
      setOut(j.result);
    } catch (e: any) { setErr(e?.message || "failed"); }
    finally { setBusy(false); }
  };

  const findEngine = (name: string) => ENGINES.find((e) => e.name.toLowerCase() === String(name || "").toLowerCase());

  const body = (
    <>
      {!embedded && (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Eye className="size-5 text-primary" /> {t("ag_vis_title")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("ag_vis_desc")}</p>
            <ToolHelpBanner toolKey="research" />
            <div className="mt-3"><GeoScopeSelector compact toolKey="research" /></div>
          </div>
          {!langProp && <ToolLangSelect value={outLang} onChange={setOutLang} />}
        </div>
      )}

      {!controlled && (
        <div className={`${embedded ? "" : "mt-3"} grid gap-2 md:grid-cols-2`}>
          <input value={innerBrand} onChange={(e) => setInnerBrand(e.target.value)}
            placeholder={t("ag_vis_brand_ph")}
            className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
          <input value={innerKw} onChange={(e) => setInnerKw(e.target.value)}
            placeholder={t("ag_vis_keywords_ph")}
            className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
        </div>
      )}

      <div className={`${embedded && controlled ? "" : "mt-3"} flex items-center justify-between gap-2`}>
        {err && <span className="text-xs text-destructive">{err === "limit" || err === "credits_exhausted" || err === "no_active_subscription" ? t("ag_vis_quota_err") || "تم استنفاد رصيد التحليلات الشهري" : err}</span>}
        <button onClick={run} disabled={busy || !brand.trim()}
          className="ms-auto inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
          {busy ? t("ag_running") : t("ag_vis_run")}
        </button>
      </div>

      {out && (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="text-[10px] uppercase tracking-widest text-primary font-bold">{t("ag_vis_score")}</div>
              <div className="mt-1 text-3xl font-bold text-gradient">{out.visibility_percent}%</div>
            </div>
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
              <div className="text-[10px] uppercase tracking-widest text-accent font-bold">{t("ag_vis_sentiment")}</div>
              <div className="mt-1 text-lg font-semibold capitalize">{out.sentiment}</div>
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">confidence</div>
              <div className="mt-1 text-lg font-semibold capitalize">{out.confidence}</div>
            </div>
          </div>

          {out.appearance_summary && (
            <div className="rounded-lg border border-border bg-background/40 p-3 text-sm leading-relaxed">{out.appearance_summary}</div>
          )}

          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" /> {t("ag_vis_platforms")}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(out.platforms || []).map((p: any, i: number) => {
                const eng = findEngine(p.name);
                const Logo = eng?.Logo;
                return (
                  <div key={i} className={`rounded-lg border border-border bg-gradient-to-br ${eng?.tint || "from-primary/10 to-accent/5"} p-3`}>
                    <div className="flex items-center gap-2">
                      {Logo && <Logo size={22} />}
                      <strong className="text-sm">{p.name}</strong>
                      <span className="ms-auto rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">{p.score}%</span>
                    </div>
                    {p.trust_signal && <div className="mt-1 text-[11px] text-muted-foreground"><b>{t("ag_vis_trust")}:</b> {p.trust_signal}</div>}
                    {p.citation_method && <div className="mt-0.5 text-[11px] text-muted-foreground"><b>{t("ag_vis_citation")}:</b> {p.citation_method}</div>}
                    {p.why && <div className="mt-1 text-xs text-foreground/80">{p.why}</div>}
                    {p.action && (
                      <div className="mt-2 rounded border border-accent/30 bg-accent/10 px-2 py-1 text-[11px]">
                        <b>{t("ag_vis_action")}:</b> {p.action}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {out.recommendations?.length > 0 && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
              <div className="mb-1 text-xs font-semibold text-success">Recommendations</div>
              <ol className="ms-5 list-decimal space-y-1">
                {out.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ol>
            </div>
          )}

          <ExportButtons size="xs" build={() => ({
            title: t("ag_vis_title"), subtitle: brand,
            sections: [
              { kind: "kv", heading: t("ag_vis_score"), rows: [[t("ag_vis_score"), `${out.visibility_percent}%`], [t("ag_vis_sentiment"), out.sentiment]] as [string, string | number][] },
              { kind: "table", heading: t("ag_vis_platforms"), table: {
                columns: ["Platform", "Score", t("ag_vis_trust"), t("ag_vis_action")],
                data: (out.platforms || []).map((p: any) => [p.name, `${p.score}%`, p.trust_signal || "", p.action || ""]),
              } },
              ...(out.recommendations?.length ? [{ kind: "list" as const, heading: "Recommendations", list: out.recommendations }] : []),
            ],
          })} />
        </div>
      )}
    </>
  );

  if (embedded) return <div className="space-y-3">{body}</div>;
  return <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur">{body}</div>;
}

// Back-compat: keep standalone export used by /agent route.
export function AIVisibility() {
  return <VisibilityPanel />;
}
