// Pure formatters for recommendation / simulation results — never show raw JSON to users.
type Lang = "ar" | "en" | "ku";

/** Strip code fences and JSON blocks a model may still emit. */
export function sanitizeReport(text: string): string {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*[\[{][\s\S]*[\]}]\s*$/g, "")
    .trim();
}

function stepsOf(plan: any): any[] {
  return Array.isArray(plan?.steps) ? plan.steps : Array.isArray(plan) ? plan : [];
}

function stepLine(s: any): string {
  const why = s?.why || s?.reason || s?.purpose || s?.goal || "";
  return `${s?.title || s?.tool || "—"}${why ? ` — ${why}` : ""}`;
}

/** Readable fallback list of plan steps (no code). */
export function planAsList(plan: any, lang: Lang): string {
  const h = lang === "en" ? "Recommended plan (not executed)" : lang === "ku" ? "پلانی پێشنیارکراو (جێبەجێ نەکراوە)" : "الخطة المقترحة (لم تُنفَّذ)";
  const steps = stepsOf(plan);
  if (!steps.length) return `**${h}**`;
  return `**${h}**\n\n${steps.map((s, i) => `${i + 1}. ${stepLine(s)}`).join("\n")}`;
}

/** Simulation summary from plan + council + envision. Labelled as an estimate. */
export function simulationSummary(plan: any, council: any[], envision: any, lang: Lang): string {
  const L = lang === "en"
    ? { t: "Simulation result — estimate, no tools were run", f: "Expected outcome", s: "Simulated steps", c: "Expert opinions", m: "Success metrics" }
    : lang === "ku"
    ? { t: "ئەنجامی هاوشێوەکردن — خەمڵاندن، هیچ ئامرازێک کار نەکرا", f: "ئەنجامی چاوەڕوانکراو", s: "هەنگاوەکان", c: "ڕای پسپۆڕان", m: "پێوەرەکانی سەرکەوتن" }
    : { t: "نتيجة المحاكاة — تقدير، لم تُشغَّل أي أداة", f: "النتيجة المتوقعة", s: "الخطوات المحاكاة", c: "آراء الخبراء", m: "مؤشرات النجاح" };
  const out: string[] = [`**${L.t}**`];
  if (envision?.future_goal) out.push(`### ${L.f}\n${envision.future_goal}`);
  const steps = stepsOf(plan);
  if (steps.length) out.push(`### ${L.s}\n${steps.map((s, i) => `${i + 1}. ${stepLine(s)}`).join("\n")}`);
  const ops = (council || []).filter((d) => d?.phase === "council" || d?.opinion || d?.verdict).slice(0, 6);
  if (ops.length) out.push(`### ${L.c}\n${ops.map((d) => `- ${d.expert || d.role || ""}${d.expert || d.role ? ": " : ""}${d.opinion || d.verdict || d.summary || ""}`).join("\n")}`);
  const m = Array.isArray(envision?.success_metrics) ? envision.success_metrics : [];
  if (m.length) out.push(`### ${L.m}\n${m.map((x: any) => `- ${x}`).join("\n")}`);
  return out.join("\n\n");
}
