import { useMemo } from "react";

type Lang = "ar" | "en" | "ku";
type Event = { type: string; data?: any };
type Props = { events: Event[]; lang: Lang };

const copy = {
  ar: {
    title: "مراجعة التدقيق والتحقق",
    subtitle: "خطوات مراجعة يدوية مشتقة حصراً من الحقائق المستخرجة؛ لا تنفذ إجراءات خارجية.",
    supported: "حقائق مدعومة", review: "تحتاج تحققاً", rejected: "مرفوضة",
    tasks: "مراجعات مطلوبة", noTasks: "لا توجد استنتاجات معلّقة للتحقق ضمن البيانات المستخرجة.",
    verify: "تحقق مستقلاً من", source: "الدليل المسجل", noEvidence: "لا يوجد دليل صالح",
    boundary: "حدود هذه المرحلة", boundaryText: "هذه مراجعات بشرية مقترحة وليست توصيات تجارية أو أوامر تنفيذ. لا تتضمن تقديرات أثر أو تكلفة أو عائد غير موثق.",
  },
  en: {
    title: "Audit review & validation",
    subtitle: "Manual review steps derived only from extracted facts; no external actions are executed.",
    supported: "Supported facts", review: "Needs validation", rejected: "Rejected",
    tasks: "Required reviews", noTasks: "No pending inferences require validation in the extracted data.",
    verify: "Independently verify", source: "Recorded evidence", noEvidence: "No valid evidence",
    boundary: "Stage boundary", boundaryText: "These are human review prompts, not commercial recommendations or execution commands. No unsupported impact, cost, or return estimates are provided.",
  },
  ku: {
    title: "پێداچوونەوە و پشتڕاستکردنەوە",
    subtitle: "هەنگاوە دەستییەکانی پێداچوونەوە تەنها لە ڕاستییە دەرهێنراوەکانەوە وەردەگیرێن؛ هیچ کردارێکی دەرەکی جێبەجێ ناکرێت.",
    supported: "ڕاستیی پشتگیریکراو", review: "پێویستی بە پشتڕاستکردنەوە", rejected: "ڕەتکراوە",
    tasks: "پێداچوونەوە پێویستەکان", noTasks: "هیچ ئەنجامگیرییەکی چاوەڕوانی پشتڕاستکردنەوە نییە.",
    verify: "بە سەربەخۆیی پشتڕاستی بکەرەوە", source: "بەڵگەی تۆمارکراو", noEvidence: "بەڵگەی دروست نییە",
    boundary: "سنووری ئەم قۆناغە", boundaryText: "ئەمە تەنها داواکاری پێداچوونەوەی مرۆڤییە، نەک پێشنیاری بازرگانی یان فەرمانی جێبەجێکردن. هیچ خەمڵاندنی پشتڕاستنەکراوی کاریگەری، تێچوو یان قازانج نییە.",
  },
} as const;

export function SiteAuditReviewPanel({ events, lang }: Props) {
  const data = useMemo(() => [...events].reverse().find((event) => event.type === "site_discovery")?.data, [events]);
  const facts = Array.isArray(data?.discovered_facts) ? data.discovered_facts : [];
  if (!data?.discovery || facts.length === 0) return null;
  const t = copy[lang] || copy.ar;
  const supported = facts.filter((fact: any) => fact?.status === "supported");
  const pending = facts.filter((fact: any) => fact?.status === "needs_validation" || fact?.kind === "hypothesis");
  const rejected = facts.filter((fact: any) => fact?.status === "rejected");
  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5" aria-labelledby="site-audit-review-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="site-audit-review-title" className="font-semibold">{t.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t.subtitle}</p>
        </div>
        <span className="rounded-full border px-2 py-1 text-[11px] tabular-nums">{facts.length}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-muted/50 p-3"><p className="text-lg font-semibold tabular-nums">{supported.length}</p><p className="text-[11px] text-muted-foreground">{t.supported}</p></div>
        <div className="rounded-xl bg-muted/50 p-3"><p className="text-lg font-semibold tabular-nums">{pending.length}</p><p className="text-[11px] text-muted-foreground">{t.review}</p></div>
        <div className="rounded-xl bg-muted/50 p-3"><p className="text-lg font-semibold tabular-nums">{rejected.length}</p><p className="text-[11px] text-muted-foreground">{t.rejected}</p></div>
      </div>
      <div className="mt-4">
        <h4 className="text-sm font-semibold">{t.tasks}</h4>
        {pending.length === 0 ? <p className="mt-2 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">{t.noTasks}</p> : (
          <ol className="mt-2 space-y-2">
            {pending.map((fact: any, index: number) => {
              const evidence = Array.isArray(fact?.evidence) ? fact.evidence[0] : null;
              return <li key={String(fact?.key || index)} className="rounded-xl border border-border/70 p-3">
                <p className="text-sm font-medium" dir="auto">{t.verify}: {String(fact?.predicate || "—")} — {String(fact?.value ?? "—")}</p>
                {fact?.rationale && <p className="mt-1 text-xs text-muted-foreground" dir="auto">{String(fact.rationale)}</p>}
                <p className="mt-2 text-xs text-muted-foreground" dir="auto">{t.source}: {evidence ? String(evidence.source_ref || evidence.source_kind || "—") : t.noEvidence}</p>
              </li>;
            })}
          </ol>
        )}
      </div>
      <div className="mt-4 rounded-xl border border-dashed border-border p-3">
        <p className="text-xs font-semibold">{t.boundary}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t.boundaryText}</p>
      </div>
    </section>
  );
}
