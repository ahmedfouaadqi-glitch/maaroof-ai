// Workspaces server functions — CRUD + brand bootstrapping.
// Client-safe module: only .handler() bodies run on the server.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const WorkspaceKind = z.enum(["own", "client", "brand"]);
const Language = z.enum(["ar", "en", "ku"]);

export const listWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("workspaces")
      .select("id, name, kind, brand_url, brand_summary, keywords, language, country, city, created_at, updated_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(100),
        kind: WorkspaceKind.default("own"),
        brand_url: z.string().url().optional().nullable(),
        keywords: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
        language: Language.default("ar"),
        country: z.string().max(80).optional().nullable(),
        city: z.string().max(80).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("workspaces")
      .insert({
        owner_id: userId,
        name: data.name,
        kind: data.kind,
        brand_url: data.brand_url ?? null,
        keywords: data.keywords,
        language: data.language,
        country: data.country ?? null,
        city: data.city ?? null,
      })
      .select("id, name, kind, brand_url, keywords, language, country, city, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { workspace: row };
  });

export const updateWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(100).optional(),
        kind: WorkspaceKind.optional(),
        brand_url: z.string().url().nullable().optional(),
        brand_summary: z.string().max(4000).nullable().optional(),
        keywords: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
        language: Language.optional(),
        country: z.string().max(80).nullable().optional(),
        city: z.string().max(80).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
    const { data: row, error } = await supabase
      .from("workspaces")
      .update(patch)
      .eq("id", id)
      .eq("owner_id", userId)
      .select("id, name, kind, brand_url, brand_summary, keywords, language, country, city, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { workspace: row };
  });

export const deleteWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("workspaces").delete().eq("id", data.id).eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
