/** Shows the recorded critical-debate event: agreement, contest, evidence (linked) vs hypothesis. */
export function DebateCard({ data, locale }: { data: any; locale: "ar" | "en" | "ku" }) {
  if (!data || !data.experts) return null;
  const t = (ar: string, en: string, ku: string) => (locale === "en" ? en : locale === "ku" ? ku : ar);
  return (
    <details className="rounded-2xl border border-border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-semibold">{data.conflictType === "engine_visibility_disagreement" ? t("مناظرة النماذج الحية", "Live engine debate", "گفتوگۆی مۆدێلە زیندووەکان") : t("المناظرة النقدية", "Critical debate", "گفتوگۆی ڕەخنەیی")} · {data.experts} {t("خبراء", "experts", "پسپۆڕ")} · <span className="text-primary">{data.evidenceCount} {t("دليل برابط", "linked evidence", "بەڵگە")}</span> · <span className="text-muted-foreground">{data.hypothesisCount} {t("فرضية", "hypotheses", "گریمانە")}</span></summary>
      <div className="mt-3 space-y-2">
        {data.conflictType === "engine_visibility_disagreement" && <p className="rounded-lg border border-warning/30 bg-warning/5 p-2 text-xs">{t("اختلفت نتائج النماذج حول ظهور الكيان؛ النصوص أدناه إجابات النماذج وليست إثباتاً مستقلاً.", "Engines disagreed about entity appearance; these are model outputs, not independent proof.", "مۆدێلەکان لەسەر دەرکەوتنی کەسایەتی ناکۆکن؛ ئەمانە وەڵامی مۆدێلەکانن، نە بەڵگەی سەربەخۆ.")}</p>}
        {data.resolution && <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="font-semibold text-primary">{t("حسم معروف", "Maaroof’s resolution", "چارەسەری معروف")}</p>
          <p className="mt-1">{String(data.resolution.chosen || t("غير محسوم", "Unresolved", "چارەسەرنەکراو"))}</p>
          {data.resolution.why && <p className="mt-1 text-muted-foreground">{String(data.resolution.why)}</p>}
          {data.resolution.residual_risk && <p className="mt-1 text-xs text-muted-foreground">{t("المتبقي من عدم اليقين: ", "Residual uncertainty: ", "دڵنیایی نەماو: ")}{String(data.resolution.residual_risk)}</p>}
          {Array.isArray(data.resolution.positions) && data.resolution.positions.length > 0 && <div className="mt-2 space-y-1">{data.resolution.positions.slice(0, 8).map((p: any, i: number) => <p key={i} className="text-xs">{String(p.engine || p.expert || "Engine")}: {String(p.claim || "")}{typeof p.score === "number" ? " · " + Math.round(p.score * 100) + "%" : ""}</p>)}</div>}
        </div>}
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
