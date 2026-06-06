import { useState } from "react";
import { Loader2, Target } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api-client";

const GOALS = [
  { id: "awareness", label: "الوعي" },
  { id: "authority", label: "السلطة" },
  { id: "conversion", label: "التحويل" },
  { id: "local", label: "تركيز محلي" },
];

export function GeoStrategist() {
  const { lang } = useI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const [brand, setBrand] = useState((auth?.profile as any)?.brand_name ?? "");
  const [keywords, setKeywords] = useState("");
  const [selected, setSelected] = useState<string[]>(["awareness"]);
  const [budget, setBudget] = useState("low");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<any>(null);

  function toggle(id: string) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }

  async function run() {
    if (!brand.trim()) return;
    setBusy(true); setErr(""); setRes(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await apiFetch("/api/geo-strategist", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ brand, keywords, lang, goals: { types: selected, budget } }),
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
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Target className="size-4 text-primary"/> توصيات GEO مخصّصة</div>
        <p className="mb-3 text-xs text-muted-foreground">يبني خطة 12 أسبوع مبنية على أهدافك وآخر تقرير تعزيز علامة (3 وحدات).</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="اسم العلامة" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="كلمات مفتاحية" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <button key={g.id} onClick={() => toggle(g.id)} className={`rounded-full px-3 py-1 text-xs border ${selected.includes(g.id) ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{g.label}</button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <label>الميزانية:</label>
          <select value={budget} onChange={(e) => setBudget(e.target.value)} className="rounded border border-border bg-background px-2 py-1">
            <option value="low">منخفضة</option><option value="medium">متوسطة</option><option value="high">عالية</option>
          </select>
          <button onClick={run} disabled={busy || !brand.trim()} className="ml-auto inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="size-3 animate-spin"/> : <Target className="size-3"/>} توليد
          </button>
        </div>
        {err && <p className="mt-2 text-xs text-destructive">{err === "subscription_required" ? "اشتراك مطلوب أو رصيد غير كافٍ" : err}</p>}
      </div>

      {res && (
        <div className="space-y-3 text-sm">
          {res.summary && <div className="rounded-xl border border-primary/30 bg-card/60 p-4">{res.summary}</div>}
          {res.priority_keywords?.length > 0 && <div><b>كلمات أولوية:</b> {res.priority_keywords.join("، ")}</div>}
          {res.content_types?.length > 0 && (
            <div><b>أنواع المحتوى:</b><ul className="mt-1 list-inside list-disc">{res.content_types.map((c: any, i: number) => <li key={i}>{c.type} — <span className="text-muted-foreground">{c.reason}</span></li>)}</ul></div>
          )}
          {res.priority_platforms?.length > 0 && (
            <div><b>منصات أولوية:</b><ul className="mt-1 list-inside list-disc">{res.priority_platforms.map((p: any, i: number) => <li key={i}>{p.engine} — <span className="text-muted-foreground">{p.reason}</span></li>)}</ul></div>
          )}
          {res.editorial_calendar?.length > 0 && (
            <div>
              <b>التقويم التحريري (12 أسبوع):</b>
              <div className="mt-1 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b"><th className="p-1 text-start">أسبوع</th><th className="p-1 text-start">العنوان</th><th className="p-1 text-start">المنصة</th><th className="p-1 text-start">KPI</th></tr></thead>
                  <tbody>{res.editorial_calendar.map((w: any, i: number) => <tr key={i} className="border-b border-border/50"><td className="p-1">{w.week}</td><td className="p-1">{w.title}</td><td className="p-1">{w.platform}</td><td className="p-1">{w.kpi}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
          {res.kpi_targets && <div><b>أهداف KPI:</b> <span className="text-muted-foreground">{Object.entries(res.kpi_targets).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span></div>}
          {res.risks?.length > 0 && <div className="text-destructive"><b>مخاطر:</b> {res.risks.join("، ")}</div>}
        </div>
      )}
    </div>
  );
}
