import { useMemo } from "react";

type Lang = "ar" | "en" | "ku";
type Props = { events: Array<{ type: string; data?: any }>; lang: Lang };

const copy = {
  ar: { title: "حقائق الموقع وأدلتها", empty: "لم تُستخرج حقائق مدعومة من الصفحة بعد.", observed: "ملاحظة مباشرة", inferred: "استنتاج يحتاج تحققاً", hypothesis: "فرضية", supported: "مدعوم بالدليل", validation: "يحتاج تحققاً", rejected: "مرفوض", source: "المصدر", excerpt: "المقتطف", noExcerpt: "لا يوجد مقتطف محفوظ" },
  en: { title: "Site facts & evidence", empty: "No evidence-backed facts were extracted from the page.", observed: "Observed fact", inferred: "Inference — validate", hypothesis: "Hypothesis", supported: "Evidence supported", validation: "Needs validation", rejected: "Rejected", source: "Source", excerpt: "Excerpt", noExcerpt: "No excerpt recorded" },
  ku: { title: "ڕاستییەکانی ماڵپەڕ و بەڵگەکان", empty: "هیچ ڕاستییەکی پشتگیریکراو بە بەڵگە لە پەڕەکەوە دەرهێنراوە.", observed: "تێبینی ڕاستەوخۆ", inferred: "ئەنجامگیری — پێویستی بە پشتڕاستکردنەوە هەیە", hypothesis: "گریمانە", supported: "بە بەڵگە پشتگیریکراوە", validation: "پێویستی بە پشتڕاستکردنەوە هەیە", rejected: "ڕەتکراوەتەوە", source: "سەرچاوە", excerpt: "بەشێک لە دەق", noExcerpt: "هیچ دەقێک تۆمار نەکراوە" },
} as const;

export function SiteFactsPanel({ events, lang }: Props) {
  const data = useMemo(() => [...events].reverse().find((event) => event.type === "site_discovery")?.data, [events]);
  if (!data?.discovery) return null;
  const facts = Array.isArray(data.discovered_facts) ? data.discovered_facts : [];
  const t = copy[lang] || copy.ar;
  const discovery = data.discovery;
  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5" aria-labelledby="site-facts-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="site-facts-title" className="font-semibold">{t.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground" dir="auto">{String(discovery.display_name || discovery.hostname || "")} · {String(discovery.url || "")}</p>
        </div>
        <span className="rounded-full border px-2 py-1 text-[11px] text-muted-foreground">{facts.length}</span>
      </div>
      {facts.length === 0 ? <p className="mt-4 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">{t.empty}</p> : (
        <div className="mt-4 space-y-3">
          {facts.map((fact: any, index: number) => {
            const evidence = Array.isArray(fact?.evidence) ? fact.evidence[0] : null;
            const kind = fact?.kind === "inferred_finding" ? t.inferred : fact?.kind === "hypothesis" ? t.hypothesis : t.observed;
            const status = fact?.status === "supported" ? t.supported : fact?.status === "rejected" ? t.rejected : t.validation;
            return (
              <article key={String(fact?.key || index)} className="rounded-xl border border-border/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold" dir="auto">{String(fact?.predicate || "—")}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{kind}</span>
                  <span className="rounded-full border px-2 py-0.5 text-[10px]">{status}</span>
                </div>
                <p className="mt-2 text-sm" dir="auto">{typeof fact?.value === "string" || typeof fact?.value === "number" ? String(fact.value) : "—"}</p>
                {fact?.rationale && <p className="mt-2 text-xs text-muted-foreground" dir="auto">{String(fact.rationale)}</p>}
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <p><span className="font-semibold">{t.source}: </span>{String(evidence?.source_kind || "—")} · {String(evidence?.source_ref || "—")}</p>
                  <p><span className="font-semibold">{t.excerpt}: </span><span dir="auto">{String(evidence?.excerpt || t.noExcerpt)}</span></p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
