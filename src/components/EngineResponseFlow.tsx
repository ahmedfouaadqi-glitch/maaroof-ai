import { useI18n } from "@/lib/i18n";
import { ENGINES } from "@/components/engine-logos";
import { ENGINE_FAMILY, FAMILY_FOCUS, FAMILY_LABEL } from "@/lib/engine-families";
import type { EngineKey } from "@/lib/ai-engines";

export type EngineAnswer = {
  key: EngineKey;
  score?: number | null;
  verdict?: string;
  text?: string;
  action?: string;
  /** measured = real call to the engine; estimated = algorithmic estimate. */
  basis?: "measured" | "estimated" | "recommended";
  /** Optional list (e.g. competitor names an engine returned). */
  items?: string[];
  /** Real call outcome, shown when the engine produced nothing. */
  status?: "answered" | "empty" | "timeout" | "error" | "not_called";
};

import { TermHint } from "@/components/TermHint";
const TX = {
  ar: { title: "كيف تُجيب النماذج العشرة", measured: "إجابة فعلية", estimated: "تقدير خوارزمي", recommended: "توصية", focus: "ما يهم هذا المحرك", none: "لم يُرجع هذا المحرك إجابة في هذا الفحص", action: "الخطوة" },
  en: { title: "How the ten engines answer", measured: "Live answer", estimated: "Algorithmic estimate", recommended: "Recommendation", focus: "What this engine values", none: "No answer from this engine in this run", action: "Next step" },
  ku: { title: "نۆ بزوێنەرەکە چۆن وەڵام دەدەنەوە", measured: "وەڵامی ڕاستەقینە", estimated: "خەمڵاندنی ئەلگۆریتمی", recommended: "پێشنیار", focus: "ئەوەی بۆ ئەم بزوێنەرە گرنگە", none: "ئەم بزوێنەرە وەڵامی نەدایەوە", action: "هەنگاو" },
};

const STATUS_TX = {
  ar: { empty: "سُئل النموذج لكنه لم يذكر أسماء", timeout: "انتهت مهلة الانتظار قبل أن يرد", error: "تعذّر الوصول إلى النموذج هذه المرة", not_called: "لم يُسأل لأنه غير متاح حالياً" },
  en: { empty: "Asked, but named no entities", timeout: "Timed out before replying", error: "Could not reach this model this time", not_called: "Not asked — currently unavailable" },
  ku: { empty: "پرسیاری لێکرا بەڵام ناوی نەهێنا", timeout: "کات تەواو بوو پێش وەڵام", error: "ئەم جارە نەگەیشتین بە مۆدێلەکە", not_called: "نەپرسرا — ئێستا بەردەست نییە" },
} as const;

/**
 * Shared animated view of per-engine answers with official logos.
 * Pure presentation: it never changes how a tool computes its result.
 */
export function EngineResponseFlow({ answers, title, compact = false }: { answers: EngineAnswer[]; title?: string; compact?: boolean }) {
  const { lang } = useI18n();
  const L = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  const T = TX[L];
  const byKey = new Map(answers.map((a) => [a.key, a]));
  const rows = ENGINES.map((e) => ({ e, a: byKey.get(e.key) }));

  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <div className="mb-3 text-xs font-semibold text-primary">{title || T.title}</div>
      <div className={`grid gap-2 ${compact ? "grid-cols-1 sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {rows.map(({ e, a }, i) => {
          const fam = ENGINE_FAMILY[e.key];
          const score = typeof a?.score === "number" ? Math.max(0, Math.min(100, Math.round(a.score))) : null;
          const empty = !a || (score === null && !a.text && !a.verdict && !(a.items?.length));
          return (
            <div
              key={e.key}
              className={`engine-reveal relative overflow-hidden rounded-lg border border-border bg-gradient-to-br ${e.tint} p-3 ${empty ? "opacity-50" : ""}`}
              style={{ animationDelay: `${i * 110}ms` }}
            >
              <div className="flex items-center gap-2">
                <span className="engine-logo-pulse grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-background" style={{ animationDelay: `${i * 110 + 300}ms` }}>
                  <e.Logo size={20} />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight">{e.name}</div>
                  <div className="text-[10px] text-muted-foreground">{FAMILY_LABEL[fam][L]}</div>
                </div>
                {score !== null && <span className="ms-auto rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">{score}%</span>}
              </div>
              {score !== null && (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted/50">
                  <div className="engine-bar h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${score}%`, animationDelay: `${i * 110 + 200}ms` }} />
                </div>
              )}
              {a?.basis && !empty && (
                <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] ${a.basis === "measured" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                  <TermHint term={a.basis === "measured" ? "measured" : "estimated"}>{a.basis === "measured" ? T.measured : a.basis === "recommended" ? T.recommended : T.estimated}</TermHint>
                </span>
              )}
              {a?.verdict && <div className="mt-1 text-[11px] font-medium text-accent">{a.verdict}</div>}
              {a?.text && <p className="engine-type mt-1 text-xs leading-relaxed text-foreground/85" style={{ animationDelay: `${i * 110 + 350}ms` }}>{a.text}</p>}
              {a?.items && a.items.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {a.items.slice(0, 8).map((x) => <span key={x} className="rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[10px]">{x}</span>)}
                </div>
              )}
              {a?.action && <div className="mt-2 rounded border border-accent/30 bg-accent/10 px-2 py-1 text-[11px]"><b>{T.action}:</b> {a.action}</div>}
              {empty && <p className="mt-1 text-[11px] text-muted-foreground">{(a?.status && a.status !== "answered" && STATUS_TX[L][a.status]) || T.none}</p>}
              {!compact && <p className="mt-2 border-t border-border/50 pt-1.5 text-[10px] text-muted-foreground"><b>{T.focus}:</b> {FAMILY_FOCUS[fam][L]}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
