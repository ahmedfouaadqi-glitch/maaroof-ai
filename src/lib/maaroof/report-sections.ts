// Architecture & Concept: Ahmed Maaroof
// Pure helpers: turn agent session events into readable report sections.
// Never emits raw JSON in the readable part; technical data is an opt-in section.
import { sectionsFromResult } from "@/lib/export-bus";
import type { ExportSection } from "@/lib/exports";
import { scrubModelNames } from "@/lib/maaroof/model-council";

export type SessionEvent = { type: string; data: any; t?: number };
export type ReportSelection = {
  /** step indexes to include; undefined = all */
  steps?: number[];
  includeTechnical?: boolean;
  includeProcess?: boolean; // experts, reflections, questions
};

const TECH_KEYS = new Set(["mci", "usage", "raw", "debug", "trace", "ok", "tokens", "cost_usd", "model_raw", "_meta", "model", "provider", "endpoint", "proxy", "via"]);

const KEY_LABELS: Record<string, { ar: string; ku: string }> = {
  engine: { ar: "النموذج", ku: "بزوێنەر" }, engines: { ar: "النماذج", ku: "بزوێنەرەکان" }, mentioned: { ar: "مذكور", ku: "باسکراوە" },
  reason: { ar: "السبب", ku: "هۆکار" }, rank: { ar: "الترتيب", ku: "پلە" }, answer: { ar: "الإجابة", ku: "وەڵام" }, answers: { ar: "الإجابات", ku: "وەڵامەکان" },
  brands: { ar: "العلامات المرشحة", ku: "براندەکان" }, query: { ar: "السؤال", ku: "پرسیار" }, asked: { ar: "النماذج المسؤولة", ku: "پرسیارلێکراوەکان" },
  summary: { ar: "الملخص", ku: "پوختە" }, score: { ar: "الدرجة", ku: "نمرە" }, platform: { ar: "المنصة", ku: "پلاتفۆرم" }, platforms: { ar: "المنصات", ku: "پلاتفۆرمەکان" },
  title: { ar: "العنوان", ku: "ناونیشان" }, kpi: { ar: "مؤشر الأداء", ku: "پێوەر" }, week: { ar: "الأسبوع", ku: "هەفتە" }, month: { ar: "الشهر", ku: "مانگ" },
  day: { ar: "اليوم", ku: "ڕۆژ" }, hour: { ar: "الساعة", ku: "کاتژمێر" }, horizon: { ar: "المدة", ku: "ماوە" }, risks: { ar: "المخاطر", ku: "مەترسییەکان" },
  council: { ar: "مجلس النماذج", ku: "ئەنجومەن" }, agreement: { ar: "الاتفاق", ku: "ڕێککەوتن" }, disagreement: { ar: "الخلاف", ku: "ناکۆکی" }, decision: { ar: "القرار", ku: "بڕیار" },
  "mentioned by": { ar: "ذكرها", ku: "باسیکرد" }, "silent on": { ar: "لم يذكرها", ku: "باسی نەکرد" }, "consensus brands": { ar: "علامات متفق عليها", ku: "براندە هاوبەشەکان" },
  "priority keywords": { ar: "الكلمات ذات الأولوية", ku: "وشە گرنگەکان" }, "content types": { ar: "أنواع المحتوى", ku: "جۆری ناوەڕۆک" }, "priority platforms": { ar: "المنصات ذات الأولوية", ku: "پلاتفۆرمە گرنگەکان" },
  "editorial calendar": { ar: "التقويم التحريري", ku: "ساڵنامەی ناوەڕۆک" }, "kpi targets": { ar: "أهداف المؤشرات", ku: "ئامانجەکان" }, type: { ar: "النوع", ku: "جۆر" },
  visibility: { ar: "الظهور", ku: "دەرکەوتن" }, probe: { ar: "الفحص الحي", ku: "پشکنینی ڕاستەوخۆ" }, basis: { ar: "الأساس", ku: "بنەما" }, charged: { ar: "المخصوم", ku: "بڕاو" },
  "frequency hours": { ar: "تكرار الفحص (بالساعات)", ku: "دووبارەبوونەوە (کاتژمێر)" }, active: { ar: "نشط", ku: "چالاک" }, cached: { ar: "مخزّن مسبقاً", ku: "پاشەکەوتکراو" },
  local: { ar: "محلي", ku: "ناوخۆیی" }, status: { ar: "الحالة", ku: "دۆخ" }, competitors: { ar: "المنافسون", ku: "ڕکابەران" }, keywords: { ar: "الكلمات المفتاحية", ku: "وشە سەرەکییەکان" },
  brand: { ar: "العلامة", ku: "براند" }, url: { ar: "الرابط", ku: "بەستەر" }, name: { ar: "الاسم", ku: "ناو" }, "created at": { ar: "تاريخ الإنشاء", ku: "بەرواری دروستکردن" },
  "updated at": { ar: "تاريخ التحديث", ku: "بەرواری نوێکردنەوە" }, "last checked at": { ar: "آخر فحص", ku: "دوایین پشکنین" }, confidence: { ar: "الثقة", ku: "متمانە" },
  evidence: { ar: "الدليل", ku: "بەڵگە" }, recommendations: { ar: "التوصيات", ku: "پێشنیارەکان" }, posts: { ar: "المنشورات", ku: "پۆستەکان" }, content: { ar: "المحتوى", ku: "ناوەڕۆک" },
  estimated: { ar: "مقدّر", ku: "خەمڵێنراو" }, live: { ar: "حي", ku: "ڕاستەوخۆ" }, pending: { ar: "قيد الانتظار", ku: "چاوەڕوان" }, failed: { ar: "فشل", ku: "شکستی هێنا" },
  success: { ar: "نجاح", ku: "سەرکەوتوو" }, reused: { ar: "أعيد استخدامه", ku: "دووبارە بەکارهات" }, insights: { ar: "الرؤى", ku: "تێڕوانینەکان" }, gaps: { ar: "الفجوات", ku: "کەلێنەکان" },
  "realism note": { ar: "ملاحظة واقعية", ku: "تێبینی" }, sources: { ar: "المصادر", ku: "سەرچاوەکان" }, true: { ar: "نعم", ku: "بەڵێ" }, false: { ar: "لا", ku: "نەخێر" }, measured: { ar: "مقاس حي", ku: "پێوراو" },
};
let CUR_LANG = "en";
/** Arabic label -> English, so English exports never keep Arabic UI words. */
const AR_TO_EN: Record<string, string> = Object.fromEntries(Object.entries(KEY_LABELS).map(([k, v]) => [v.ar, k.replace(/\b\w/g, (c) => c.toUpperCase())]));
/** One-line hints for terms that appear in reports. */
export const GLOSSARY: Record<string, { ar: string; en: string; ku: string }> = {
  "frequency hours": { ar: "عدد الساعات بين كل فحص تلقائي والذي يليه.", en: "Hours between one automatic check and the next.", ku: "ژمارەی کاتژمێر لە نێوان دوو پشکنینی خۆکاردا." },
  active: { ar: "المراقبة تعمل حالياً وتفحص في موعدها.", en: "Monitoring is running and checks on schedule.", ku: "چاودێری کاردەکات." },
  cached: { ar: "نتيجة سابقة أعيد استخدامها دون كلفة إضافية.", en: "A previous result reused at no extra cost.", ku: "ئەنجامێکی پێشوو بەبێ تێچوو." },
  local: { ar: "فحص داخل المنصة دون استدعاء نموذج مدفوع.", en: "Checked inside the platform without a paid model call.", ku: "پشکنین لەناو پلاتفۆرم بەبێ تێچوو." },
  measured: { ar: "رقم مأخوذ من إجابة حقيقية للنموذج الآن.", en: "Number taken from a real model answer just now.", ku: "ژمارە لە وەڵامی ڕاستەقینە." },
  estimated: { ar: "تقدير مبني على بيانات متاحة وليس قياساً حياً.", en: "An estimate from available data, not a live measurement.", ku: "خەمڵاندن، نەک پێوانی ڕاستەوخۆ." },
  confidence: { ar: "مدى قوة الأدلة التي تدعم النتيجة.", en: "How strongly the evidence supports the result.", ku: "هێزی بەڵگەکان." },
  "share of voice": { ar: "نسبة ذكر علامتك مقارنة بالمنافسين في إجابات النماذج.", en: "How often your brand is named versus competitors in AI answers.", ku: "ڕێژەی باسکردنی براندەکەت." },
};
const VALUE_WORDS: Record<string, string> = { true: "true", false: "false", active: "active", cached: "cached", local: "local", estimated: "estimated", measured: "measured", live: "live", pending: "pending", failed: "failed", success: "success" };
/** Translate a short fixed value (yes/no, status words) into the export language. */
export function localizeValue(v: any, lang = CUR_LANG): any {
  if (typeof v === "boolean") v = String(v);
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (lang === "en") return AR_TO_EN[t] ?? v;
  const k = VALUE_WORDS[t.toLowerCase()];
  return k ? labelFor(k, lang) : v;
}
/** Glossary section listing only the terms that appear in the given sections. */
export function glossarySection(sections: ExportSection[], lang: string): ExportSection | null {
  const hay = JSON.stringify(sections).toLowerCase();
  const items = Object.entries(GLOSSARY).filter(([k]) => hay.includes(k) || hay.includes(labelFor(k, lang).toLowerCase()))
    .map(([k, g]) => `${lang === "en" ? k.replace(/\b\w/g, (c) => c.toUpperCase()) : labelFor(k, lang)}: ${g[lang as "ar" | "en" | "ku"] || g.en}`);
  return items.length ? { heading: lang === "en" ? "Glossary" : lang === "ku" ? "فەرهەنگ" : "معجم المصطلحات", kind: "list", list: items } : null;
}
/** Localized label for a JSON key (falls back to the readable key). */
export function labelFor(k: string, lang = CUR_LANG): string {
  const h = k.replace(/[_.-]+/g, " ").replace(/\s+/g, " ").trim();
  if (lang !== "ar" && lang !== "ku") return AR_TO_EN[h] ?? h;
  const e = KEY_LABELS[h.toLowerCase()];
  return e ? e[lang as "ar" | "ku"] : h;
}
const humanize = (k: string) => labelFor(k);

/** Flatten any value into readable text (no braces, no JSON). */
export function flattenValue(v: any, depth = 0): string {
  if (v == null) return "";
  if (typeof v === "string") {
    const s = v.trim();
    if ((s.startsWith("{") || s.startsWith("[")) && depth < 4) {
      try { return flattenValue(JSON.parse(s), depth + 1); } catch { /* keep text */ }
    }
    return s.replace(/[{}]/g, "");
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map((x) => flattenValue(x, depth + 1)).filter(Boolean).join(" • ");
  if (typeof v === "object") {
    return Object.entries(v)
      .filter(([k, x]) => !TECH_KEYS.has(k) && x != null && x !== "")
      .map(([k, x]) => `${humanize(k)}: ${flattenValue(x, depth + 1)}`)
      .join(" — ");
  }
  return String(v);
}

function stripTech(o: any, depth = 0): any {
  if (Array.isArray(o)) return o.map((x) => stripTech(x, depth + 1));
  if (o && typeof o === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(o)) if (!TECH_KEYS.has(k)) out[k] = stripTech(v, depth + 1);
    return out;
  }
  return o;
}

function scrub(s: ExportSection): ExportSection {
  const c: any = { ...s };
  const f = (x: any) => scrubModelNames(String(localizeValue(flattenValue(x))));
  if (typeof c.heading === "string") c.heading = scrubModelNames(c.heading.split(" · ").map((p: string) => labelFor(p)).join(" · "));
  if (Array.isArray(c.rows)) c.rows = c.rows.map(([k, v]: any) => [typeof k === "string" ? labelFor(k) : k, v]);
  if (c.table?.columns) c.table = { ...c.table, columns: c.table.columns.map((x: any) => (typeof x === "string" ? labelFor(x) : x)) };
  if (typeof c.text === "string") c.text = f(c.text);
  if (Array.isArray(c.list)) c.list = c.list.map((x: any) => f(x));
  if (Array.isArray(c.rows)) c.rows = c.rows.map(([k, v]: any) => [k, typeof v === "number" ? v : f(v)]);
  if (c.table) c.table = { ...c.table, data: c.table.data.map((r: any[]) => r.map((x) => (typeof x === "number" ? x : f(x)))) };
  return c;
}

/** Readable sections for one tool output. */
export function sectionsForTool(tool: string, output: any): ExportSection[] {
  try {
    return sectionsFromResult(stripTech(output), humanize(tool)).map(scrub);
  } catch {
    return [];
  }
}

const ANSWER_KEYS = ["summary", "verdict", "answer", "recommendation", "conclusion", "headline", "overview", "result", "message"];

/** One or two readable sentences that answer "what did this tool find?". Empty when nothing suitable. */
export function directAnswer(output: any, max = 240): string {
  if (!output || typeof output !== "object") return "";
  for (const k of ANSWER_KEYS) {
    const v = output[k];
    if (typeof v === "string" && v.trim().length > 8) return clip(flattenValue(v), max);
  }
  for (const v of Object.values(output)) {
    if (typeof v === "string" && v.trim().length > 40 && !v.trim().startsWith("{")) return clip(flattenValue(v), max);
  }
  const flat = flattenValue(stripTech(output));
  return flat ? clip(flat, max) : "";
}

function clip(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

type StepView = { index: number; tool: string; reason: string; ok: boolean; output: any; input: any };

export function collectSteps(events: SessionEvent[]): StepView[] {
  const calls = new Map<number, { tool: string; reason: string; input: any }>();
  const res = new Map<number, { ok: boolean; output: any }>();
  for (const e of events) {
    const i = Number(e.data?.index);
    if (!Number.isFinite(i)) continue;
    if (e.type === "tool_call") calls.set(i, { tool: String(e.data?.tool || ""), reason: String(e.data?.reason || ""), input: e.data?.input });
    if (e.type === "tool_result") res.set(i, { ok: !!e.data?.ok, output: e.data?.output });
  }
  return [...calls.entries()].sort((a, b) => a[0] - b[0]).map(([index, c]) => ({
    index, tool: c.tool, reason: c.reason, input: c.input, ok: res.get(index)?.ok ?? false, output: res.get(index)?.output,
  }));
}

const L = (lang: string, ar: string, en: string, ku?: string) => (lang === "en" ? en : lang === "ku" ? ku || en : ar);

/** Build the full, readable session report. */
export function buildSessionSections(args: {
  events: SessionEvent[];
  lang: string;
  goal: string;
  finalText?: string;
  selection?: ReportSelection;
}): ExportSection[] {
  const { events, lang, goal, finalText } = args;
  const prevLang = CUR_LANG; CUR_LANG = lang;
  try { return buildInner(); } finally { CUR_LANG = prevLang; }
  function buildInner(): ExportSection[] {
  const sel = args.selection || {};
  const out: ExportSection[] = [];
  const steps = collectSteps(events);
  const chosen = steps.filter((s) => !sel.steps || sel.steps.includes(s.index));
  const all = !sel.steps;

  out.push({ heading: L(lang, "الهدف", "Goal", "ئامانج"), kind: "text", text: flattenValue(goal) });
  if (all && finalText) out.push({ heading: L(lang, "الخلاصة التنفيذية", "Executive summary", "پوختە"), kind: "text", text: flattenValue(finalText) });

  for (const s of chosen) {
    const title = `${s.index + 1}. ${humanize(s.tool)}`;
    if (!s.ok) {
      out.push({ heading: title, kind: "text", text: L(lang, "لم تكتمل هذه الخطوة ولم يُخصم عنها رصيد.", "This step did not complete and was not charged.") });
      continue;
    }
    const ans = directAnswer(s.output);
    if (ans) out.push({ heading: `${title} — ${L(lang, "الإجابة المباشرة", "Direct answer")}`, kind: "text", text: ans });
    if (s.reason) out.push({ heading: `${title} — ${L(lang, "لماذا هذه الأداة", "Why this tool")}`, kind: "text", text: flattenValue(s.reason) });
    out.push(...sectionsForTool(s.tool, s.output).map((x) => ({ ...x, heading: `${title} · ${x.heading || ""}`.replace(/ · $/, "") })));
  }

  if (sel.includeProcess !== false && all) {
    const council = events.filter((e) => e.type === "council").map((e) => `${flattenValue(e.data?.expert || e.data?.capability)}: ${flattenValue(e.data?.opinion || e.data?.error)}`);
    if (council.length) out.push({ heading: L(lang, "مجلس الخبراء", "Expert council", "ئەنجومەنی شارەزایان"), kind: "list", list: council });
    const refl = events.filter((e) => e.type === "reflection").map((e) => flattenValue(e.data?.text));
    if (refl.length) out.push({ heading: L(lang, "المراجعة الذاتية", "Self-review", "پێداچوونەوە"), kind: "list", list: refl.filter(Boolean) });
    const clar = events.filter((e) => e.type === "clarify").map((e) => flattenValue(e.data?.question));
    if (clar.length) out.push({ heading: L(lang, "الأسئلة المطروحة", "Questions asked"), kind: "list", list: clar.filter(Boolean) });
    const done = [...events].reverse().find((e) => e.type === "done")?.data;
    if (done) out.push({ heading: L(lang, "الكلفة", "Cost"), kind: "kv", rows: [[L(lang, "الخطوات", "Steps"), Number(done.steps || 0)], ["Tokens", Number(done.totalTokens || 0)]] });
  }

  if (sel.includeTechnical) {
    // Opt-in: monospace-friendly key/value rows, never inside narrow table cells.
    for (const s of chosen) {
      const rows: Array<[string, string]> = [];
      if (s.input && typeof s.input === "object") for (const [k, v] of Object.entries(s.input)) rows.push([k, flattenValue(v)]);
      if (rows.length) out.push({ heading: `${L(lang, "تقني", "Technical")} · ${s.index + 1}. ${humanize(s.tool)}`, kind: "kv", rows });
    }
  }
  const g = glossarySection(out, lang);
  if (g) out.push(g);
  return out;
  }
}

export type CouncilCard = { kind: "opinion" | "objection" | "conflict" | "decision" | "reflection"; who: string; text: string; confidence?: number | null };
const txt = (v: any): string => (typeof v === "string" ? v : v == null ? "" : flattenValue(v)).replace(/[{}\[\]"]/g, "").trim();
/** Turns existing council/conflict/decision/reflection events into readable cards. No model calls. */
export function councilCards(events: Array<{ type: string; data: any }>): CouncilCard[] {
  const out: CouncilCard[] = [];
  for (const e of events || []) {
    const d = e?.data || {};
    if (e.type === "council" && !d.error) {
      if (d.opinion) out.push({ kind: "opinion", who: String(d.expert || d.capability || ""), text: txt(d.opinion), confidence: d.confidence ?? null });
      if (d.objection) out.push({ kind: "objection", who: String(d.expert || ""), text: txt(d.objection) });
    } else if (e.type === "conflict") {
      const t = txt(d.resolution || d.summary || d.text || d.decision); if (t) out.push({ kind: "conflict", who: "", text: t });
    } else if (e.type === "decision") {
      const t = txt(d.text || d.decision || d.summary || d.reason); if (t) out.push({ kind: "decision", who: String(d.by || ""), text: t });
    } else if (e.type === "reflection") {
      const t = txt(d.text); if (t) out.push({ kind: "reflection", who: "", text: t });
    }
  }
  return out.map((c) => ({ ...c, text: cleanCouncilText(c.text) })).filter((c) => c.text).slice(-20);
}

/** Removes internal ids, trace counters and code-like flags from council text shown to users. */
export function cleanCouncilText(t: string): string {
  return String(t || "")
    .replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){0,4}(?:-[0-9a-f]{12})?\b/gi, "")
    .replace(/\b[a-z_]+\s*[:=]\s*(true|false|null)\b/gi, "")
    .replace(/\((?:\s*(?:nodes?|scope|trace|run|id)[^)]*)\)/gi, "")
    .replace(/[ \t]{2,}/g, " ").replace(/\s+([،,.])/g, "$1").trim();
}
