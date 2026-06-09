import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Middleware that ensures the caller is an authenticated admin.
const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context as any;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw new Response("Auth check failed", { status: 500 });
    if (!data) throw new Response("Forbidden: admin only", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return next({ context: { supabaseAdmin } as any });
  });

const uuid = z.string().uuid();
const json = z.record(z.string(), z.any());

// ============ user_roles ============
export const adminGrantRole = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { userId: string; role: "admin" | "user" }) =>
    z.object({ userId: uuid, role: z.enum(["admin", "user"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const adminRevokeRole = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { userId: string; role: "admin" | "user" }) =>
    z.object({ userId: uuid, role: z.enum(["admin", "user"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

// ============ profiles (whitelisted admin-editable fields) ============
const PROFILE_PATCH_FIELDS = [
  "is_subscribed",
  "subscription_tier",
  "subscription_expires_at",
  "monthly_analyses_used",
  "monthly_suggestions_used",
  "daily_analyses_used",
  "daily_suggestions_used",
  "usage_period_start",
  "usage_day_start",
  "quota_overrides",
  "max_devices",
  "extra_device_fee_iqd",
  "tool_geo_scopes",
  "device_locked_at",
  "device_fingerprint",
  "device_fingerprints",
  "tokens_balance",
  "tokens_monthly_limit",
  "tokens_daily_limit",
  "tokens_used_today",
  "tokens_used_month",
  "per_user_tool_overrides",
  "hide_usage_counter",
  "ui_visibility",
] as const;

const profilePatchSchema = z
  .object(Object.fromEntries(PROFILE_PATCH_FIELDS.map((k) => [k, z.any().optional()])) as any)
  .strict();

export const adminPatchProfile = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { userId: string; patch: Record<string, any> }) =>
    z.object({ userId: uuid, patch: profilePatchSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(data.patch)
      .eq("id", data.userId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

// ============ subscription_plans ============
const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const pricesMap = z.record(currencyCode, z.number().min(0));

const planPayload = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(1000).nullable().optional(),
    price_iqd: z.number().min(0).optional(),
    price_usd: z.number().min(0).optional(),
    prices: pricesMap.optional(),
    default_currency: currencyCode.optional(),
    duration_days: z.number().int().min(1).max(3650).optional(),
    monthly_analyses: z.number().int().min(0).optional(),
    monthly_suggestions: z.number().int().min(0).optional(),
    monthly_tokens: z.number().int().min(0).optional(),
    daily_tokens: z.number().int().min(0).optional(),
    agent_daily_cap: z.number().int().min(0).nullable().optional(),
    agent_monthly_cap: z.number().int().min(0).nullable().optional(),
    agent_max_targets: z.number().int().min(0).nullable().optional(),
    active: z.boolean().optional(),
    sort_order: z.number().int().optional(),
    features: z.array(z.string()).optional(),
  })
  .strict();

export const adminCreatePlan = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) => z.object({ values: planPayload }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const { data: row, error } = await supabaseAdmin
      .from("subscription_plans")
      .insert(data.values as any)
      .select()
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true, row };
  });

export const adminUpdatePlan = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) =>
    z.object({ planId: uuid, patch: planPayload }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const { error } = await supabaseAdmin
      .from("subscription_plans")
      .update(data.patch as any)
      .eq("id", data.planId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const adminDeletePlan = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) => z.object({ planId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const { error } = await supabaseAdmin
      .from("subscription_plans")
      .delete()
      .eq("id", data.planId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

// ============ tool_plan_access ============
const tpaRow = z
  .object({
    plan_id: uuid,
    tool_key: z.string().min(1).max(100),
    enabled: z.boolean(),
    tokens_per_use: z.number().min(0).nullable().optional(),
    usd_per_use: z.number().min(0).nullable().optional(),
    prices: pricesMap.optional(),
    default_currency: currencyCode.optional(),
    monthly_quota: z.number().int().min(0).nullable().optional(),
    daily_quota: z.number().int().min(0).nullable().optional(),
  })
  .strict();

export const adminUpsertToolPlanAccess = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) =>
    z.object({ rows: z.array(tpaRow).min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const { error } = await supabaseAdmin
      .from("tool_plan_access")
      .upsert(data.rows as any, { onConflict: "plan_id,tool_key" });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

// ============ subscription_requests (approve / reject) ============
export const adminDecideSubscriptionRequest = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) =>
    z.object({
      requestId: uuid,
      status: z.enum(["approved", "rejected"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    // Fetch request with related plan / addon
    const { data: req, error: rErr } = await supabaseAdmin
      .from("subscription_requests")
      .select(
        "*, subscription_plans(name, duration_days, monthly_analyses, monthly_suggestions), agent_addons(name, monthly_tasks)",
      )
      .eq("id", data.requestId)
      .maybeSingle();
    if (rErr) throw new Response(rErr.message, { status: 400 });
    if (!req) throw new Response("Request not found", { status: 404 });

    await supabaseAdmin
      .from("subscription_requests")
      .update({ status: data.status, reviewed_at: new Date().toISOString() })
      .eq("id", data.requestId);

    if (data.status === "approved") {
      if (req.request_type === "plan" && req.subscription_plans) {
        const expires = new Date(
          Date.now() + (req.subscription_plans.duration_days || 30) * 86400000,
        ).toISOString();
        await supabaseAdmin
          .from("profiles")
          .update({
            is_subscribed: true,
            subscription_tier: req.subscription_plans.name,
            subscription_expires_at: expires,
            monthly_analyses_used: 0,
            monthly_suggestions_used: 0,
            usage_period_start: new Date().toISOString(),
          })
          .eq("id", req.user_id);
      } else if (req.request_type === "agent" && req.agent_addon_id) {
        const expires = new Date(Date.now() + 30 * 86400000).toISOString();
        await supabaseAdmin.from("user_agent_subscriptions").insert({
          user_id: req.user_id,
          addon_id: req.agent_addon_id,
          status: "active",
          expires_at: expires,
          period_start: new Date().toISOString(),
        });
      }
    }
    return { ok: true };
  });

// ============ user_agent_subscriptions ============
const agentSubPatch = z
  .object({
    addon_id: uuid.optional(),
    status: z.enum(["active", "expired", "pending", "cancelled"]).optional(),
    expires_at: z.string().nullable().optional(),
    period_start: z.string().optional(),
    tasks_used: z.number().int().min(0).optional(),
    tasks_used_today: z.number().int().min(0).optional(),
  })
  .strict();

export const adminPatchAgentSubscription = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) =>
    z.object({ id: uuid, patch: agentSubPatch }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const { error } = await supabaseAdmin
      .from("user_agent_subscriptions")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const adminGrantAgentSubscription = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) =>
    z.object({
      email: z.string().email().optional(),
      userId: uuid.optional(),
      addonId: uuid,
      days: z.number().int().min(1).max(3650).default(30),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    let uid = data.userId;
    if (!uid) {
      if (!data.email) throw new Response("email or userId required", { status: 400 });
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", data.email.trim().toLowerCase())
        .maybeSingle();
      if (!prof) throw new Response("User not found", { status: 404 });
      uid = prof.id;
    }
    const expires = new Date(Date.now() + (data.days || 30) * 86400000).toISOString();
    const { error } = await supabaseAdmin.from("user_agent_subscriptions").insert({
      user_id: uid,
      addon_id: data.addonId,
      status: "active",
      expires_at: expires,
      period_start: new Date().toISOString(),
    });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

// ============ agent_addons ============
const addonPayload = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(1000).nullable().optional(),
    price_iqd: z.number().int().min(0).optional(),
    prices: pricesMap.optional(),
    default_currency: currencyCode.optional(),
    monthly_tasks: z.number().int().min(0).optional(),
    daily_task_cap: z.number().int().min(0).optional(),
    max_targets: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
    sort_order: z.number().int().optional(),
    features: z.array(z.string()).optional(),
  })
  .strict();

export const adminCreateAddon = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) => z.object({ values: addonPayload }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const { error } = await supabaseAdmin.from("agent_addons").insert(data.values as any);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const adminUpdateAddon = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) =>
    z.object({ id: uuid, patch: addonPayload }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const { error } = await supabaseAdmin
      .from("agent_addons")
      .update(data.patch as any)
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const adminDeleteAddon = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const { error } = await supabaseAdmin
      .from("agent_addons")
      .delete()
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

// ============ app_settings ============
export const adminSetAppSetting = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) =>
    z.object({
      key: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
      value: json,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert(
        { key: data.key, value: data.value as any, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

// ============ tool_plan_access (single upsert/update by id) ============
const tpaPatch = z
  .object({
    enabled: z.boolean().optional(),
    tokens_per_use: z.number().min(0).optional(),
    usd_per_use: z.number().min(0).optional(),
    monthly_quota: z.number().int().min(0).nullable().optional(),
    daily_quota: z.number().int().min(0).nullable().optional(),
  })
  .strict();

export const adminUpsertSingleToolPlanAccess = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) =>
    z.object({
      planId: uuid,
      toolKey: z.string().min(1).max(100),
      patch: tpaPatch,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const payload: any = {
      plan_id: data.planId,
      tool_key: data.toolKey,
      enabled: data.patch.enabled ?? true,
      tokens_per_use: data.patch.tokens_per_use ?? 0,
      usd_per_use: data.patch.usd_per_use ?? 0,
      monthly_quota: data.patch.monthly_quota ?? null,
      daily_quota: data.patch.daily_quota ?? null,
    };
    const { error } = await supabaseAdmin
      .from("tool_plan_access")
      .upsert(payload, { onConflict: "plan_id,tool_key" });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });
