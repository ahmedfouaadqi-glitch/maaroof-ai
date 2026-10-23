// Pure per-stage / per-tool time budgets (ms). No I/O.
import { TOOL_CATALOG, type CostProfile } from "@/lib/tool-catalog";

export const STAGE_TIMEOUTS = {
  understand: 20_000,
  setup: 20_000,
  plan: 60_000,
  review: 60_000,
  probe_engine: 30_000,
  probe_council: 150_000,
} as const;

export const PROFILE_TIMEOUTS: Record<CostProfile, number> = { light: 45_000, medium: 90_000, heavy: 180_000 };

/** Time budget for one tool call, by its cost profile (visibility = whole council). */
export function toolTimeoutMs(tool: string): number {
  if (tool === "visibility") return STAGE_TIMEOUTS.probe_council;
  const p = TOOL_CATALOG.find((t) => t.key === tool)?.costProfile;
  return PROFILE_TIMEOUTS[p || "medium"];
}

export class StageTimeoutError extends Error {
  constructor(public stage: string) { super(`stage_timeout:${stage}`); }
}

/** Reject with StageTimeoutError if `p` does not settle within `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number, stage: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<T>((_, rej) => { t = setTimeout(() => rej(new StageTimeoutError(stage)), ms); }),
  ]);
}
