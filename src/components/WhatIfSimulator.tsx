import { useState } from "react";
import { Loader2, FlaskConical } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { ProactiveNextStep } from "@/components/ProactiveNextStep";
import { summarizeInput, summarizeOutput } from "@/lib/cognition-summary";

const CHANGES = [
  { id: "add_content_type", label: "auto.add_new_content_type" },
  { id: "new_audience", label: "auto.targeting_new_audience" },
  { id: "new_platform", label: "auto.add_new_platform" },
  { id: "increase_frequency", label: "auto.increase_publishing_frequency" },
  { id: "wikipedia", label: "auto.create_wikipedia_page" },
  { id: "press", label: "auto.public_relations_campaign" },
];

export function WhatIfSimulator() {
  const { t } = useI18n();
  const { lang } = useI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const [brand, setBrand] = useState((auth?.profile as any)?.brand_name ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<any>(null);

  function toggle(id: string) { setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]); }

  async function run() {
    if (!brand.trim() || selected.length === 0) return;
    setBusy(true); setErr(""); setRes(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await apiFetch("/api/what-if", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ brand, lang, changes: { selected, note } }),
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
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><FlaskConical className="size-4 text-primary"/> محاكاة t("auto.what_if")</div>
        <p className="mb-3 text-xs text-muted-foreground">{t("auto.simulate_the_impact_of_changes_on")}</p>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t("auto.brand_name_3")} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <div className="mt-2 flex flex-wrap gap-2">
          {CHANGES.map((c) => (
            <button key={c.id} onClick={() => toggle(c.id)} className={`rounded-full px-3 py-1 text-xs border ${selected.includes(c.id) ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{t(c.label)}</button>
          ))}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("auto.additional_details_optional")} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} />
        <button onClick={run} disabled={busy || !brand.trim() || selected.length === 0} className="mt-2 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin"/> : <FlaskConical className="size-4"/>} محاكاة
        </button>
        {err && <p className="mt-2 text-xs text-destructive">{err === "subscription_required" ? t("auto.subscription_required_or_insufficient_balance") : err}</p>}
      </div>

      {res && (
        <div className="space-y-3 text-sm">
          {res.summary && <div className="rounded-xl border border-primary/30 bg-card/60 p-4">{res.summary}</div>}
          {res.engine_projections?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b"><th className="p-2 text-start">{t("auto.engine")}</th><th className="p-2 text-start">{t("auto.before")}</th><th className="p-2 text-start">{t("auto.after_expected")}</th><th className="p-2 text-start">Δ</th><th className="p-2 text-start">{t("auto.trust")}</th><th className="p-2 text-start">{t("auto.reason_for_change")}</th></tr></thead>
                <tbody>
                  {res.engine_projections.map((p: any, i: number) => {
                    const before = typeof p.baseline_score === "number" ? p.baseline_score : null;
                    // Parse "+X% to +Y%" to mid value for after estimate
                    const m = String(p.projected_delta || "").match(/([+-]?\d+(?:\.\d+)?)\s*%?\s*(?:to|إلى|الى|-)\s*([+-]?\d+(?:\.\d+)?)/);
                    const midDelta = m ? (parseFloat(m[1]) + parseFloat(m[2])) / 2 : null;
                    const after = before !== null && midDelta !== null ? Math.max(0, Math.min(100, Math.round(before * (1 + midDelta / 100)))) : null;
                    return (
                      <tr key={i} className="border-b border-border/50">
                        <td className="p-2 font-semibold">{p.engine}</td>
                        <td className="p-2">{before ?? "—"}</td>
                        <td className="p-2 text-success font-bold">{after ?? "—"}</td>
                        <td className="p-2 text-primary">{p.projected_delta}</td>
                        <td className="p-2">{p.confidence}</td>
                        <td className="p-2 text-muted-foreground">{p.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            {res.estimated_cost && <span className="rounded-full border border-border px-3 py-1">التكلفة: {res.estimated_cost}</span>}
            {res.time_to_impact_weeks && <span className="rounded-full border border-border px-3 py-1">الوقت: {res.time_to_impact_weeks} أسبوع</span>}
            {res.final_recommendation && <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-semibold">{res.final_recommendation}</span>}
          </div>
          {res.risks?.length > 0 && <div className="text-destructive text-xs"><b>{t("auto.risks")}</b> {res.risks.join("، ")}</div>}
          <ProactiveNextStep
            toolKey="what_if"
            inputSummary={summarizeInput({ brand, selected, note })}
            outputSummary={summarizeOutput(res)}
            handoffText={`${brand}\n${res.summary || ""}`}
          />
        </div>
      )}
    </div>
  );
}
