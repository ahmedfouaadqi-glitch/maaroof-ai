import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin gate (mirrors the pattern used in admin.functions.ts)
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
    return next({ context: { supabaseAdmin, adminId: userId } as any });
  });

/** User-side: submit a specialty/sector change request (admins approve it). */
export const submitSpecialtyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { specialty: string; reason?: string }) =>
    z
      .object({
        specialty: z.string().trim().min(2).max(120),
        reason: z.string().trim().max(600).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const { data: pending } = await supabase
      .from("specialty_change_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();
    if (pending) return { ok: false, reason: "pending_exists" as const };

    const { data: prof } = await supabase
      .from("profiles")
      .select("specialty")
      .eq("id", userId)
      .maybeSingle();

    const { error } = await supabase.from("specialty_change_requests").insert({
      user_id: userId,
      current_specialty: (prof as any)?.specialty ?? null,
      requested_specialty: data.specialty,
      reason: data.reason || null,
      status: "pending",
    });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true as const };
  });

/** User-side: latest requests for the signed-in user. */
export const listMySpecialtyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data } = await supabase
      .from("specialty_change_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    return { rows: data || [] };
  });

/** Admin-side: list requests (pending first). */
export const adminListSpecialtyRequests = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = context as any;
    const { data, error } = await supabaseAdmin
      .from("specialty_change_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Response(error.message, { status: 400 });
    const rows = data || [];
    const ids = Array.from(new Set(rows.map((r: any) => r.user_id)));
    let emails: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .in("id", ids);
      for (const p of profs || []) emails[(p as any).id] = (p as any).email || (p as any).full_name || "";
    }
    return { rows: rows.map((r: any) => ({ ...r, email: emails[r.user_id] || "" })) };
  });

/** Admin-side: approve or reject. Approval is what actually writes the profile. */
export const adminReviewSpecialtyRequest = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { id: string; action: "approve" | "reject"; note?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["approve", "reject"]),
        note: z.string().trim().max(600).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, adminId } = context as any;
    const { data: req, error: e0 } = await supabaseAdmin
      .from("specialty_change_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (e0) throw new Response(e0.message, { status: 400 });
    if (!req) throw new Response("Request not found", { status: 404 });
    if ((req as any).status !== "pending") return { ok: false, reason: "already_reviewed" as const };

    if (data.action === "approve") {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ specialty: (req as any).requested_specialty })
        .eq("id", (req as any).user_id);
      if (error) throw new Response(error.message, { status: 400 });
    }

    const { error: e1 } = await supabaseAdmin
      .from("specialty_change_requests")
      .update({
        status: data.action === "approve" ? "approved" : "rejected",
        admin_note: data.note || null,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (e1) throw new Response(e1.message, { status: 400 });
    return { ok: true as const };
  });

/** Admin-side: set a user's specialty directly (no request needed). */
export const adminSetUserSpecialty = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { userId: string; specialty: string }) =>
    z.object({ userId: z.string().uuid(), specialty: z.string().trim().max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ specialty: data.specialty || null })
      .eq("id", data.userId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true as const };
  });
