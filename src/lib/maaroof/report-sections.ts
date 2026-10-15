// Architecture & Concept: Ahmed Maaroof
// Pure helpers: turn agent session events into readable report sections.
// Never emits raw JSON in the readable part; technical data is an opt-in section.
import { sectionsFromResult } from "@/lib/export-bus";
import type { ExportSection } from "@/lib/exports";

export type SessionEvent = { type: string; data: any; t?: number };
export type ReportSelection = {
  /** step indexes to include; undefined = all */
  steps?: number[];
  includeTechnical?: boolean;
  includeProcess?: boolean; // experts, reflections, questions
};

const TECH_KEYS = new Set(["mci", "usage", "raw", "debug", "trace", "ok", "tokens", "cost_usd", "model_raw", "_meta", "model", "provider", "endpoint", "proxy", "via"]);

const humanize = (k: string) => k.replace(/[_.-]+/g, " ").replace(/\s+/g, " ").trim();

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
  if (typeof c.text === "string") c.text = flattenValue(c.text);
  if (Array.isArray(c.list)) c.list = c.list.map((x: any) => flattenValue(x));
  if (Array.isArray(c.rows)) c.rows = c.rows.map(([k, v]: any) => [k, typeof v === "number" ? v : flattenValue(v)]);
  if (c.table) c.table = { ...c.table, data: c.table.data.map((r: any[]) => r.map((x) => (typeof x === "number" ? x : flattenValue(x)))) };
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
  return out;
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
  return out.filter((c) => c.text).slice(-20);
}
