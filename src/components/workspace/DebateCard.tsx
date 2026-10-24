/** Shows the recorded critical-debate event: agreement, contest, evidence (linked) vs hypothesis. */
export function DebateCard({ data, locale }: { data: any; locale: "ar" | "en" | "ku" }) {
  if (!data || !data.experts) return null;
  const t = (ar: string, en: string, ku: string) => (locale === "en" ? en : locale === "ku" ? ku : ar);
  return (
    <details className="rounded-2xl border border-border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-semibold">{t("المناظرة النقدية", "Critical debate", "گفتوگۆی ڕەخنەیی")} · {data.experts} {t("خبراء", "experts", "پسپۆڕ")} · <span className="text-primary">{data.evidenceCount} {t("دليل برابط", "linked evidence", "بەڵگە")}</span> · <span className="text-muted-foreground">{data.hypothesisCount} {t("فرضية", "hypotheses", "گریمانە")}</span></summary>
      <div className="mt-3 space-y-2">
        {data.agreedTools?.length > 0 && <p>{t("اتفقوا على: ", "Agreed on: ", "ڕێککەوتن: ")}{data.agreedTools.join("، ")}</p>}
        {data.contestedTools?.length > 0 && <p className="text-muted-foreground">{t("اختلفوا على: ", "Contested: ", "ناکۆکی: ")}{data.contestedTools.join("، ")}</p>}
        {data.objections?.map((o: any, i: number) => <p key={i} className="text-destructive">{t("اعتراض: ", "Objection: ", "ناڕەزایی: ")}{o.text}</p>)}
        {data.claims?.map((c: any, i: number) => (
          <div key={i} className="rounded-lg bg-muted/50 p-2">
            <span className={`me-2 rounded-full px-2 py-0.5 text-xs font-semibold ${c.kind === "evidence" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{c.kind === "evidence" ? t("دليل", "Evidence", "بەڵگە") : t("فرضية", "Hypothesis", "گریمانە")}</span>
            {c.text}
            {c.links?.map((l: string) => <a key={l} href={l} target="_blank" rel="noreferrer" className="ms-2 text-xs text-primary underline">{l}</a>)}
          </div>
        ))}
      </div>
    </details>
  );
}
