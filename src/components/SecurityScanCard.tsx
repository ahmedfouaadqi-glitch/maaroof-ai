import { useState } from "react";
import { ShieldCheck, ShieldAlert, LoaderCircle, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withPreviewAuth } from "@/lib/api-client";

type L = "ar" | "en" | "ku";
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);

export function SecurityScanCard({ lang, workspaceId = null }: { lang: L; workspaceId?: string | null }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<any>(null);

  const run = async () => {
    if (!url.trim() || busy) return;
    setBusy(true); setErr(""); setRes(null);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch(withPreviewAuth("/api/security-scan"), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` }, body: JSON.stringify({ url, workspace_id: workspaceId }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j.error === "bad_url" ? tr(lang, "أدخل رابط موقع عام صحيح.", "Enter a valid public website.", "لینکێکی گشتی بنووسە.") : j.error === "unreachable" ? tr(lang, "تعذّر الوصول للموقع. لم يُخصم شيء.", "Site unreachable. Nothing charged.", "ماڵپەڕ نەگەیشت.") : r.status === 402 ? tr(lang, "الرصيد غير كافٍ. لم يُخصم شيء.", "Not enough balance.", "باڵانس بەس نییە.") : tr(lang, "تعذّر الفحص. لم يُخصم شيء.", "Scan failed. Nothing charged.", "پشکنین سەرکەوتوو نەبوو."));
      else setRes(j);
    } catch { setErr(tr(lang, "تعذّر الفحص. لم يُخصم شيء.", "Scan failed. Nothing charged.", "پشکنین سەرکەوتوو نەبوو.")); }
    setBusy(false);
  };

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="mb-3 flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><h2 className="font-semibold">{tr(lang, "الفحص الأمني للموقع", "Website security check", "پشکنینی ئاسایش")}</h2></div>
      <p className="mb-3 text-xs text-muted-foreground">{tr(lang, "يفحص التشفير وترويسات الحماية والملفات الحساسة المكشوفة والروابط المعطوبة. يُخصم من رصيدك عند النجاح فقط.", "Checks HTTPS, security headers, exposed files and broken links. Charged only on success.", "تەنها لە سەرکەوتن دەبڕدرێت.")}</p>
      <div className="flex gap-2">
        <input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="maaroofai.com" className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <button type="button" onClick={run} disabled={busy || !url.trim()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy && <LoaderCircle className="size-4 animate-spin" />}{tr(lang, "افحص", "Scan", "پشکنین")}</button>
      </div>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      {res && (
        <div className="mt-4">
          <div className="mb-3 flex items-center gap-2 text-sm">
            {res.score >= 70 ? <ShieldCheck className="size-5 text-primary" /> : <ShieldAlert className="size-5 text-destructive" />}
            <span className="text-2xl font-bold tabular-nums">{res.score}</span><span className="text-muted-foreground">/100 · {tr(lang, "خُصم", "charged", "بڕدرا")} {res.charged}</span>
          </div>
          <ul className="space-y-2">
            {res.checks.map((c: any) => (
              <li key={c.id} className="rounded-xl border border-border bg-background p-2 text-sm">
                <div className="flex items-center gap-2">{c.ok ? <Check className="size-4 text-primary" /> : <X className="size-4 text-destructive" />}<span className="font-medium">{c.label}</span></div>
                <p dir="auto" className="mt-1 break-all text-xs text-muted-foreground">{c.evidence}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
