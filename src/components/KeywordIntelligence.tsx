import { useState } from "react";
import { Loader2, KeyRound } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { ExportButtons } from "@/components/ExportButtons";
import type { ExportPayload } from "@/lib/exports";

type L = "ar" | "en" | "ku";
const T = {
  ar: { title: "ذكاء الكلمات المفتاحية التنافسية", hint: "يملأ معروف الحقول من هوية علامتك. بدون ملف، يفحص موقعك ليعرف كلماتك الحالية.", brand: "العلامة", site: "الموقع", category: "المجال", comps: "المنافسون (اختياري، افصل بفاصلة)", market: "السوق", run: "ابدأ التحليل", busy: "يجري التحليل…" },
  en: { title: "Competitive Keyword Intelligence", hint: "Maaroof fills fields from your brand identity. Without a file it scans your site for current keywords.", brand: "Brand", site: "Website", category: "Category", comps: "Competitors (optional, comma separated)", market: "Market", run: "Run analysis", busy: "Analyzing…" },
  ku: { title: "زیرەکی وشە سەرەکییە ڕکابەرییەکان", hint: "معروف خانەکان لە ناسنامەی براندەکەت پڕ دەکاتەوە.", brand: "براند", site: "ماڵپەڕ", category: "بوار", comps: "ڕکابەران", market: "بازاڕ", run: "دەستپێکردن", busy: "شیکردنەوە…" },
};

export function KeywordIntelligence() {
  const { lang } = useI18n();
  const l = (["ar", "en", "ku"].includes(lang) ? lang : "ar") as L;
  const c = T[l];
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const p: any = auth?.profile || {};
  const [brand, setBrand] = useState<string>(p.brand_name || p.entity_name || "");
  const [site, setSite] = useState<string>(p.website || p.entity_website || "");
  const [category, setCategory] = useState<string>(p.specialty || p.sector || "");
  const [market, setMarket] = useState<string>(p.hq_country || "");
  const [comps, setComps] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [payload, setPayload] = useState<ExportPayload | null>(null);

  async function run() {
    setBusy(true); setErr(""); setPayload(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await apiFetch("/api/dual-result", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ brand, site, category, market_text: market, competitors: comps.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean), lang: l, request_text: c.title }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "failed");
      setPayload(j.payload);
    } catch (e: any) { setErr(e?.message || "failed"); }
    finally { setBusy(false); }
  }

  const field = (label: string, v: string, set: (x: string) => void) => (
    <label className="block text-xs text-muted-foreground">{label}
      <input value={v} onChange={(e) => set(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
    </label>
  );

  return (
    <div className="space-y-4" dir={l === "en" ? "ltr" : "rtl"}>
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4 text-primary" /> {c.title}</div>
        <p className="mb-3 text-xs text-muted-foreground">{c.hint}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {field(c.brand, brand, setBrand)}
          {field(c.site, site, setSite)}
          {field(c.category, category, setCategory)}
          {field(c.market, market, setMarket)}
        </div>
        <div className="mt-3">{field(c.comps, comps, setComps)}</div>
        <button onClick={run} disabled={busy || !brand.trim()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy && <Loader2 className="size-4 animate-spin" />}{busy ? c.busy : c.run}
        </button>
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      </div>
      {payload && (
        <div className="space-y-4">
          <ExportButtons build={() => payload} toolKey="keyword_intelligence" />
          {payload.sections.map((s, i) => s.table && (
            <section key={i} className="overflow-x-auto rounded-xl border border-border">
              <h3 className="bg-muted px-3 py-2 text-sm font-semibold">{s.heading}</h3>
              <table className="w-full text-xs">
                <thead><tr>{s.table.columns.map((h, j) => <th key={j} className="border-b border-border px-2 py-1 text-start font-medium">{h}</th>)}</tr></thead>
                <tbody>{s.table.data.slice(0, 50).map((r, j) => <tr key={j} className="border-b border-border/50">{r.map((v, k) => <td key={k} className="px-2 py-1 align-top">{String(v)}</td>)}</tr>)}</tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
