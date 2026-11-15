import { DOMAIN_ONTOLOGY_BY_ACRONYM } from "@/lib/maaroof/domain-ontology";

type Lang = "ar" | "en" | "ku";
type Props = {
  lang: Lang;
  entity: { type: string; type_detection?: string; category?: string | null; market?: string | null };
};

const TEXT = {
  ar: {
    title: "ما رصدته النماذج علناً",
    subtitle: "ملخص محدود لما توفر في مدخلاتك وإجابات النماذج الثلاثة؛ لا يعني تحققاً مستقلاً من الويب.",
    type: "تصنيف الكيان", person: "شخص", organization: "مؤسسة / منظمة", unknown: "غير محسوم",
    category: "الفئة المقدمة", market: "السوق المقدم", notProvided: "غير متوفر في المدخلات",
    schema: "بيانات Schema.org", notChecked: "لم تُفحص — لم يُجرَ زحف للموقع أو تحليل لشفرة الصفحة",
    confirmed: "مدخل مقدم", model: "تصنيف النموذج", unavailable: "غير متحقق",
    glossary: "مفاهيم التقرير",
    scope: "حدود العينة",
    scopeText: "هذه عينة استكشافية من ثلاثة مسارات نموذجية فقط من أصل عشرة في كتالوج معروف. النتيجة ليست تدقيق SEO أو فحص Schema.org أو قياساً شاملاً للسوق.",
  },
  en: {
    title: "Publicly observed signals",
    subtitle: "A limited summary of your inputs and three model responses; not independent web verification.",
    type: "Entity classification", person: "Person", organization: "Organization", unknown: "Undetermined",
    category: "Provided category", market: "Provided market", notProvided: "Not supplied",
    schema: "Schema.org data", notChecked: "Not checked — no website crawl or page-source inspection was performed",
    confirmed: "User-provided input", model: "Model classification", unavailable: "Unverified",
    glossary: "Report concepts",
    scope: "Sample boundaries",
    scopeText: "This is an exploratory sample from three model routes out of Maaroof's ten-engine catalogue. It is not an SEO audit, Schema.org inspection, or comprehensive market measurement.",
  },
  ku: {
    title: "ئەو نیشانانەی بە ئاشکرا تۆمار کراون",
    subtitle: "پوختەیەکی سنووردار لە زانیارییە پێدراوەکان و وەڵامی سێ مۆدێل؛ پشتڕاستکردنەوەی سەربەخۆی وێب نییە.",
    type: "پۆلێنی کەسایەتی", person: "کەس", organization: "دامەزراوە / ڕێکخراو", unknown: "دیاری نەکراوە",
    category: "پۆلی پێدراو", market: "بازاڕی پێدراو", notProvided: "لە زانیارییەکاندا نییە",
    schema: "داتای Schema.org", notChecked: "پشکنین نەکراوە — هیچ وێبسایتێک نەخراوەتە ژێر پشکنین",
    confirmed: "زانیاریی پێدراو", model: "پۆلێنی مۆدێل", unavailable: "پشتڕاست نەکراوەتەوە",
    glossary: "چەمکەکانی ڕاپۆرت",
    scope: "سنووری نموونە",
    scopeText: "ئەمە تەنها نموونەیەکی لێکۆڵینەوەییە لە سێ ڕێڕەوی مۆدێل لە کۆی دە مۆدێلی معروف. پشکنینی SEO، پشکنینی Schema.org یان پێوانەی تەواوی بازاڕ نییە.",
  },
} as const;

const TERMS = ["GEO", "AEO", "KGO", "E-E-A-T", "RAG", "Schema.org"] as const;

export function TrialKnowledgeSignals({ lang, entity }: Props) {
  const t = TEXT[lang] || TEXT.ar;
  const type = entity.type === "person" ? t.person : entity.type === "organization" ? t.organization : t.unknown;
  const detection = entity.type_detection === "manual" ? t.confirmed : t.model;
  const glossary = TERMS.map((key) => DOMAIN_ONTOLOGY_BY_ACRONYM.get(key.toLowerCase())).filter(Boolean);
  return (
    <section className="mt-6 rounded-xl border border-border bg-background p-4" aria-labelledby="trial-signals-title">
      <div>
        <h3 id="trial-signals-title" className="text-sm font-semibold">{t.title}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t.subtitle}</p>
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-[11px] text-muted-foreground">{t.type}</dt>
          <dd className="mt-1 text-sm font-medium">{type}</dd>
          <dd className="mt-1 text-[10px] text-muted-foreground">{detection}</dd>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-[11px] text-muted-foreground">{t.category}</dt>
          <dd className="mt-1 text-sm">{entity.category?.trim() || t.notProvided}</dd>
          <dd className="mt-1 text-[10px] text-muted-foreground">{entity.category?.trim() ? t.confirmed : t.unavailable}</dd>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-[11px] text-muted-foreground">{t.market}</dt>
          <dd className="mt-1 text-sm">{entity.market?.trim() || t.notProvided}</dd>
          <dd className="mt-1 text-[10px] text-muted-foreground">{entity.market?.trim() ? t.confirmed : t.unavailable}</dd>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-[11px] text-muted-foreground">{t.schema}</dt>
          <dd className="mt-1 text-sm">{t.notChecked}</dd>
          <dd className="mt-1 text-[10px] text-muted-foreground">{t.unavailable}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <h4 className="text-xs font-semibold">{t.glossary}</h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {glossary.map((term) => (
            <details key={term!.acronym} className="group relative">
              <summary className="cursor-pointer list-none rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-muted">
                {term!.acronym}
              </summary>
              <div className="mt-2 max-w-sm rounded-lg border border-border bg-card p-3 text-xs shadow-sm">
                <p className="font-semibold">{lang === "en" ? term!.full_name_en : term!.full_name_ar}</p>
                <p className="mt-1 leading-5 text-muted-foreground">{lang === "en" ? term!.definition_en : term!.definition_ar}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-dashed border-border p-3">
        <p className="text-xs font-semibold">{t.scope}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t.scopeText}</p>
      </div>
    </section>
  );
}
