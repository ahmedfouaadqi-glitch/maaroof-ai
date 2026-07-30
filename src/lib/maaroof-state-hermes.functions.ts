// Parts 16-17 admin surface — State Anchor Center + HERMES Executive Office.
// Thin wrapper module: no runtime helpers at module scope (server-fn splitting).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Part 16 — anchors, timeline and per-level health for the admin. */
export const getStateCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { stateOverview } = await import("@/lib/maaroof/state.server");
    const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
    const [overview, settings] = await Promise.all([stateOverview(), getMaaroofSettings()]);
    return { ...overview, settings: (settings as any).state_anchor };
  });

/** Part 16 — the last healthy rollback point for a scope. */
export const getRecoveryPoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ level: z.string().min(1).max(30), scope_id: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { recoverFromLastGoodState } = await import("@/lib/maaroof/state.server");
    return await recoverFromLastGoodState(data.level, data.scope_id);
  });

/** Part 17 — observatory, proposals and Founder DNA in one read. */
export const getHermesCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { observePlatform, listProposals, getFounderDna, listConversations } =
      await import("@/lib/maaroof/hermes.server");
    const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
    const [observatory, proposals, dna, conversations, settings] = await Promise.all([
      observePlatform(), listProposals(), getFounderDna(),
      listConversations(context.userId), getMaaroofSettings(),
    ]);
    return { observatory, proposals, dna, conversations, settings: (settings as any).hermes };
  });

/** Part 17 — derive fresh proposals from measured signals (no model call). */
export const refreshHermesProposals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { syncProposals } = await import("@/lib/maaroof/hermes.server");
    return await syncProposals();
  });

/** Part 17/18 — the Founder decides. HERMES never executes on its own.
 *  Part 18 widens the vocabulary with modify / postpone / archive. */
export const decideHermesProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      proposal_id: z.string().uuid(),
      decision: z.enum(["approved", "rejected", "deferred", "modified", "postponed", "archived"]),
      note: z.string().max(2000).optional().nullable(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { decideProposal } = await import("@/lib/maaroof/hermes.server");
    return await decideProposal({
      proposalId: data.proposal_id,
      decision: data.decision,
      note: data.note ?? null,
      founderId: context.userId,
    });
  });

/** Part 17/18 — the Founder's private office. Cost is charged to the system budget.
 *  Part 18 adds executive commands, language selection and file/image input. */
export const askHermes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      message: z.string().min(2).max(4000),
      conversation_id: z.string().uuid().optional().nullable(),
      command: z.string().max(40).optional().nullable(),
      language: z.enum(["ar", "en", "ku"]).optional(),
      attachments: z.array(z.object({
        kind: z.enum(["image", "file"]),
        name: z.string().max(200).optional(),
        dataUrl: z.string().max(8_000_000),
      })).max(4).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
    const settings: any = await getMaaroofSettings();
    if (settings?.hermes?.enabled === false || settings?.hermes?.office_enabled === false) {
      return { conversationId: data.conversation_id ?? null, reply: "مكتب هرمس معطّل من إعدادات الإدارة.", tokens: 0, usd: 0, disabled: true };
    }
    const { hermesReply } = await import("@/lib/maaroof/hermes.server");
    const r = await hermesReply({
      userId: context.userId,
      conversationId: data.conversation_id ?? null,
      message: data.message,
      command: data.command ?? null,
      language: data.language ?? "ar",
      attachments: data.attachments,
    });
    return { conversationId: r.conversationId, reply: r.reply, tokens: r.tokens, usd: r.usd, disabled: false };
  });


/** Part 17 — read one office conversation. */
export const getHermesMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { listMessages } = await import("@/lib/maaroof/hermes.server");
    return await listMessages(data.conversation_id, context.userId);
  });

/* ------------------------------------------------------------------ */
/* Part 18 — Executive Command Center: tasks, history, live monitor.   */
/* ------------------------------------------------------------------ */

const taskShape = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(8000).optional().nullable(),
  category: z.string().max(40).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  workspace_id: z.string().uuid().optional().nullable(),
  expert_assignment: z.array(z.string().max(60)).max(20).optional(),
  sub_agent_assignment: z.array(z.string().max(60)).max(20).optional(),
  required_models: z.array(z.string().max(80)).max(20).optional(),
  required_mcp: z.array(z.string().max(80)).max(20).optional(),
  required_tools: z.array(z.string().max(80)).max(30).optional(),
  business_goal: z.string().max(2000).optional().nullable(),
  expected_output: z.string().max(2000).optional().nullable(),
  approval_level: z.string().max(30).optional(),
  dependencies: z.array(z.string().uuid()).max(30).optional(),
  risk_level: z.enum(["low", "medium", "high", "critical"]).optional(),
  cost_budget_usd: z.number().nonnegative().optional().nullable(),
  token_budget: z.number().int().nonnegative().optional().nullable(),
  execution_budget_ms: z.number().int().nonnegative().optional().nullable(),
  languages: z.array(z.enum(["ar", "en", "ku"])).max(3).optional(),
  knowledge_sources: z.array(z.any()).max(50).optional(),
  deadline: z.string().optional().nullable(),
  start_at: z.string().optional().nullable(),
  finish_at: z.string().optional().nullable(),
  timezone: z.string().max(60).optional(),
  recurring_schedule: z.string().max(120).optional().nullable(),
  status: z.string().max(30).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  execution_mode: z.enum(["manual", "semi_auto", "auto"]).optional(),
});

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId, _role: "admin",
  });
  if (!isAdmin) throw new Error("forbidden");
}

/** Tasks + live monitor in one read for the command center. */
export const getHermesTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.string().max(30).optional().nullable() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { listTasks, executiveMonitor } = await import("@/lib/maaroof/hermes.server");
    const [tasks, monitor] = await Promise.all([
      listTasks({ status: data.status || undefined }),
      executiveMonitor(),
    ]);
    return { tasks, monitor };
  });

export const getHermesTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ task_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { getTask } = await import("@/lib/maaroof/hermes.server");
    return await getTask(data.task_id);
  });

export const createHermesTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => taskShape.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { createTask } = await import("@/lib/maaroof/hermes.server");
    return await createTask(data as any, context.userId);
  });

export const updateHermesTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ task_id: z.string().uuid(), patch: taskShape.partial() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { updateTask } = await import("@/lib/maaroof/hermes.server");
    return await updateTask(data.task_id, data.patch as any, context.userId);
  });

/** Free-form history entry (discussion, lesson learned, rollback note…). */
export const logHermesTaskEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      task_id: z.string().uuid(),
      kind: z.string().min(2).max(40),
      summary: z.string().max(500).optional(),
      payload: z.record(z.string(), z.any()).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { logTaskEvent } = await import("@/lib/maaroof/hermes.server");
    await logTaskEvent({ taskId: data.task_id, actorId: context.userId, kind: data.kind, summary: data.summary, payload: data.payload });
    return { ok: true };
  });

/** Executive result — measured only, generated with zero model cost. */
export const buildHermesTaskReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ task_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { buildTaskReport } = await import("@/lib/maaroof/hermes.server");
    return await buildTaskReport(data.task_id, context.userId);
  });
