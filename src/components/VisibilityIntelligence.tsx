import { useEffect, useState } from "react";
import { Eye, Share2, Layers3 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { VisibilityPanel } from "@/components/AIVisibility";
import { SocialAnalysis } from "@/components/SocialAnalysis";
import { GeoScopeSelector, getEffectiveScope, type GeoScope } from "@/components/GeoScopeSelector";
import { ToolLangSelect } from "@/components/ToolLangSelect";
import type { Lang } from "@/lib/i18n";

type View = "ai" | "social" | "summary";

function metricLabel(value: any, lang: Lang): string {
  if (!value || value.value_pct == null) return lang === "ar" ? "غير متاح" : lang === "ku" ? "بەردەست نییە" : "Not available";
  return `${value.value_pct}% (${value.numerator}/${value.denominator})`;
}

/**
 * Shared configuration for AI-engine and social-search visibility.
 * The two evidence systems intentionally retain separate denominators and metrics.
 */
export function VisibilityIntelligence() {
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

  useEffect(() => {
    if (!brand && (auth.profile as any)?.brand_name) setBrand(String((auth.profile as any).brand_name));
    if (!keywords && (auth.profile as any)?.brand_keywords) setKeywords(String((auth.profile as any).brand_keywords));
  }, [auth.profile, brand, keywords]);

  useEffect(() => {
    setScope(getEffectiveScope(auth.profile, "research"));
  }, [auth.profile]);

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
    </section>
  );
}
