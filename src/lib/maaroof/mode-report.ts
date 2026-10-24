// Architecture & Concept: Ahmed Maaroof
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

/** Mode example built from real session data; null when nothing is known (caller keeps the generic text). */
export function liveExample(mode: "simulation" | "recommendation" | "execution", d: { brand?: string; country?: string; lastGoal?: string }, lang: Lang): string | null {
  const b = (d.brand || "").trim(); const c = (d.country || "").trim(); const g = (d.lastGoal || "").trim().slice(0, 80);
  if (!b && !c && !g) return null;
  const who = b || (lang === "en" ? "my brand" : lang === "ku" ? "براندەکەم" : "علامتي");
  const where = c ? (lang === "en" ? ` in ${c}` : lang === "ku" ? ` لە ${c}` : ` في ${c}`) : "";
  const pre = lang === "en" ? "Example from your data: " : lang === "ku" ? "نموونە لە داتاکەت: " : "مثال من بياناتك: ";
  if (g && !b) return `${pre}«${g}»`;
  const ex = mode === "simulation"
    ? (lang === "en" ? `What if ${who} publishes 3 articles a month${where}?` : lang === "ku" ? `چی دەبێت ئەگەر ${who} مانگانە ٣ وتار بڵاو بکاتەوە${where}؟` : `ماذا يحدث لو نشرت ${who} 3 مقالات شهرياً${where}؟`)
    : mode === "recommendation"
    ? (lang === "en" ? `A 3-month plan for ${who}${where}` : lang === "ku" ? `پلانی ٣ مانگ بۆ ${who}${where}` : `خطة 3 أشهر لظهور ${who}${where}`)
    : (lang === "en" ? `Check ${who} across the 10 models${where}` : lang === "ku" ? `${who} لە ١٠ مۆدێلەکەدا بپشکنە${where}` : `افحص ظهور ${who} في النماذج العشرة${where}`);
  return `${pre}«${ex}»`;
}
