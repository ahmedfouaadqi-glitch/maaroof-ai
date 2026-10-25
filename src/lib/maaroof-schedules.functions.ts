// Maaroof schedules — CRUD for auto-run scheduled prompts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { EXECUTABLE_TOOL_KEYS } from "@/lib/maaroof/tool-contracts";
import { nextCronRunDate, validateSchedulePolicy } from "@/lib/maaroof/schedule-policy";

const Cadence = z.enum(["once", "hourly", "daily", "weekly", "custom_cron"]);
const ApprovalMode = z.enum(["per_run", "auto_within_quota", "first_time_then_auto"]);
const Language = z.enum(["ar", "en", "ku"]);

/** Compute next_run_at using the existing schedule table; custom cron is evaluated in UTC. */
function computeNextRunAt(cadence: string, from: Date = new Date(), cronExpression?: string | null): Date {
  const t = new Date(from);
  switch (cadence) {
    case "hourly": t.setUTCHours(t.getUTCHours() + 1); return t;
    case "daily": t.setUTCDate(t.getUTCDate() + 1); return t;
    case "weekly": t.setUTCDate(t.getUTCDate() + 7); return t;
    case "once": return t;
    case "custom_cron": {
      const next = nextCronRunDate(String(cronExpression || ""), from);
      if (!next) throw new Error("invalid_custom_cron");
      return next;
    }
    default: throw new Error("unsupported_schedule_cadence");
  }
}

export const listSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("maaroof_schedules")
      .select("id, workspace_id, name, prompt, language, force_tools, cadence, cron_expr, starts_at, ends_at, max_runs, runs_done, next_run_at, last_run_at, approval_mode, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const createSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspace_id: z.string().uuid().nullable().optional(),
        name: z.string().trim().min(1).max(100),
        prompt: z.string().trim().min(3).max(4000),
        language: Language.default("ar"),
        force_tools: z.array(z.string().refine((tool) => EXECUTABLE_TOOL_KEYS.includes(tool), "tool_not_executable")).max(16).default([]),
        cadence: Cadence.default("daily"),
        cron_expr: z.string().max(80).optional().nullable(),
        starts_at: z.string().datetime().optional(),
        ends_at: z.string().datetime().nullable().optional(),
        max_runs: z.number().int().min(0).max(10000).default(0),
        approval_mode: ApprovalMode.default("per_run"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let workspaceOwned = !data.workspace_id;
    if (data.workspace_id) {
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("id", data.workspace_id)
        .eq("owner_id", userId)
        .maybeSingle();
      if (workspaceError) throw new Error("workspace_validation_failed");
      workspaceOwned = !!workspace;
    }
    const policy = validateSchedulePolicy({
      cadence: data.cadence,
      cronExpression: data.cron_expr,
      approvalMode: data.approval_mode,
      maxRuns: data.max_runs,
      forceTools: data.force_tools,
      allowedTools: [...EXECUTABLE_TOOL_KEYS],
      workspaceOwned,
    });
    if (!policy.valid) throw new Error(policy.errors[0] || "schedule_policy_rejected");
    const startsAt = data.starts_at ? new Date(data.starts_at) : new Date();
    const nextRunAt = computeNextRunAt(data.cadence, startsAt, data.cron_expr);
    const { data: row, error } = await supabase
      .from("maaroof_schedules")
      .insert({
        user_id: userId,
        workspace_id: data.workspace_id ?? null,
        name: data.name,
        prompt: data.prompt,
        language: data.language,
        force_tools: data.force_tools,
        cadence: data.cadence,
        cron_expr: data.cron_expr ?? null,
        starts_at: startsAt.toISOString(),
        ends_at: data.ends_at ?? null,
        max_runs: data.max_runs,
        approval_mode: data.approval_mode,
        next_run_at: nextRunAt.toISOString(),
        status: "active",
      })
      .select("id, name, cadence, next_run_at, status")
      .single();
    if (error) throw new Error(error.message);
    return { schedule: row };
  });

export const updateScheduleStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["active", "paused", "cancelled"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("maaroof_schedules")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("maaroof_schedules")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
