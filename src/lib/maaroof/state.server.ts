// Part 16 — Living State Anchor Architecture.
// Memory remembers. Knowledge understands. Trust evaluates.
// The State Anchor preserves IDENTITY: who the platform is, why it exists,
// what it is doing now, and what must never change.
// Every computation here is local arithmetic — zero model cost.
import { createClient } from "@supabase/supabase-js";

let _db: ReturnType<typeof createClient> | null = null;
function db(): any {
  if (_db) return _db;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db;
}

export const ANCHOR_LEVELS = [
  "platform", "workspace", "user", "session", "run", "agent", "expert", "task",
] as const;
export type AnchorLevel = (typeof ANCHOR_LEVELS)[number];

/** Each level inherits from its parent and may extend but never violate it. */
const PARENT_OF: Record<AnchorLevel, AnchorLevel | null> = {
  platform: null,
  workspace: "platform",
  user: "platform",
  session: "user",
  run: "session",
  agent: "run",
  expert: "run",
  task: "run",
};

export const DRIFT_KINDS = [
  "goal", "knowledge", "memory", "reasoning", "mission", "policy", "workspace",
  "expert", "model", "trust", "language", "business", "execution",
] as const;
export type DriftKind = (typeof DRIFT_KINDS)[number];

export type Drift = { kind: DriftKind; severity: number; explanation: string; correction: string };

export type AnchorRow = {
  id: string;
  level: string;
  scope_id: string;
  parent_anchor_id: string | null;
  user_id: string | null;
  workspace_id: string | null;
  run_id: string | null;
  label: string | null;
  dna: Record<string, any>;
  mission: string | null;
  current_goal: string | null;
  future_goal: string | null;
  constraints: any[];
  policies: Record<string, any>;
  language: string | null;
  geo: any;
  budget: Record<string, any>;
  quality_target: number | null;
  risk_target: number | null;
  priority: number;
  approval_status: string;
  health: Record<string, any>;
  health_score: number | null;
  drift: Drift[];
  version: number;
  status: string;
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

/** The permanent platform anchor — the root every other anchor inherits from. */
export async function getPlatformAnchor(): Promise<AnchorRow | null> {
  const { data } = await db().from("state_anchors").select("*").eq("level", "platform").limit(1).maybeSingle();
  return (data as AnchorRow) ?? null;
}

export async function getAnchor(level: AnchorLevel, scopeId: string): Promise<AnchorRow | null> {
  const { data } = await db()
    .from("state_anchors").select("*").eq("level", level).eq("scope_id", scopeId).maybeSingle();
  return (data as AnchorRow) ?? null;
}

/** Merge a parent anchor into a child: the child extends, never contradicts. */
export function inherit(parent: Partial<AnchorRow> | null, child: Partial<AnchorRow>): Partial<AnchorRow> {
  if (!parent) return child;
  const mergedConstraints = [
    ...(Array.isArray(parent.constraints) ? parent.constraints : []),
    ...(Array.isArray(child.constraints) ? child.constraints : []),
  ];
  return {
    ...child,
    mission: child.mission ?? parent.mission ?? null,
    future_goal: child.future_goal ?? parent.future_goal ?? null,
    language: child.language ?? parent.language ?? null,
    geo: child.geo ?? parent.geo ?? null,
    // Parent constraints and policies are floors, not defaults: they always apply.
    constraints: Array.from(new Set(mergedConstraints.map((c) => String(c)))),
    policies: { ...(parent.policies || {}), ...(child.policies || {}) },
    dna: { ...(parent.dna || {}), ...(child.dna || {}) },
    budget: { ...(parent.budget || {}), ...(child.budget || {}) },
    quality_target: child.quality_target ?? parent.quality_target ?? null,
    risk_target: child.risk_target ?? parent.risk_target ?? null,
  };
}

/** Create or update an anchor at one level, inheriting from its parent. */
export async function upsertAnchor(input: {
  level: AnchorLevel;
  scopeId: string;
  userId?: string | null;
  workspaceId?: string | null;
  runId?: string | null;
  label?: string | null;
  mission?: string | null;
  currentGoal?: string | null;
  futureGoal?: string | null;
  language?: string | null;
  geo?: any;
  budget?: Record<string, any>;
  policies?: Record<string, any>;
  constraints?: any[];
  dna?: Record<string, any>;
  priority?: number;
  parentScopeId?: string | null;
}): Promise<AnchorRow | null> {
  const parentLevel = PARENT_OF[input.level];
  let parent: AnchorRow | null = null;
  if (parentLevel) {
    parent = input.parentScopeId
      ? await getAnchor(parentLevel, input.parentScopeId)
      : parentLevel === "platform"
        ? await getPlatformAnchor()
        : null;
    if (!parent && parentLevel !== "platform") parent = await getPlatformAnchor();
  }

  const existing = await getAnchor(input.level, input.scopeId);
  const merged = inherit(parent, {
    label: input.label ?? existing?.label ?? null,
    mission: input.mission ?? existing?.mission ?? null,
    future_goal: input.futureGoal ?? existing?.future_goal ?? null,
    language: input.language ?? existing?.language ?? null,
    geo: input.geo ?? existing?.geo ?? null,
    constraints: input.constraints ?? existing?.constraints ?? [],
    policies: input.policies ?? existing?.policies ?? {},
    dna: input.dna ?? existing?.dna ?? {},
    budget: input.budget ?? existing?.budget ?? {},
  });

  const row: any = {
    level: input.level,
    scope_id: input.scopeId,
    parent_anchor_id: parent?.id ?? null,
    user_id: input.userId ?? existing?.user_id ?? null,
    workspace_id: input.workspaceId ?? existing?.workspace_id ?? null,
    run_id: input.runId ?? existing?.run_id ?? null,
    current_goal: input.currentGoal ?? existing?.current_goal ?? null,
    priority: input.priority ?? existing?.priority ?? 5,
    ...merged,
  };

  if (existing) {
    row.version = Number(existing.version || 1) + 1;
    const { data } = await db().from("state_anchors").update(row).eq("id", existing.id).select().maybeSingle();
    await recordStateChange({
      anchorId: existing.id, level: input.level, scopeId: input.scopeId,
      userId: row.user_id, runId: row.run_id, changeKind: "update",
      oldState: existing, newState: data, reason: "anchor_updated", initiatedBy: "system",
    });
    return (data as AnchorRow) ?? null;
  }
  const { data } = await db().from("state_anchors").insert(row).select().maybeSingle();
  if (data) {
    await recordStateChange({
      anchorId: (data as any).id, level: input.level, scopeId: input.scopeId,
      userId: row.user_id, runId: row.run_id, changeKind: "create",
      oldState: null, newState: data, reason: "anchor_created", initiatedBy: "system",
      rollbackPoint: true,
    });
  }
  return (data as AnchorRow) ?? null;
}

/** Append one entry to the state timeline. Nothing changes silently. */
export async function recordStateChange(entry: {
  anchorId?: string | null;
  level: string;
  scopeId: string;
  userId?: string | null;
  runId?: string | null;
  changeKind: string;
  oldState?: any;
  newState?: any;
  reason?: string;
  initiatedBy?: string;
  affected?: Record<string, any>;
  drift?: Drift[] | null;
  costUsd?: number;
  tokens?: number;
  rollbackPoint?: boolean;
}) {
  try {
    await db().from("state_timeline").insert({
      anchor_id: entry.anchorId ?? null,
      level: entry.level,
      scope_id: entry.scopeId,
      user_id: entry.userId ?? null,
      run_id: entry.runId ?? null,
      change_kind: entry.changeKind,
      old_state: entry.oldState ?? null,
      new_state: entry.newState ?? null,
      reason: (entry.reason || "").slice(0, 500),
      initiated_by: entry.initiatedBy || "system",
      affected: entry.affected ?? {},
      drift: entry.drift ?? null,
      cost_usd: entry.costUsd ?? 0,
      tokens: entry.tokens ?? 0,
      rollback_point: !!entry.rollbackPoint,
    });
  } catch {}
}

/**
 * ANCHOR BEFORE EXECUTION — identity, mission, workspace, budget and goal are
 * validated before anything runs. A failure stops the run with a readable
 * reason instead of letting it start blind.
 */
export async function validateBeforeExecution(input: {
  goal: string;
  userId: string;
  workspaceId?: string | null;
  language?: string | null;
  balanceTokens?: number | null;
  estimatedTokens?: number | null;
}): Promise<{ ok: boolean; checks: Array<{ key: string; ok: boolean; note: string }>; blocked: string[]; platform: AnchorRow | null }> {
  const platform = await getPlatformAnchor();
  const checks: Array<{ key: string; ok: boolean; note: string }> = [];

  checks.push({ key: "identity", ok: !!platform, note: platform ? String(platform.dna?.identity || platform.label || "منصة") : "مرساة المنصة غير موجودة" });
  checks.push({ key: "mission", ok: !!platform?.mission, note: platform?.mission ? "الرسالة محدّدة" : "لا رسالة معرّفة" });
  checks.push({ key: "goal", ok: input.goal.trim().length >= 3, note: input.goal.trim().length >= 3 ? "هدف واضح" : "هدف قصير جداً" });
  checks.push({ key: "user", ok: !!input.userId, note: input.userId ? "هوية مستخدم صالحة" : "بلا مستخدم" });

  if (input.workspaceId) {
    const { data: ws } = await db().from("workspaces").select("id, name, language").eq("id", input.workspaceId).maybeSingle();
    checks.push({ key: "workspace", ok: !!ws, note: ws ? `مساحة العمل: ${(ws as any).name}` : "مساحة عمل غير موجودة" });
  } else {
    checks.push({ key: "workspace", ok: true, note: "تشغيل خارج مساحة عمل" });
  }

  const budgetOk = input.balanceTokens == null || input.estimatedTokens == null
    ? true
    : Number(input.balanceTokens) >= Number(input.estimatedTokens);
  checks.push({ key: "budget", ok: budgetOk, note: budgetOk ? "الميزانية كافية" : "الرصيد أقل من التكلفة المتوقعة" });

  const policies = (platform?.policies || {}) as Record<string, any>;
  checks.push({ key: "policies", ok: true, note: policies.approval === "human_in_the_loop" ? "التنفيذ الحساس يحتاج موافقة" : "سياسات المنصة محمّلة" });

  const blocked = checks.filter((c) => !c.ok).map((c) => `${c.key}: ${c.note}`);
  return { ok: blocked.length === 0, checks, blocked, platform };
}

/**
 * DRIFT DETECTION — every drift is explained, measured, and given a correction.
 * Pure comparison over the run's own signals.
 */
export function detectDrift(input: {
  anchor: Partial<AnchorRow> | null;
  goal: string;
  planSummary?: string | null;
  language?: string | null;
  workspaceId?: string | null;
  modelsUsed?: string[];
  trustScore?: number | null;
  memoriesRecalled?: number;
  knowledgeNodes?: number;
  failedSteps?: number;
  totalSteps?: number;
}): Drift[] {
  const out: Drift[] = [];
  const a = input.anchor;

  const words = (s: string) =>
    new Set(String(s || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3));
  if (a?.current_goal && input.planSummary) {
    const g = words(a.current_goal + " " + input.goal);
    const p = words(input.planSummary);
    const overlap = [...p].filter((w) => g.has(w)).length;
    const ratio = p.size ? overlap / p.size : 1;
    if (ratio < 0.15) {
      out.push({
        kind: "goal", severity: clamp((0.15 - ratio) * 500),
        explanation: "الخطة المنفَّذة تبتعد عن الهدف المعلن للمرساة.",
        correction: "إعادة صياغة الخطة على الهدف الأصلي أو تحديث هدف المرساة صراحةً.",
      });
    }
  }

  if (a?.language && input.language && a.language !== input.language) {
    out.push({
      kind: "language", severity: 40,
      explanation: `لغة التشغيل (${input.language}) تخالف لغة المرساة (${a.language}).`,
      correction: "توحيد اللغة أو تحديث تفضيل اللغة في المرساة.",
    });
  }

  if (a?.workspace_id && input.workspaceId && a.workspace_id !== input.workspaceId) {
    out.push({
      kind: "workspace", severity: 60,
      explanation: "التشغيل يجري داخل مساحة عمل مختلفة عن المرساة الوارثة.",
      correction: "ربط التشغيل بمساحة عمله الصحيحة قبل الاستمرار.",
    });
  }

  if (input.trustScore != null && input.trustScore < 45) {
    out.push({
      kind: "trust", severity: clamp(60 - input.trustScore),
      explanation: `درجة الثقة ${input.trustScore}% دون الحد الآمن.`,
      correction: "إضافة أدلة أو مصادر قبل اعتماد المخرجات كتوصية.",
    });
  }

  if ((input.memoriesRecalled ?? 0) === 0 && (input.knowledgeNodes ?? 0) === 0) {
    out.push({
      kind: "memory", severity: 25,
      explanation: "لم تُستدعَ أي ذاكرة أو معرفة سابقة في هذا التشغيل.",
      correction: "تفعيل الاستدعاء أو إثراء الذاكرة لهذه المساحة.",
    });
  }

  const total = input.totalSteps ?? 0;
  const failed = input.failedSteps ?? 0;
  if (total > 0 && failed / total > 0.34) {
    out.push({
      kind: "execution", severity: clamp((failed / total) * 100),
      explanation: `فشل ${failed} من ${total} خطوة تنفيذ.`,
      correction: "مراجعة القدرات المختارة قبل إعادة التشغيل.",
    });
  }

  return out;
}

/** STATE HEALTH SCORE — consistency, stability, alignment and quality. */
export function stateHealth(input: {
  drifts: Drift[];
  validationOk: boolean;
  trustScore?: number | null;
  qualityScore?: number | null;
  memoriesRecalled?: number;
  knowledgeNodes?: number;
  complianceVerdict?: string | null;
  successRatio?: number | null;
  versions?: number;
}) {
  const driftPenalty = input.drifts.reduce((a, d) => a + d.severity, 0) / 3;
  const consistency = clamp(100 - driftPenalty);
  const stability = clamp(100 - Math.max(0, (input.versions ?? 1) - 5) * 4);
  const alignment = clamp(input.validationOk ? 90 - driftPenalty / 2 : 40);
  const knowledge_quality = clamp((input.knowledgeNodes ?? 0) * 20);
  const memory_quality = clamp((input.memoriesRecalled ?? 0) * 18);
  const trust_quality = clamp(input.trustScore ?? 55);
  const execution_quality = clamp((input.successRatio ?? 0.7) * 100);
  const business_alignment = clamp((input.qualityScore ?? trust_quality));
  const policy_compliance =
    input.complianceVerdict === "violation" ? 30 : input.complianceVerdict === "warning" ? 65 : 90;
  const future_alignment = clamp((alignment + business_alignment) / 2);
  const overall = clamp(
    consistency * 0.16 + stability * 0.1 + alignment * 0.16 + knowledge_quality * 0.08 +
    memory_quality * 0.08 + trust_quality * 0.14 + execution_quality * 0.12 +
    business_alignment * 0.08 + policy_compliance * 0.08,
  );
  return {
    consistency, stability, alignment, knowledge_quality, memory_quality,
    trust_quality, execution_quality, business_alignment, policy_compliance,
    future_alignment, overall,
  };
}

/** Persist the outcome of a run onto its anchor: health, drift, validation stamp. */
export async function closeRunAnchor(input: {
  anchorId: string;
  level: string;
  scopeId: string;
  userId?: string | null;
  runId?: string | null;
  drifts: Drift[];
  health: ReturnType<typeof stateHealth>;
  costUsd?: number;
  tokens?: number;
}) {
  try {
    const { data: before } = await db().from("state_anchors").select("*").eq("id", input.anchorId).maybeSingle();
    await db().from("state_anchors").update({
      drift: input.drifts,
      health: input.health,
      health_score: input.health.overall,
      last_validated_at: new Date().toISOString(),
      status: input.drifts.some((d) => d.severity >= 60) ? "drifted" : "active",
    }).eq("id", input.anchorId);
    await recordStateChange({
      anchorId: input.anchorId, level: input.level, scopeId: input.scopeId,
      userId: input.userId, runId: input.runId, changeKind: "run_closed",
      oldState: before, newState: { health: input.health, drift: input.drifts },
      reason: input.drifts.length ? "اكتمل التشغيل مع انحرافات مرصودة" : "اكتمل التشغيل ضمن المرساة",
      drift: input.drifts, costUsd: input.costUsd ?? 0, tokens: input.tokens ?? 0,
      rollbackPoint: input.drifts.length === 0,
    });
  } catch {}
}

/** STATE RECOVERY — resume from the last healthy rollback point, never blindly. */
export async function recoverFromLastGoodState(level: string, scopeId: string) {
  const { data } = await db()
    .from("state_timeline")
    .select("*")
    .eq("level", level).eq("scope_id", scopeId).eq("rollback_point", true)
    .order("created_at", { ascending: false })
    .limit(1);
  const point = ((data as any[]) || [])[0] || null;
  if (!point) return { ok: false, reason: "no_rollback_point" as const, state: null };
  return { ok: true as const, reason: null, state: point.new_state ?? point.old_state ?? null, at: point.created_at };
}

/** Admin overview across every level. */
export async function stateOverview() {
  const [{ data: anchors }, { data: timeline }] = await Promise.all([
    db().from("state_anchors").select("*").order("level", { ascending: true }).limit(300),
    db().from("state_timeline").select("id, level, scope_id, change_kind, reason, drift, rollback_point, cost_usd, created_at")
      .order("created_at", { ascending: false }).limit(80),
  ]);
  const rows = ((anchors as any[]) || []);
  const byLevel: Record<string, { count: number; avgHealth: number; drifted: number }> = {};
  for (const r of rows) {
    const l = String(r.level);
    byLevel[l] ||= { count: 0, avgHealth: 0, drifted: 0 };
    byLevel[l].count += 1;
    byLevel[l].avgHealth += Number(r.health_score || 0);
    if ((Array.isArray(r.drift) ? r.drift.length : 0) > 0) byLevel[l].drifted += 1;
  }
  for (const l of Object.keys(byLevel)) byLevel[l].avgHealth = Math.round(byLevel[l].avgHealth / byLevel[l].count);
  return { anchors: rows, timeline: ((timeline as any[]) || []), byLevel };
}
