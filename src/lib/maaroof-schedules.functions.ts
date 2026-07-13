// Maaroof schedules — CRUD for auto-run scheduled prompts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Cadence = z.enum(["once", "hourly", "daily", "weekly", "custom_cron"]);
const ApprovalMode = z.enum(["per_run", "auto_within_quota", "first_time_then_auto"]);
const Language = z.enum(["ar", "en", "ku"]);

/** Compute next_run_at from cadence. Not perfectly accurate for cron; the scheduler recomputes on each tick. */
function computeNextRunAt(cadence: string, from: Date = new Date()): Date {
  const t = new Date(from);
  switch (cadence) {
    case "hourly": t.setHours(t.getHours() + 1); return t;
    case "daily": t.setDate(t.getDate() + 1); return t;
    case "weekly": t.setDate(t.getDate() + 7); return t;
    case "once": return t;
    case "custom_cron":
    default: t.setHours(t.getHours() + 1); return t;
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
        force_tools: z.array(z.string().min(1).max(40)).max(16).default([]),
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
    const startsAt = data.starts_at ? new Date(data.starts_at) : new Date();
    const nextRunAt = data.cadence === "once" ? startsAt : computeNextRunAt(data.cadence, startsAt);
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
