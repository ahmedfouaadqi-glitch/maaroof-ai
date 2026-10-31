import { useEffect, useState } from "react";
import { Eye, Share2, Layers3, History } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { VisibilityPanel } from "@/components/AIVisibility";
import { SocialAnalysis } from "@/components/SocialAnalysis";
import { GeoScopeSelector, getEffectiveScope, type GeoScope } from "@/components/GeoScopeSelector";
import { ToolLangSelect } from "@/components/ToolLangSelect";
import type { Lang } from "@/lib/i18n";

type View = "ai" | "social" | "summary" | "history";
type OperationRow = { id: string; operation_type: string; brand_name: string | null; status: string; created_at: string; request_meta: Record<string, any>; result_meta: Record<string, any> };

function metricLabel(value: any, lang: Lang): string {
  if (!value || value.value_pct == null) return lang === "ar" ? "غير متاح" : lang === "ku" ? "بەردەست نییە" : "Not available";
  return `${value.value_pct}% (${value.numerator}/${value.denominator})`;
}

/**
 * Shared configuration for AI-engine and social-search visibility.
 * The two evidence systems intentionally retain separate denominators and metrics.
 */
export function VisibilityIntelligence({ workspaceId = null }: { workspaceId?: string | null } = {}) {
  const { t, lang: uiLang } = useI18n();
  const auth = useAuth();
  const [brand, setBrand] = useState(String((auth.profile as any)?.brand_name || ""));
  const [officialWebsite, setOfficialWebsite] = useState("");
  const [keywords, setKeywords] = useState(String((auth.profile as any)?.brand_keywords || ""));
  const [audienceLanguage, setAudienceLanguage] = useState<Lang>(uiLang);
  const [scope, setScope] = useState<GeoScope>(() => getEffectiveScope(auth.profile, "research"));
  const [view, setView] = useState<View>("ai");
  const [aiResult, setAiResult] = useState<any>(null);
  const [socialResult, setSocialResult] = useState<any>(null);
  const [historyRows, setHistoryRows] = useState<OperationRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    if (!brand && (auth.profile as any)?.brand_name) setBrand(String((auth.profile as any).brand_name));
    if (!keywords && (auth.profile as any)?.brand_keywords) setKeywords(String((auth.profile as any).brand_keywords));
  }, [auth.profile, brand, keywords]);

  useEffect(() => {
    setScope(getEffectiveScope(auth.profile, "research"));
  }, [auth.profile]);

  useEffect(() => {
    if (view !== "history" || !auth.user?.id) return;
    let active = true;
    setHistoryLoading(true);
    setHistoryError("");
    const loadHistory = async () => {
      let query = supabase.from("brand_operations")
        .select("id, operation_type, brand_name, status, created_at, request_meta, result_meta")
        .eq("user_id", auth.user!.id)
        .in("operation_type", ["visibility_probe", "social_analysis"])
        .order("created_at", { ascending: false })
        .limit(30);
      query = workspaceId ? query.eq("workspace_id", workspaceId) : query.is("workspace_id", null);
      const { data, error } = await query;
      if (!active) return;
      if (error) setHistoryError(error.message);
      setHistoryRows((data || []) as OperationRow[]);
      setHistoryLoading(false);
    };
    loadHistory().catch((error: any) => {
      if (!active) return;
      setHistoryError(error?.message || "history_load_failed");
      setHistoryLoading(false);
    });
    return () => { active = false; };
  }, [view, auth.user?.id, workspaceId]);

  const formatDate = (value: string) => {
    try { return new Date(value).toLocaleString(audienceLanguage === "ar" ? "ar" : audienceLanguage === "ku" ? "ckb" : "en"); }
    catch { return value; }
  };
  const latestComparable = (type: "visibility_probe" | "social_analysis") => {
    const rows = historyRows.filter((row) => row.operation_type === type && row.status !== "failed");
    if (!rows.length) return null;
    const latest = rows[0];
    const previous = rows.slice(1).find((row) => {
      if (String(row.brand_name || "").trim().toLowerCase() !== String(latest.brand_name || "").trim().toLowerCase()) return false;
      const a = latest.request_meta || {};
      const b = row.request_meta || {};
      if (a.market !== b.market || a.audience_language !== b.audience_language || a.official_website !== b.official_website) return false;
      if (type === "visibility_probe") {
        return a.category === b.category && JSON.stringify(a.engines || []) === JSON.stringify(b.engines || []) && JSON.stringify(a.engine_models || {}) === JSON.stringify(b.engine_models || {});
      }
      const latestSources = (latest.result_meta?.platform_results || []).map((x: any) => [x.key, x.retrieval_source]);
      const previousSources = (row.result_meta?.platform_results || []).map((x: any) => [x.key, x.retrieval_source]);
      return a.keywords === b.keywords && JSON.stringify(latestSources) === JSON.stringify(previousSources);
    });
    return { latest, previous: previous || null };
  };
  const aiComparison = latestComparable("visibility_probe");
  const socialComparison = latestComparable("social_analysis");
  const aiLatestMetric = aiComparison?.latest.result_meta?.query_pack_metrics?.organic_mention_rate;
  const aiPreviousMetric = aiComparison?.previous?.result_meta?.query_pack_metrics?.organic_mention_rate;
  const socialLatestMetric = socialComparison?.latest.result_meta?.query_coverage;
  const socialPreviousMetric = socialComparison?.previous?.result_meta?.query_coverage;
  const delta = (latest: any, previous: any) => latest?.value_pct != null && previous?.value_pct != null ? Number((latest.value_pct - previous.value_pct).toFixed(2)) : null;
  const isArabic = audienceLanguage === "ar";
  const isKurdish = audienceLanguage === "ku";
  const label = (ar: string, en: string, ku: string) => isArabic ? ar : isKurdish ? ku : en;

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Layers3 className="size-5 text-primary" />
              {label("ذكاء الظهور الموحد", "Unified Visibility Intelligence", "ژیری دەرکەوتنی یەکگرتوو")}
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              {label(
                "إعداد واحد للعلامة والسوق ولغة الجمهور، مع قياس مستقل للظهور في إجابات المحركات والنتائج الاجتماعية. لا ندمج المقاييس المختلفة في درجة واحدة.",
                "One shared brand, market and audience-language setup. AI-engine answers and social search results remain separate evidence streams with separate metrics.",
                "ڕێکخستنێکی هاوبەش بۆ براند و بازاڕ و زمانی ئامانج؛ بەڵام پێوەرەکانی AI و گەڕانی کۆمەڵایەتی جیاوازن."
              )}
            </p>
          </div>
          <ToolLangSelect value={audienceLanguage} onChange={setAudienceLanguage} />
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t("auto.brand_name")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={officialWebsite} onChange={(e) => setOfficialWebsite(e.target.value)} type="url" placeholder={label("رابط الموقع الرسمي", "Official website URL", "بەستەری ماڵپەڕی فەرمی")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t("auto.keywords_optional")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="mt-3">
          <GeoScopeSelector compact toolKey="research" value={scope} onChange={setScope} />
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          {label(
            "لغة الجمهور هي نفسها لغة مخرجات التقرير في هذا الإعداد. النطاق الجغرافي مستقل عنها، ولا تُستنتج دولة من اللغة.",
            "Audience language also sets report language. Geography is independent; a country is never inferred from language.",
            "زمانی ئامانج هەمان زمانی ڕاپۆرتە؛ جوگرافیا سەربەخۆیە و لە زمانەوە وڵات دیاری ناکرێت."
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={tabClass(view === "ai")} onClick={() => setView("ai")}><Eye className="size-3.5" />{label("ظهور محركات الذكاء الاصطناعي", "AI-engine visibility", "دەرکەوتنی بزوێنەرەکانی AI")}</button>
        <button type="button" className={tabClass(view === "social")} onClick={() => setView("social")}><Share2 className="size-3.5" />{label("الظهور الاجتماعي", "Social visibility", "دەرکەوتنی کۆمەڵایەتی")}</button>
        <button type="button" className={tabClass(view === "summary")} onClick={() => setView("summary")}><Layers3 className="size-3.5" />{label("ملخص موحد", "Unified summary", "پوختەی یەکگرتوو")}</button>
        <button type="button" className={tabClass(view === "history")} onClick={() => setView("history")}><History className="size-3.5" />{label("السجل والمقارنة", "History & comparison", "مێژوو و بەراورد")}</button>
      </div>

      {view === "ai" && (
        <div className="rounded-xl border border-border bg-card/30 p-3">
          <VisibilityPanel
            brand={brand} keywords={keywords} officialWebsite={officialWebsite}
            lang={audienceLanguage} scope={scope} sharedInputs embedded
            toolKey="research" onResult={setAiResult}
          />
        </div>
      )}
      {view === "social" && (
        <div className="rounded-xl border border-border bg-card/30 p-3">
          <SocialAnalysis
            brand={brand} keywords={keywords} officialWebsite={officialWebsite}
            lang={audienceLanguage} scope={scope} sharedInputs embedded
            onResult={setSocialResult}
          />
        </div>
      )}
      {view === "summary" && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card/50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Eye className="size-4 text-primary" />{label("قياس المحركات", "AI-engine measurement", "پێوانەی بزوێنەرەکان")}</div>
              <div className="mt-3 text-xs text-muted-foreground">{label("معدل ذكر العلامة", "Brand mention rate", "ڕێژەی هێنانی ناوی براند")}</div>
              <div className="mt-1 text-xl font-semibold">{metricLabel(aiResult?.visibility_metrics?.mention_rate, audienceLanguage)}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                {label("تغطية الإجابات", "Answer coverage", "پۆششی وەڵام")}: {metricLabel(aiResult?.visibility_metrics?.engine_coverage, audienceLanguage)}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {label("معدل التوصية المعلن من المحركات", "Model-stated recommendation rate", "ڕێژەی پێشنیاری ڕاگەیەنراوی بزوێنەر")}: {metricLabel(aiResult?.query_pack_metrics?.recommendation_rate, audienceLanguage)}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">{label("المقام هنا هو عدد إجابات المحركات الناجحة، وليس نتائج البحث الاجتماعي.", "Denominator: successful engine answers, not social search results.", "بنەما: وەڵامە سەرکەوتووەکانی بزوێنەرەکانە، نەک ئەنجامی گەڕانی کۆمەڵایەتی.")}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Share2 className="size-4 text-primary" />{label("قياس البحث الاجتماعي", "Social search measurement", "پێوانەی گەڕانی کۆمەڵایەتی")}</div>
              <div className="mt-3 text-xs text-muted-foreground">{label("تغطية عمليات البحث", "Search coverage", "پۆششی گەڕان")}</div>
              <div className="mt-1 text-xl font-semibold">{socialResult ? `${socialResult.queries_completed ?? 0}/${socialResult.queries_planned ?? 6}` : label("لم يُشغّل بعد", "Not run yet", "هێشتا نەکراوە")}</div>
              <div className="mt-2 text-xs text-muted-foreground">{label("نتائج البحث المسترجعة", "Search results returned", "ئەنجامە گەڕاوەکان")}: <b>{socialResult?.total_results_returned ?? "—"}</b></div>
              <div className="mt-2 text-xs text-muted-foreground">Share of Voice: <b>{label("غير مقاس", "Not measured", "پێوانە نەکراوە")}</b></div>
              <p className="mt-2 text-[10px] text-muted-foreground">{label("المقام هنا هو عمليات البحث المكتملة والنتائج المسترجعة، وليس عدد المنشورات الكلي أو الوصول.", "This reflects completed search queries and returned records, not total posts or reach.", "ئەمە گەڕانی تەواوبوو و ئەنجامی گەڕاوە پیشان دەدات، نەک هەموو پۆست و گەیشتن.")}</p>
            </div>
          </div>
          {!aiResult && !socialResult && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{label("شغّل أحد الفحصين أو كليهما لعرض الملخص. لا توجد درجة موحدة زائفة.", "Run either or both measurements to populate this view. No synthetic combined score is produced.", "یەکێک یان هەردوو پێوانەکە جێبەجێ بکە. نمرەی دەستکردی یەکگرتوو دروست ناکرێت.")}</p>}
        </div>
      )}
      {view === "history" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">{label("سجل قياسات الظهور", "Visibility measurement history", "مێژووی پێوانەی دەرکەوتن")}</h3>
            <p className="mt-1 text-[10px] text-muted-foreground">{label("لا تظهر المقارنة إلا عند تطابق العلامة والسوق واللغة والموقع وفئة القياس والمحركات ونماذجها، أو إعدادات البحث ومصادره.", "Comparisons are shown only when brand, market, language, website, category, engines and models match; social comparisons also require matching search settings and retrieval sources.", "بەراورد تەنها کاتێک پیشان دەدرێت کە براند و بازاڕ و زمان و ماڵپەڕ و پۆل و بزوێنەر و مۆدێلەکان هاوتا بن.")}</p>
          </div>
          {historyLoading && <p className="text-xs text-muted-foreground">{label("جارٍ تحميل السجل…", "Loading history…", "بارکردنی مێژوو…")}</p>}
          {historyError && <p className="text-xs text-destructive">{historyError}</p>}
          {!historyLoading && !historyRows.length && !historyError && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{label("لا توجد قياسات محفوظة ضمن نطاق مساحة العمل الحالية.", "No saved measurements in the current workspace scope.", "هیچ پێوانەیەکی پاشەکەوتکراو لە سنووری ئەم شوێنی کارەدا نییە.")}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card/50 p-4">
              <div className="text-sm font-semibold">{label("الظهور العضوي في المحركات", "Organic AI-engine visibility", "دەرکەوتنی سروشتی لە بزوێنەرەکان")}</div>
              {aiComparison ? (
                <>
                  <div className="mt-2 text-xs text-muted-foreground">{label("أحدث قياس", "Latest run", "دوا پێوانە")}: {metricLabel(aiLatestMetric, audienceLanguage)}</div>
                  {aiComparison.previous ? <div className="mt-1 text-xs text-muted-foreground">{label("القياس السابق المطابق", "Previous matching run", "پێوانەی پێشووی هاوتا")}: {metricLabel(aiPreviousMetric, audienceLanguage)}</div> : <div className="mt-1 text-[10px] text-muted-foreground">{label("لا توجد عينة سابقة مطابقة للمقارنة.", "No previous run with matching measurement settings.", "نموونەیەکی پێشووی هاوتا نییە.")}</div>}
                  {delta(aiLatestMetric, aiPreviousMetric) != null && <div className="mt-2 text-sm font-semibold">{label("التغير", "Change", "گۆڕان")}: {delta(aiLatestMetric, aiPreviousMetric)! > 0 ? "+" : ""}{delta(aiLatestMetric, aiPreviousMetric)} {label("نقطة مئوية", "percentage points", "خاڵی سەدی")}</div>}
                  <div className="mt-1 text-[10px] text-muted-foreground">{formatDate(aiComparison.latest.created_at)}</div>
                </>
              ) : <p className="mt-2 text-xs text-muted-foreground">{label("لا يوجد سجل للمحركات بعد.", "No AI-engine run history yet.", "هێشتا مێژووی بزوێنەر نییە.")}</p>}
            </div>
            <div className="rounded-xl border border-border bg-card/50 p-4">
              <div className="text-sm font-semibold">{label("تغطية البحث الاجتماعي", "Social search coverage", "پۆششی گەڕانی کۆمەڵایەتی")}</div>
              {socialComparison ? (
                <>
                  <div className="mt-2 text-xs text-muted-foreground">{label("أحدث قياس", "Latest run", "دوا پێوانە")}: {metricLabel(socialLatestMetric, audienceLanguage)}</div>
                  {socialComparison.previous ? <div className="mt-1 text-xs text-muted-foreground">{label("القياس السابق المطابق", "Previous matching run", "پێوانەی پێشووی هاوتا")}: {metricLabel(socialPreviousMetric, audienceLanguage)}</div> : <div className="mt-1 text-[10px] text-muted-foreground">{label("لا توجد عينة سابقة مطابقة للمقارنة.", "No previous run with matching search settings and retrieval sources.", "نموونەیەکی پێشووی هاوتای گەڕان و سەرچاوە نییە.")}</div>}
                  {delta(socialLatestMetric, socialPreviousMetric) != null && <div className="mt-2 text-sm font-semibold">{label("التغير", "Change", "گۆڕان")}: {delta(socialLatestMetric, socialPreviousMetric)! > 0 ? "+" : ""}{delta(socialLatestMetric, socialPreviousMetric)} {label("نقطة مئوية", "percentage points", "خاڵی سەدی")}</div>}
                  <div className="mt-1 text-[10px] text-muted-foreground">{formatDate(socialComparison.latest.created_at)}</div>
                </>
              ) : <p className="mt-2 text-xs text-muted-foreground">{label("لا يوجد سجل اجتماعي بعد.", "No social search history yet.", "هێشتا مێژووی گەڕانی کۆمەڵایەتی نییە.")}</p>}
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground"><tr>
                <th className="p-2">{label("نوع القياس", "Measurement", "جۆری پێوانە")}</th>
                <th className="p-2">{label("العلامة", "Brand", "براند")}</th>
                <th className="p-2">{label("السوق", "Market", "بازاڕ")}</th>
                <th className="p-2">{label("الحالة", "Status", "دۆخ")}</th>
                <th className="p-2">{label("النتيجة", "Result", "ئەنجام")}</th>
                <th className="p-2">{label("التاريخ", "Date", "بەروار")}</th>
              </tr></thead>
              <tbody>
                {historyRows.map((row) => {
                  const isAi = row.operation_type === "visibility_probe";
                  const metric = isAi ? row.result_meta?.query_pack_metrics?.organic_mention_rate : row.result_meta?.query_coverage;
                  const resultText = metric?.value_pct == null ? "—" : metric.value_pct + "% (" + metric.numerator + "/" + metric.denominator + ")";
                  return <tr key={row.id} className="border-t border-border">
                    <td className="p-2">{isAi ? label("محركات AI", "AI engines", "بزوێنەرەکانی AI") : label("بحث اجتماعي", "Social search", "گەڕانی کۆمەڵایەتی")}</td>
                    <td className="p-2">{row.brand_name || "—"}</td>
                    <td className="p-2">{row.request_meta?.market || "—"}</td>
                    <td className="p-2">{row.status}</td>
                    <td className="p-2 tabular-nums">{resultText}</td>
                    <td className="p-2">{formatDate(row.created_at)}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
