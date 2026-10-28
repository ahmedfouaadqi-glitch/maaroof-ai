// Pure: owner-approved ingestion windows for new keywords (see project memory).
export const INGESTION_WINDOWS = { initialDays: 20, fullMonths: 3 } as const;

type L = "ar" | "en" | "ku";

/** Initial indexing window (classic search + instant generative search). */
export function initialIngestionLabel(l: L): string {
  const d = INGESTION_WINDOWS.initialDays;
  return l === "ar" ? `${d} يوماً (فهرسة أولية)` : l === "ku" ? `${d} ڕۆژ (ئیندێکسی سەرەتایی)` : `${d} days (initial indexing)`;
}

/** Full semantic absorption window across AI models. */
export function fullIngestionLabel(l: L): string {
  const m = INGESTION_WINDOWS.fullMonths;
  return l === "ar" ? `${m} أشهر (استيعاب شامل للنماذج)` : l === "ku" ? `${m} مانگ (تێگەیشتنی تەواوی مۆدێلەکان)` : `${m} months (full model absorption)`;
}

/** Existing keywords are already published, so no ingestion window applies. */
export function ingestionFor(isNew: boolean, l: L): { initial: string; full: string } {
  if (!isNew) {
    const done = l === "ar" ? "منشورة حالياً" : l === "ku" ? "ئێستا بڵاوکراوەتەوە" : "Already published";
    return { initial: done, full: done };
  }
  return { initial: initialIngestionLabel(l), full: fullIngestionLabel(l) };
}
