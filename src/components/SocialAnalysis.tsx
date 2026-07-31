import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { ProactiveNextStep } from "@/components/ProactiveNextStep";
import { summarizeInput, summarizeOutput } from "@/lib/cognition-summary";

export function SocialAnalysis() {
  const { t } = useI18n();
  const { lang } = useI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const [brand, setBrand] = useState((auth?.profile as any)?.brand_name ?? "");
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<any>(null);

  async function run() {
    if (!brand.trim()) return;
    setBusy(true); setErr(""); setRes(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await apiFetch("/api/social-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ brand, keywords, lang }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "failed");
      setRes(j);
    } catch (e: any) { setErr(e?.message || "failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Share2 className="size-4 text-primary"/> تحليل الظهور الاجتماعي</div>
        <p className="mb-3 text-xs text-muted-foreground">{t("auto.searches_for_your_brand_signals_on")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t("auto.brand_name")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t("auto.keywords_optional")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <button onClick={run} disabled={busy || !brand.trim()} className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin"/> : <Share2 className="size-4"/>} تحليل
        </button>
        {err && <p className="mt-2 text-xs text-destructive">{err === "subscription_required" ? t("auto.subscription_required_or_insufficient_balance") : err === "credits_exhausted" ? t("auto.ai_credits_exhausted") : err}</p>}
      </div>

      {res && (
        <div className="space-y-3">
          <div className="rounded-xl border border-primary/30 bg-card/60 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">إجمالي الإشارات: <b>{res.total_mentions}</b> · المشاعر: <b>{res.sentiment || "—"}</b> · Share of Voice: <b>{res.share_of_voice ?? "—"}</b></div>
            </div>
            {res.summary && <p className="mt-2 text-sm text-foreground/80">{res.summary}</p>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {res.platforms?.map((p: any) => (
              <div key={p.key} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between text-sm font-semibold"><span>{p.label}</span><span className="text-primary">{p.mentions}</span></div>
                <ul className="mt-2 space-y-1 text-xs">
                  {p.top?.slice(0, 3).map((t: any, i: number) => (
                    <li key={i}><a href={t.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{t.title || t.url}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {res.post_ideas?.length > 0 && (
            <div className="rounded-xl border border-accent/30 bg-card/40 p-4">
              <div className="text-sm font-semibold mb-2">{t("auto.suggested_post_ideas")}</div>
              <ul className="space-y-2 text-sm">
                {res.post_ideas.map((i: any, idx: number) => (
                  <li key={idx} className="rounded-md border border-border p-2"><b>[{i.platform}]</b> {i.title} — <span className="text-muted-foreground">{i.hook}</span></li>
                ))}
              </ul>
            </div>
          )}
          {res.hashtags?.length > 0 && <p className="text-xs text-muted-foreground">هاشتاجات: {res.hashtags.join(" ")}</p>}
          <ProactiveNextStep
            toolKey="social_analysis"
            inputSummary={summarizeInput({ brand, keywords })}
            outputSummary={summarizeOutput(res)}
            handoffText={`${brand}\n${res.summary || ""}`}
          />
        </div>
      )}
    </div>
  );
}
