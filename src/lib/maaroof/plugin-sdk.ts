// Part 6 — Plugin SDK (thin re-export wrappers).
// Fusion, not replacement: this file exposes a single typed surface that
// lets external code register new capabilities, agents, and MCP providers
// through the SAME database inserts the kernel already uses. The kernel
// (orchestrator, capability registry, MCP dispatcher) is unchanged.
//
// See docs/PLUGIN-SDK.md for the contract.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Capability, ToolDef } from "@/lib/tool-catalog";

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _admin;
}

/** Register a new MCP provider (admin-side plugin registration). */
export async function registerMcp(input: {
  name: string;
  kind: string;
  endpoint?: string | null;
  auth_kind?: string | null;
  enabled?: boolean;
  capabilities?: Capability[];
  meta?: Record<string, unknown>;
}) {
  const row = {
    name: input.name,
    kind: input.kind,
    endpoint: input.endpoint ?? null,
    auth_kind: input.auth_kind ?? null,
    enabled: input.enabled ?? false,
    capabilities: input.capabilities ?? [],
    meta: input.meta ?? {},
  };
  const { data, error } = await admin().from("mcp_providers").insert(row).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return { id: (data as any)?.id as string };
}

/**
 * Register a plugin-defined agent template as a durable agent row
 * (reuses existing maaroof_agents lifecycle). The agent is created in
 * `standby` so warm-reuse picks it up on the next matching run.
 */
export async function registerAgent(input: {
  userId: string;
  workspaceId?: string | null;
  role: string;
  mission: string;
  dna: Record<string, unknown>;
}) {
  const { data, error } = await admin()
    .from("maaroof_agents")
    .insert({
      user_id: input.userId,
      workspace_id: input.workspaceId ?? null,
      role: input.role.slice(0, 80),
      mission: input.mission.slice(0, 240),
      dna: input.dna,
      lifecycle_state: "standby",
      version: 1,
      success_rate: null,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { id: (data as any)?.id as string };
}

/**
 * Pin a preferred implementation for a capability (Capability Marketplace).
 * Stored in app_settings under key `capability_preferences` — read by
 * capability.server.ts.
 */
export async function pinCapabilityImplementation(input: {
  capability: Capability;
  expertKey: ToolDef["key"];
}) {
  const { data } = await admin()
    .from("app_settings")
    .select("value")
    .eq("key", "capability_preferences")
    .maybeSingle();
  const prev = ((data as any)?.value as Record<string, string>) || {};
  const next = { ...prev, [input.capability]: input.expertKey };
  await admin().from("app_settings").upsert({ key: "capability_preferences", value: next as any });
  return { ok: true };
}

export type PluginSdk = {
  registerMcp: typeof registerMcp;
  registerAgent: typeof registerAgent;
  pinCapabilityImplementation: typeof pinCapabilityImplementation;
};

export const pluginSdk: PluginSdk = {
  registerMcp,
  registerAgent,
  pinCapabilityImplementation,
};
