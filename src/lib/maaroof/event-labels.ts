// Pure, localized labels for workspace activity events. No I/O.
export type Lang = "ar" | "en" | "ku";

const PHASES: Record<string, Record<Lang, string>> = {
  imagination: { ar: "التصور", en: "Imagination", ku: "وێناکردن" },
  planning: { ar: "التخطيط", en: "Planning", ku: "پلاندانان" },
  council: { ar: "المجلس", en: "Council", ku: "ئەنجومەن" },
  conflict_resolution: { ar: "حل التعارض", en: "Conflict resolution", ku: "چارەسەری ناکۆکی" },
  execution: { ar: "التنفيذ", en: "Execution", ku: "جێبەجێکردن" },
  synthesis: { ar: "التجميع", en: "Synthesis", ku: "کۆکردنەوە" },
  report: { ar: "التقرير", en: "Report", ku: "ڕاپۆرت" },
};

export function phaseLabel(phase: unknown, lang: Lang): string {
  const k = String(phase || "").trim().toLowerCase();
  return PHASES[k]?.[lang] || String(phase || "");
}

const SKIP_CODES = ["live_probe_disabled_by_user", "skipped", "disabled_by_user", "not_requested"];

/** An intentional skip (e.g. the user turned live checks off) is not a failure. */
export function isIntentionalSkip(data: Record<string, any> | null | undefined): boolean {
  if (!data) return false;
  const fields = [data.reason, data.error, data.status, data.output?.reason, data.output?.status, data.output?.error];
  return data.skipped === true || data.output?.skipped === true || fields.some((f) => typeof f === "string" && SKIP_CODES.some((c) => f.includes(c)));
}

/** Readable one-line summary of a tool output; null when nothing readable is present. */
export function summarizeToolOutput(output: unknown, lang: Lang): string | null {
  if (typeof output === "string") return output.trim() ? output.slice(0, 500) : null;
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, any>;
  const direct = o.summary || o.answer || o.text || o.message || o.verdict;
  if (typeof direct === "string" && direct.trim()) return direct.slice(0, 500);
  if (Array.isArray(o.brands) && o.brands.length) {
    const names = o.brands.map((b: any) => (typeof b === "string" ? b : b?.name || b?.brand)).filter(Boolean).slice(0, 6);
    const n = o.brands.length;
    return lang === "en" ? `Compared ${n} brands: ${names.join(", ")}` : lang === "ku" ? `${n} براند بەراورد کرا: ${names.join("، ")}` : `قورنت ${n} علامات: ${names.join("، ")}`;
  }
  const list = o.steps || o.actions || o.recommendations || o.plan || o.items;
  if (Array.isArray(list) && list.length) {
    const first = list.map((x: any) => (typeof x === "string" ? x : x?.title || x?.action || x?.name)).filter(Boolean).slice(0, 3);
    return lang === "en" ? `${list.length} recommendations${first.length ? `: ${first.join("; ")}` : ""}` : lang === "ku" ? `${list.length} پێشنیار${first.length ? `: ${first.join("؛ ")}` : ""}` : `${list.length} توصيات${first.length ? `: ${first.join("؛ ")}` : ""}`;
  }
  if (typeof o.score === "number") return lang === "en" ? `Score: ${o.score}` : lang === "ku" ? `نمرە: ${o.score}` : `النتيجة: ${o.score}`;
  return null;
}

/** Task weight from planned size: light / medium / deep. */
export function taskWeight(steps: number, engines: number): "light" | "medium" | "deep" {
  const load = Math.max(0, steps) * Math.max(1, engines);
  if (load <= 10) return "light";
  if (load <= 40) return "medium";
  return "deep";
}
