// Per-user, per-tool result history (stored in report_drafts, owner-scoped RLS).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_PER_TOOL = 50;

export const saveToolResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { toolKey: string; title: string; payload: any; lang?: string }) =>
    z
      .object({
        toolKey: z.string().trim().min(1).max(60),
        title: z.string().trim().min(1).max(300),
        payload: z.any(),
        lang: z.string().trim().max(8).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: row, error } = await supabase
      .from("report_drafts")
      .insert({
        user_id: userId,
        tool_key: data.toolKey,
        title: data.title,
        payload: data.payload,
        lang: data.lang || "ar",
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);

    // Trim to the newest MAX_PER_TOOL rows for this tool.
    const { data: olds } = await supabase
      .from("report_drafts")
      .select("id")
      .eq("user_id", userId)
      .eq("tool_key", data.toolKey)
      .order("created_at", { ascending: false })
      .range(MAX_PER_TOOL, MAX_PER_TOOL + 200);
    const ids = (olds || []).map((r: any) => r.id);
    if (ids.length) await supabase.from("report_drafts").delete().in("id", ids);

    return { ok: true, id: row?.id as string, created_at: row?.created_at as string };
  });

export const listToolHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { toolKey?: string; limit?: number }) =>
    z.object({ toolKey: z.string().trim().max(60).optional(), limit: z.number().int().min(1).max(200).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    let q = supabase
      .from("report_drafts")
      .select("id, tool_key, title, lang, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? MAX_PER_TOOL);
    if (data.toolKey) q = q.eq("tool_key", data.toolKey);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows || [] };
  });

export const getToolResult = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: row, error } = await supabase
      .from("report_drafts")
      .select("id, tool_key, title, lang, payload, created_at")
      .eq("user_id", userId)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("not_found");
    return row;
  });

export const deleteToolResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase.from("report_drafts").delete().eq("user_id", userId).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearToolHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { toolKey: string }) => z.object({ toolKey: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase
      .from("report_drafts")
      .delete()
      .eq("user_id", userId)
      .eq("tool_key", data.toolKey);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
