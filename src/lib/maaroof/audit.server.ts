// Part 19.7 — Final Architectural Validation. تطوير لا إنشاء.
//
// The platform already has `laws.server.ts` (30-law compliance),
// `system-health.functions.ts` (runtime health) and the Intelligence Center
// (executive dashboard). What was missing is a single architectural auditor
// that answers the founder's question: *what is actually implemented, how
// ready is it, and what is the gap?* — computed from the live engines, not
// from a hand-written checklist.
//
// Fully local arithmetic — zero model calls.

import { createClient } from "@supabase/supabase-js";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db as any;
}

export type EngineSpec = {
  key: string;
  label_ar: string;
  part: string;
  /** Table whose row count proves the engine is not just code but in use. */
  table?: string;
  depends_on: string[];
};

/** The architecture atlas: engines, the part that introduced them, and their edges. */
export const ARCHITECTURE_ATLAS: EngineSpec[] = [
  { key: "capability", label_ar: "نظام القدرات", part: "4", table: "mcp_providers", depends_on: [] },
  { key: "cognition", label_ar: "الذكاء الإدراكي", part: "5", table: "platform_dna", depends_on: ["capability"] },
  { key: "workflow", label_ar: "الرسم التنفيذي", part: "6", table: "maaroof_schedules", depends_on: ["capability"] },
  { key: "timing", label_ar: "محرك التوقيت", part: "7", table: "maaroof_runs", depends_on: [] },
  { key: "laws", label_ar: "الدستور والقوانين", part: "8", table: "decision_traces", depends_on: [] },
  { key: "experts", label_ar: "أكاديمية الخبراء", part: "9-10", table: "expert_profiles", depends_on: ["capability"] },
  { key: "knowledge", label_ar: "الرسم المعرفي", part: "11", table: "knowledge_nodes", depends_on: ["experts"] },
  { key: "models", label_ar: "حوكمة النماذج", part: "12", table: "ai_models", depends_on: [] },
  { key: "decisions", label_ar: "ذكاء القرار", part: "13", table: "decision_traces", depends_on: ["knowledge", "models"] },
  { key: "publishing", label_ar: "النشر متعدد المنصات", part: "14", table: "publications", depends_on: ["decisions"] },
  { key: "trust", label_ar: "معمار الثقة", part: "15", table: "trust_events", depends_on: ["knowledge"] },
  { key: "state", label_ar: "مرساة الحالة", part: "16", table: "state_anchors", depends_on: [] },
  { key: "hermes", label_ar: "هيرمس التنفيذي", part: "17-18", table: "hermes_tasks", depends_on: ["state", "trust"] },
  { key: "reality", label_ar: "تصنيف الواقع", part: "19.1", table: "reality_records", depends_on: ["trust", "knowledge"] },
  { key: "execution", label_ar: "محرك التنفيذ الواقعي", part: "19.2", table: "executions", depends_on: ["capability", "workflow", "models"] },
  { key: "verification", label_ar: "محرك التحقق", part: "19.3", table: "evidence_items", depends_on: ["reality", "trust", "laws"] },
  { key: "evidence", label_ar: "محرك الأدلة", part: "19.4", table: "evidence_items", depends_on: ["reality"] },
  { key: "benchmark", label_ar: "محرك المعايير", part: "19.4", table: "benchmark_results", depends_on: ["execution"] },
  { key: "lab", label_ar: "مختبر الواقع", part: "19.5", table: "lab_experiments", depends_on: ["execution", "verification"] },
  { key: "eos", label_ar: "نظام التشغيل التنفيذي", part: "19.6", table: "hermes_proposals", depends_on: ["hermes", "execution", "verification"] },
];

export type EngineStatus = {
  key: string;
  label_ar: string;
  part: string;
  rows: number;
  state: "active" | "wired" | "idle";
  depends_on: string[];
};

const countRows = async (table?: string): Promise<number> => {
  if (!table) return 0;
  try {
    const { count } = await db().from(table).select("id", { count: "exact", head: true });
    return Number(count || 0);
  } catch {
    return 0;
  }
};

/** Live status per engine: is it merely wired, or actually producing rows? */
export async function auditEngines(): Promise<EngineStatus[]> {
  const out: EngineStatus[] = [];
  for (const e of ARCHITECTURE_ATLAS) {
    const rows = await countRows(e.table);
    out.push({
      key: e.key,
      label_ar: e.label_ar,
      part: e.part,
      rows,
      state: rows > 20 ? "active" : rows > 0 ? "wired" : "idle",
      depends_on: e.depends_on,
    });
  }
  return out;
}

export type ReadinessDimension = { key: string; label_ar: string; score: number; note: string };

/** Readiness index across the constitutional dimensions. */
export async function readinessIndex(engines: EngineStatus[]): Promise<{ score: number; dimensions: ReadinessDimension[] }> {
  const pct = (keys: string[]) => {
    const rel = engines.filter((e) => keys.includes(e.key));
    if (!rel.length) return 0;
    const v = rel.reduce((a, e) => a + (e.state === "active" ? 100 : e.state === "wired" ? 60 : 20), 0);
    return Math.round(v / rel.length);
  };
  const dims: ReadinessDimension[] = [
    { key: "intelligence", label_ar: "الذكاء", score: pct(["cognition", "experts", "knowledge", "models"]), note: "الإدراك والمعرفة والنماذج" },
    { key: "execution", label_ar: "التنفيذ", score: pct(["execution", "workflow", "capability"]), note: "من الهدف إلى المهمة" },
    { key: "verification", label_ar: "التحقق", score: pct(["reality", "verification", "evidence", "benchmark", "lab"]), note: "الأدلة والقياس والتكرار" },
    { key: "governance", label_ar: "الحوكمة", score: pct(["laws", "trust", "decisions"]), note: "القوانين والثقة والقرار" },
    { key: "operations", label_ar: "التشغيل", score: pct(["hermes", "eos", "state", "publishing", "timing"]), note: "الإدارة التنفيذية والنشر" },
  ];
  const score = Math.round(dims.reduce((a, d) => a + d.score, 0) / dims.length);
  return { score, dimensions: dims };
}

export type Gap = { engine: string; label_ar: string; severity: "high" | "medium" | "low"; issue: string; action: string };

/** Gap analysis: idle engines, broken dependencies, unverified output. */
export async function gapAnalysis(engines: EngineStatus[]): Promise<Gap[]> {
  const byKey = new Map(engines.map((e) => [e.key, e]));
  const gaps: Gap[] = [];
  for (const e of engines) {
    if (e.state === "idle") {
      gaps.push({ engine: e.key, label_ar: e.label_ar, severity: "medium", issue: "مفعّل برمجياً بلا بيانات تشغيل", action: "تشغيل حالة واقعية واحدة على الأقل لتوليد أدلة" });
    }
    for (const dep of e.depends_on) {
      const d = byKey.get(dep);
      if (d && d.state === "idle" && e.state !== "idle") {
        gaps.push({ engine: e.key, label_ar: e.label_ar, severity: "high", issue: `يعتمد على «${d.label_ar}» وهو خامل`, action: `تفعيل ${d.label_ar} قبل الاعتماد على مخرجات ${e.label_ar}` });
      }
    }
  }
  try {
    const { data } = await db().from("reality_records").select("reality_state").limit(300);
    const rows = (data as any[]) || [];
    if (rows.length) {
      const weak = rows.filter((r) => !["verified", "measured", "observed"].includes(r.reality_state)).length;
      const ratio = Math.round((weak / rows.length) * 100);
      if (ratio > 40) {
        gaps.push({ engine: "verification", label_ar: "محرك التحقق", severity: "high", issue: `${ratio}% من المخرجات أضعف من «ملاحَظ»`, action: "سدّ فجوة التحقق: ربط معايير قياس وأدلة تنفيذ" });
      }
    }
  } catch {}
  return gaps.slice(0, 30);
}

/** Sequenced roadmap derived from the gaps, not hand-written. */
export function roadmapFromGaps(gaps: Gap[]): Array<{ phase: string; items: string[] }> {
  const high = gaps.filter((g) => g.severity === "high").map((g) => g.action);
  const med = gaps.filter((g) => g.severity === "medium").map((g) => g.action);
  const low = gaps.filter((g) => g.severity === "low").map((g) => g.action);
  const uniq = (a: string[]) => Array.from(new Set(a)).slice(0, 8);
  return [
    { phase: "فوري", items: uniq(high) },
    { phase: "قريب", items: uniq(med) },
    { phase: "لاحق", items: uniq(low) },
  ].filter((p) => p.items.length);
}

/** Full architectural audit for the Reality Center / partner reports. */
export async function architecturalAudit() {
  const engines = await auditEngines();
  const readiness = await readinessIndex(engines);
  const gaps = await gapAnalysis(engines);
  const roadmap = roadmapFromGaps(gaps);
  const active = engines.filter((e) => e.state === "active").length;
  const wired = engines.filter((e) => e.state === "wired").length;
  const coverage = Math.round(((active + wired * 0.6) / (engines.length || 1)) * 100);
  const summary =
    `المنظومة تضم ${engines.length} محركاً: ${active} نشط، ${wired} موصول، ${engines.length - active - wired} خامل. ` +
    `تغطية التنفيذ ${coverage}% ومؤشر الجاهزية ${readiness.score}%.` +
    (gaps.length ? ` أهم فجوة: ${gaps[0].issue}.` : " لا فجوات حرجة.");
  return { engines, readiness, gaps, roadmap, coverage, summary, generated_at: new Date().toISOString() };
}

/** Markdown export of the audit, reusing HERMES' existing document pipeline. */
export function auditToMarkdown(audit: Awaited<ReturnType<typeof architecturalAudit>>): string {
  const lines: string[] = [
    "# تقرير التدقيق المعماري — الجزء 19.7",
    "",
    audit.summary,
    "",
    "## مؤشر الجاهزية",
    ...audit.readiness.dimensions.map((d) => `- **${d.label_ar}**: ${d.score}% — ${d.note}`),
    "",
    "## المحركات",
    "| المحرك | الجزء | الحالة | السجلات |",
    "|---|---|---|---|",
    ...audit.engines.map((e) => `| ${e.label_ar} | ${e.part} | ${e.state} | ${e.rows} |`),
  ];
  if (audit.gaps.length) {
    lines.push("", "## الفجوات", ...audit.gaps.map((g) => `- (${g.severity}) **${g.label_ar}**: ${g.issue} → ${g.action}`));
  }
  if (audit.roadmap.length) {
    lines.push("", "## خارطة الطريق");
    for (const p of audit.roadmap) lines.push(`### ${p.phase}`, ...p.items.map((i) => `- ${i}`));
  }
  return lines.join("\n");
}
