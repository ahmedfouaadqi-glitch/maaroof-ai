// Cognitive layer — server functions (RPC).
// runCognition: called by tool components after each successful run.
// getUserIntelligence / refreshUserIntent: admin-only.

import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  EMPTY_PROFILE,
  extractIntent,
  loadIntentProfile,
  mergeContextSummary,
  rollSignals,
  type DetectedIntent,
} from "@/lib/cognition.server";

const KNOWN_TOOLS = [
  "analyze","suggest","compare","feasibility","bizdev","research",
  "visibility","brand_boost","company_email","applied_ranking","geo_strategist",
  "competitor_monitor","social_analysis","what_if","brand_authority","geo_rewrite",
];

const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context as any;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!data) throw new Response("Forbidden: admin only", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return next({ context: { supabaseAdmin } as any });
  });

// ===== runCognition (any authenticated user; updates their own profile) =====
export const runCognition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { toolKey: string; inputSummary?: string; outputSummary?: string }) =>
    z.object({
      toolKey: z.string().min(1).max(64),
      inputSummary: z.string().max(2000).optional(),
      outputSummary: z.string().max(4000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    if (!userId) return { ok: false, intent: null };

    // Check cognition_enabled toggle
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const { data: setting } = await supabaseAdmin
        .from("app_settings").select("value").eq("key", "cognition_enabled").maybeSingle();
      if (setting && (setting.value as any)?.enabled === false) {
        return { ok: false, intent: null, disabled: true };
      }
    } catch {}

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, intent: null };

    const prev = await loadIntentProfile(supabaseAdmin, userId);
    const fresh = await extractIntent({
      apiKey,
      prev,
      toolKey: data.toolKey,
      inputSummary: data.inputSummary || "",
      outputSummary: data.outputSummary || "",
      knownTools: KNOWN_TOOLS,
    });

    const nextSignals = rollSignals(prev, { tool: data.toolKey, input: data.inputSummary, output: data.outputSummary });
    const nextSummary = mergeContextSummary(prev, fresh);

    try {
      await supabaseAdmin.from("user_intent_profile").upsert({
        user_id: userId,
        detected_intent: (fresh as any) || prev.detected_intent || {},
        context_summary: nextSummary,
        last_signals: nextSignals as any,
        signal_count: (prev.signal_count || 0) + 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    } catch {}

    return { ok: true, intent: fresh as DetectedIntent | null };
  });

// ===== Admin: list all users + their intent =====
export const getUserIntelligence = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = context as any;
    const { data: profiles } = await supabaseAdmin
      .from("user_intent_profile")
      .select("user_id, detected_intent, context_summary, signal_count, updated_at")
      .order("updated_at", { ascending: false })
      .limit(500);
    const userIds = (profiles || []).map((p: any) => p.user_id);
    let users: Record<string, { email: string | null; specialty: string | null }> = {};
    if (userIds.length) {
      const { data: ps } = await supabaseAdmin.from("profiles").select("id, email, specialty").in("id", userIds);
      for (const p of ps || []) users[p.id] = { email: p.email, specialty: p.specialty };
    }
    return {
      rows: (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        email: users[p.user_id]?.email || null,
        specialty: users[p.user_id]?.specialty || null,
        detected_intent: p.detected_intent || {},
        context_summary: p.context_summary || "",
        signal_count: p.signal_count || 0,
        updated_at: p.updated_at,
      })),
    };
  });

// ===== Admin: reset intent for a user =====
export const refreshUserIntent = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    await supabaseAdmin.from("user_intent_profile").upsert({
      user_id: data.userId,
      detected_intent: {} as any,
      context_summary: null,
      last_signals: [] as any,
      signal_count: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    return { ok: true };
  });
