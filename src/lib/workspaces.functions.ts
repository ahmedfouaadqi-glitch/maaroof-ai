// Workspaces server functions — CRUD + brand bootstrapping.
// Client-safe module: only .handler() bodies run on the server.
// Part 2 evolution: workspace now carries a rich profile (goals, policies,
// preferred models/experts/mcp, budget, etc.) — all optional and backward
// compatible; existing callers keep working with the base fields.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const WorkspaceKind = z.enum(["own", "client", "brand"]);
const Language = z.enum(["ar", "en", "ku"]);

const WORKSPACE_COLUMNS =
  "id, name, kind, brand_url, brand_summary, keywords, language, country, city, " +
  "space_kind, parent_id, profile, policies, goals, success_metrics, preferred_models, preferred_experts, preferred_mcp, risk_level, budget, " +
  "created_at, updated_at";

export const listWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("workspaces")
      .select(WORKSPACE_COLUMNS)
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
        space_kind: z.enum(["company", "subsidiary", "product", "client"]).default("company"),
        parent_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { canCreateSpace, spaceLimit } = await import("@/lib/space-structure");
    const [{ count }, { data: prof }] = await Promise.all([
      supabase.from("workspaces").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("profiles").select("subscription_tier").eq("id", userId).maybeSingle(),
    ]);
    const tier = (prof as any)?.subscription_tier ?? null;
    if (!canCreateSpace(count ?? 0, tier)) throw new Error(`space_limit_reached:${spaceLimit(tier)}`);
    if (data.parent_id) {
      const { allowedChildKinds } = await import("@/lib/space-structure");
      const [{ data: parent }, { data: owner }] = await Promise.all([
        supabase.from("workspaces").select("id, space_kind").eq("id", data.parent_id).eq("owner_id", userId).maybeSingle(),
        supabase.from("profiles").select("account_kind").eq("id", userId).maybeSingle(),
      ]);
      const parentKind = ((parent as any)?.space_kind || "company") as any;
      const acct = ((owner as any)?.account_kind ?? null) as any;
      if (!parent || !allowedChildKinds(parentKind, acct).includes(data.space_kind)) throw new Error("invalid_parent");
    }
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
        space_kind: data.parent_id ? data.space_kind : "company",
        parent_id: data.parent_id ?? null,
      } as any)
      .select(WORKSPACE_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return { workspace: row };
  });

// Reusable schemas for the Part 2 rich profile.
const JsonObject = z.record(z.string(), z.any());
const JsonArray = z.array(z.any());

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
        // Part 2 (Cognitive Architecture) fields — all optional.
        profile: JsonObject.optional(),
        policies: JsonObject.optional(),
        goals: JsonArray.optional(),
        success_metrics: JsonArray.optional(),
        preferred_models: JsonArray.optional(),
        preferred_experts: JsonArray.optional(),
        preferred_mcp: JsonArray.optional(),
        risk_level: z.string().max(40).nullable().optional(),
        budget: JsonObject.optional(),
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
      .update(patch as any)
      .eq("id", id)
      .eq("owner_id", userId)
      .select(WORKSPACE_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return { workspace: row };
  });

export const deleteWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Full delete: the space, every descendant, and the knowledge spaces
    // linked to them (their interviews/nodes/assets cascade in the database).
    const { data: all } = await supabase.from("workspaces").select("id, parent_id").eq("owner_id", userId);
    const items = (all ?? []) as { id: string; parent_id: string | null }[];
    if (!items.some((w) => w.id === data.id)) throw new Error("workspace_not_found");
    const ids = descendantIds(data.id, items);
    const { error: ksErr } = await supabase.from("knowledge_spaces").delete().in("workspace_id", ids).eq("user_id", userId);
    if (ksErr) throw new Error(ksErr.message);
    const { data: gone, error } = await supabase.from("workspaces").delete().in("id", ids).eq("owner_id", userId).select("id");
    if (error) throw new Error(error.message);
    if (!gone || gone.length === 0) throw new Error("delete_failed");
    return { ok: true, deleted: gone.map((g: any) => g.id as string) };
  });

// Returns (or creates) the knowledge space linked to a workspace, used by the
// in-workspace interview. Reuses the existing knowledge space tables.
export const ensureWorkspaceKnowledgeSpace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ws } = await supabase.from("workspaces").select("id, name, language").eq("id", data.workspaceId).eq("owner_id", userId).maybeSingle();
    if (!ws) throw new Error("workspace_not_found");
    const { data: existing } = await supabase.from("knowledge_spaces").select("id").eq("workspace_id", data.workspaceId).eq("user_id", userId).limit(1).maybeSingle();
    if (existing) return { spaceId: (existing as any).id as string };
    const { data: row, error } = await supabase.from("knowledge_spaces")
      .insert({ user_id: userId, workspace_id: data.workspaceId, name: String((ws as any).name).slice(0, 120), lang: (ws as any).language || "ar" } as any)
      .select("id").single();
    if (error) throw new Error(error.message);
    return { spaceId: (row as any).id as string };
  });

export const listInterviewQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ spaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase.from("knowledge_space_interviews")
      .select("id, question, answer, topic, created_at").eq("space_id", data.spaceId).eq("user_id", userId)
      .order("created_at", { ascending: true }).limit(60);
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });
