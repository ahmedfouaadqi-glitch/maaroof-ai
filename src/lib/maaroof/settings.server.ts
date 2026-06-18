// Maaroof dynamic settings — cached for 60s. Read by orchestrator + api/maaroof.
import { createClient } from "@supabase/supabase-js";

export type MaaroofSettings = {
  trial_daily_cap: number;
  tool_timeout_ms: number;
  max_steps: number;
  max_goal_chars: number;
  planner_model: string;
  fallback_model: string;
  enabled_tools: string[];
  system_prompt_extra: string;
  kill_switch: boolean;
};

const DEFAULTS: MaaroofSettings = {
  trial_daily_cap: 5,
  tool_timeout_ms: 45000,
  max_steps: 12,
  max_goal_chars: 2000,
  planner_model: "google/gemini-2.5-pro",
  fallback_model: "google/gemini-2.5-flash",
  enabled_tools: [
    "suggest","geo_rewrite","analyze","research","feasibility","bizdev",
    "brand_boost","what_if","applied_ranking","visibility","social_analysis",
    "compare","company_email","geo_strategist","competitor_monitor","brand_authority",
  ],
  system_prompt_extra: "",
  kill_switch: false,
};

let _cache: { at: number; value: MaaroofSettings } | null = null;
const TTL_MS = 60_000;

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return _db;
}

export async function getMaaroofSettings(force = false): Promise<MaaroofSettings> {
  if (!force && _cache && Date.now() - _cache.at < TTL_MS) return _cache.value;
  try {
    const { data } = await db().from("maaroof_settings").select("key, value");
    const out: any = { ...DEFAULTS };
    for (const row of (data as any[]) || []) {
      if (row.key in DEFAULTS) out[row.key] = row.value;
    }
    _cache = { at: Date.now(), value: out as MaaroofSettings };
    return out as MaaroofSettings;
  } catch {
    return DEFAULTS;
  }
}

export function invalidateMaaroofSettings() { _cache = null; }
