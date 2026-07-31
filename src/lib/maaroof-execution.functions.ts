// Part 19.2–19.7 — admin surface for Execution, Verification, Evidence,
// Benchmarks, the Reality Lab and the architectural audit.
// Thin wrapper module: no runtime helpers at module scope (server-fn splitting).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Everything the Reality Lab tabs need, in one round trip. */
export const getRealityLab = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("forbidden");
    const [{ executionOverview }, { evidenceOverview }, { benchmarkOverview }, { labOverview }, { getMaaroofSettings }] =
      await Promise.all([
        import("@/lib/maaroof/execution.server"),
        import("@/lib/maaroof/evidence.server"),
        import("@/lib/maaroof/benchmark.server"),
        import("@/lib/maaroof/lab.server"),
        import("@/lib/maaroof/settings.server"),
      ]);
    const [executions, evidence, benchmarks, lab, settings] = await Promise.all([
      executionOverview(100),
      evidenceOverview(400),
      benchmarkOverview(50),
      labOverview(60),
      getMaaroofSettings(),
    ]);
    return {
      executions,
      evidence,
      benchmarks,
      lab,
      settings: {
        execution_engine: (settings as any).execution_engine,
        verification_engine: (settings as any).verification_engine,
        reality_lab: (settings as any).reality_lab,
      },
    };
  });

/** Architecture atlas + readiness index + gap analysis + roadmap. */
export const getArchitecturalAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("forbidden");
    const { architecturalAudit } = await import("@/lib/maaroof/audit.server");
    return await architecturalAudit();
  });

/** Markdown export of the architectural audit for partner reports. */
export const exportArchitecturalAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("forbidden");
    const { architecturalAudit, auditToMarkdown } = await import("@/lib/maaroof/audit.server");
    const audit = await architecturalAudit();
    return { markdown: auditToMarkdown(audit), generated_at: audit.generated_at };
  });

/** Detail for one execution: tasks + monitoring timeline. */
export const getExecutionDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { executionId: string }) => z.object({ executionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("forbidden");
    const { executionDetail } = await import("@/lib/maaroof/execution.server");
    return await executionDetail(data.executionId);
  });

/** Plan a goal into an execution (draft, never auto-runs). */
export const planExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { goal: string; mode?: string; strategy?: string }) =>
    z
      .object({
        goal: z.string().min(4).max(2000),
        mode: z.enum(["simulation", "recommendation", "execution"]).optional(),
        strategy: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("forbidden");
    const { createExecution } = await import("@/lib/maaroof/execution.server");
    const created = await createExecution({
      goal: data.goal,
      mode: (data.mode as any) || "simulation",
      strategy: data.strategy ?? null,
      userId: context.userId,
    });
    if (!created) throw new Error("could_not_plan");
    return created;
  });

/** Founder decision on an execution (approve / reject / pause / resume / archive). */
export const decideExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { executionId: string; decision: string; note?: string }) =>
    z
      .object({
        executionId: z.string().uuid(),
        decision: z.enum(["approve", "reject", "pause", "resume", "archive"]),
        note: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("forbidden");
    const { eosDecideExecution } = await import("@/lib/maaroof/hermes.server");
    const ok = await eosDecideExecution({
      executionId: data.executionId,
      founderId: context.userId,
      decision: data.decision as any,
      note: data.note ?? null,
    });
    return { ok };
  });

/** Run an execution. Without a real dispatcher it stays a simulation — by design. */
export const runExecutionNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { executionId: string }) => z.object({ executionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("forbidden");
    const { runExecution } = await import("@/lib/maaroof/execution.server");
    return await runExecution({ executionId: data.executionId, userId: context.userId });
  });

/** Verify one reality record or execution through the full RVE sequence. */
export const verifySubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subject: string; realityRecordId?: string; executionId?: string }) =>
    z
      .object({
        subject: z.string().min(1).max(200),
        realityRecordId: z.string().uuid().optional(),
        executionId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("forbidden");
    const { verifyReality } = await import("@/lib/maaroof/verification.server");
    return await verifyReality({
      subject: data.subject,
      realityRecordId: data.realityRecordId ?? null,
      executionId: data.executionId ?? null,
    });
  });

/** Create a lab experiment (hypothesis + variables + sample target). */
export const createLabExperiment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; hypothesis?: string; objective?: string; sampleTarget?: number }) =>
    z
      .object({
        title: z.string().min(3).max(200),
        hypothesis: z.string().max(2000).optional(),
        objective: z.string().max(2000).optional(),
        sampleTarget: z.number().int().min(1).max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("forbidden");
    const { createExperiment } = await import("@/lib/maaroof/lab.server");
    const id = await createExperiment({
      title: data.title,
      hypothesis: data.hypothesis ?? null,
      objective: data.objective ?? null,
      sampleTarget: data.sampleTarget,
      userId: context.userId,
    });
    if (!id) throw new Error("could_not_create_experiment");
    return { id };
  });

/** One experiment with all its iterations. */
export const getExperimentDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { experimentId: string }) => z.object({ experimentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("forbidden");
    const { experimentDetail } = await import("@/lib/maaroof/lab.server");
    return await experimentDetail(data.experimentId);
  });

/** HERMES executive brief: monitor + execution watch + architectural audit. */
export const getEosBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("forbidden");
    const { eosExecutiveBrief } = await import("@/lib/maaroof/hermes.server");
    return await eosExecutiveBrief();
  });
