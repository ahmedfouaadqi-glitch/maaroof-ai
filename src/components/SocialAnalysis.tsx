import { useEffect, useState } from "react";
import { ToolResultExport } from "@/components/ToolResultExport";
import { ToolHistory } from "@/components/ToolHistory";
import { Loader2, Share2 } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { ProactiveNextStep } from "@/components/ProactiveNextStep";
import { summarizeInput, summarizeOutput } from "@/lib/cognition-summary";
import { GeoScopeSelector, getEffectiveScope, type GeoScope } from "@/components/GeoScopeSelector";
import { ToolLangSelect } from "@/components/ToolLangSelect";

type SocialAnalysisProps = {
  brand?: string;
  keywords?: string;
  officialWebsite?: string;
  lang?: Lang;
  scope?: GeoScope;
  workspaceId?: string | null;
  sharedInputs?: boolean;
  embedded?: boolean;
  onResult?: (result: any) => void;
};

export function SocialAnalysis({
  brand: brandProp, keywords: keywordsProp, officialWebsite: websiteProp,
  lang: langProp, scope: scopeProp, workspaceId = null,
  sharedInputs = false, embedded = false, onResult,
}: SocialAnalysisProps = {}) {
  const { t, lang: uiLang } = useI18n();
  const [outLang, setOutLang] = useState<Lang>(langProp || uiLang);
  useEffect(() => { if (langProp) setOutLang(langProp); }, [langProp]);
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const [brand, setBrand] = useState(brandProp ?? (auth?.profile as any)?.brand_name ?? "");
  const [keywords, setKeywords] = useState(keywordsProp ?? "");
  const [officialWebsite, setOfficialWebsite] = useState(websiteProp ?? "");
  useEffect(() => { if (brandProp !== undefined) setBrand(brandProp); }, [brandProp]);
  useEffect(() => { if (keywordsProp !== undefined) setKeywords(keywordsProp); }, [keywordsProp]);
  useEffect(() => { if (websiteProp !== undefined) setOfficialWebsite(websiteProp); }, [websiteProp]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<any>(null);

  async function run() {
    if (!brand.trim() || !officialWebsite.trim() || busy) return;
    setBusy(true); setErr(""); setRes(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await apiFetch("/api/social-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          brand, keywords, official_website: officialWebsite.trim(), lang: outLang,
          scope: scopeProp || getEffectiveScope(auth?.profile, "research"), workspace_id: workspaceId,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok && !j?.platforms) throw new Error(j?.error || "failed");
      setRes(j);
      onResult?.(j);
    } catch (e: any) { setErr(e?.message || "failed"); }
    finally { setBusy(false); }
  }

  const isArabic = outLang === "ar";
  const isKurdish = outLang === "ku";
  const label = (ar: string, en: string, ku: string) => isArabic ? ar : isKurdish ? ku : en;
  const completed = Number(res?.queries_completed || 0);
  const planned = Number(res?.queries_planned || 6);

  return (
    <div className="space-y-4">
      {!sharedInputs && (
        <div className="rounded-xl border border-border bg-card/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Share2 className="size-4 text-primary"/> {label("تحليل الظهور الاجتماعي", "Social visibility analysis", "شیکاری دەرکەوتنی کۆمەڵایەتی")}</div>
          <p className="mb-3 text-xs text-muted-foreground">{t("auto.searches_for_your_brand_signals_on")}</p>
          <div className="mb-3"><GeoScopeSelector compact toolKey="research" value={scopeProp} /></div>
          {!langProp && <div className="mb-3"><ToolLangSelect value={outLang} onChange={setOutLang} /></div>}
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t("auto.brand_name")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={officialWebsite} onChange={(e) => setOfficialWebsite(e.target.value)} type="url" placeholder={label("رابط الموقع الرسمي", "Official website URL", "بەستەری ماڵپەڕی فەرمی")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t("auto.keywords_optional")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2" />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label("بحث عن نتائج مفهرسة ضمن ست منصات اجتماعية؛ وليس قياسًا شاملًا لكل المنشورات.", "Search-result sample across six social platforms; not a complete census of posts.", "گەڕان بۆ نموونەی ئەنجامی شەش پلاتفۆرمی کۆمەڵایەتییە، نەک ژماردنی هەموو پۆستەکان.")}</span>
        <button onClick={run} disabled={busy || !brand.trim() || !officialWebsite.trim()} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin"/> : <Share2 className="size-4"/>} {busy ? label("جارٍ التحليل", "Analyzing", "لە شیکاری‌دایە") : label("تحليل الظهور الاجتماعي", "Analyze social visibility", "شیکاری دەرکەوتنی کۆمەڵایەتی")}
        </button>
      </div>
      {err && <p className="text-xs text-destructive">{err === "subscription_required" ? t("auto.subscription_required_or_insufficient_balance") : err === "credits_exhausted" ? t("auto.ai_credits_exhausted") : err}</p>}

      {res && <div className="mb-2 flex justify-end"><ToolResultExport toolKey="social_analysis" result={res} /></div>}
      <ToolHistory toolKey="social_analysis" />
      {res && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="text-xs text-muted-foreground">{label("نتائج البحث المسترجعة", "Search results returned", "ئەنجامی گەڕانەوە")}</div>
              <div className="mt-1 text-2xl font-semibold">{res.total_results_returned ?? "—"}</div>
              <div className="text-[10px] text-muted-foreground">{label("ليست عدد المنشورات الكامل", "Not a platform-wide post count", "ژمارەی تەواوی پۆستەکان نییە")}</div>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="text-xs text-muted-foreground">{label("تغطية عمليات البحث", "Search coverage", "پۆششی گەڕان")}</div>
              <div className="mt-1 text-2xl font-semibold">{completed}/{planned}</div>
              <div className="text-[10px] text-muted-foreground">{res.query_coverage?.value_pct ?? "—"}%</div>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="text-xs text-muted-foreground">Share of Voice</div>
              <div className="mt-1 text-2xl font-semibold">—</div>
              <div className="text-[10px] text-muted-foreground">{label("غير مقاس: لا يتوفر مقام منافسين قابل للمقارنة", "Not measured: no comparable competitor denominator", "پێوانە نەکراوە: داتای هاوتای ڕکابەر نییە")}</div>
            </div>
          </div>
          <div className="rounded-xl border border-primary/30 bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>{label("حالة تحليل النصوص", "Text analysis status", "دۆخی شیکاری دەق")}: <b>{res.analysis_status || "—"}</b></div>
              <div>{label("المشاعر", "Sentiment", "هەست")}: <b>{res.sentiment === "not_assessed" ? label("غير مقاسة", "Not assessed", "هەڵنەسەنگێندراوە") : (res.sentiment || "—")}</b></div>
            </div>
            {res.summary && <p className="mt-2 text-sm text-foreground/80">{res.summary}</p>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {res.platforms?.map((platform: any) => (
              <div key={platform.key} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{platform.label}</span>
                  <span className="text-primary">{platform.status === "measured" ? platform.results_returned : "—"}</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">{platform.status === "measured" ? label("تم البحث", "Measured search", "گەڕان پێوراوە") : label("تعذّر القياس", "Search unavailable", "گەڕان بەردەست نییە")}</div>
                <ul className="mt-2 space-y-1 text-xs">
                  {platform.results?.slice(0, 3).map((item: any, i: number) => (
                    <li key={i}><a href={item.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{item.title || item.url}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {res.post_ideas?.length > 0 && (
            <div className="rounded-xl border border-accent/30 bg-card/40 p-4">
              <div className="mb-2 text-sm font-semibold">{t("auto.suggested_post_ideas")}</div>
              <ul className="space-y-2 text-sm">
                {res.post_ideas.map((idea: any, idx: number) => (
                  <li key={idx} className="rounded-md border border-border p-2"><b>[{idea.platform}]</b> {idea.title} — <span className="text-muted-foreground">{idea.hook}</span></li>
                ))}
              </ul>
            </div>
          )}
          {res.hashtags?.length > 0 && <p className="text-xs text-muted-foreground">{label("هاشتاجات", "Hashtags", "هەشتاگ")}: {res.hashtags.join(" ")}</p>}
          <ProactiveNextStep toolKey="social_analysis" inputSummary={summarizeInput({ brand, officialWebsite, keywords, market: res.market })} outputSummary={summarizeOutput(res)} handoffText={`${brand}\\n${res.summary || ""}`} />
        </div>
      )}
    </div>
  );
}
