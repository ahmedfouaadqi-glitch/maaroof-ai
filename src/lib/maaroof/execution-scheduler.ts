/**
 * Dependency-aware scheduling for the existing Maaroof tool executor.
 *
 * Parallel batches are safe only when their inputs do not depend on another
 * step's output. The planner may declare depends_on using prior tool keys;
 * this module also protects known data-flow dependencies when the planner omits
 * them. It does not run tools or make model calls.
 */
export type ExecutionStepLike = {
  tool: string;
  input?: Record<string, unknown> | null;
  depends_on?: unknown;
};

const CONTENT_PRODUCERS = new Set([
  "analyze", "suggest", "research", "known", "visibility", "geo_strategist",
  "brand_authority", "brand_boost", "social_analysis", "applied_ranking", "compare",
]);

const COMPETITOR_SOURCES = new Set([
  "research", "known", "visibility", "brand_authority", "applied_ranking",
]);

function hasCompetitors(input: Record<string, unknown> | null | undefined): boolean {
  const value = input?.competitors;
  if (Array.isArray(value)) return value.some((v) => String(v ?? "").trim().length > 1);
  return typeof value === "string" && value.split(/[\n,؛;|]+/).some((v) => v.trim().length > 1);
}

/** Earlier step indexes whose successful outputs may be consumed by this step. */
export function dependenciesForStep(steps: ExecutionStepLike[], index: number): number[] {
  const step = steps[index];
  if (!step || index <= 0) return [];

  const prior = steps.slice(0, index);
  const dependencies = new Set<number>();
  const declared = Array.isArray(step.depends_on) ? step.depends_on : [];

  for (const raw of declared) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    // A tool key may appear more than once. Depend on its latest earlier occurrence.
    for (let i = index - 1; i >= 0; i--) {
      if (steps[i]?.tool === raw.trim()) {
        dependencies.add(i);
        break;
      }
    }
  }

  if (step.tool === "translate" || step.tool === "teach_space") {
    for (let i = 0; i < index; i++) dependencies.add(i);
  } else if (step.tool === "compare" && !hasCompetitors(step.input)) {
    for (let i = 0; i < index; i++) {
      if (COMPETITOR_SOURCES.has(steps[i]?.tool || "")) dependencies.add(i);
    }
  } else if (step.tool === "geo_rewrite" && String(step.input?.text ?? "").trim().length < 25) {
    for (let i = 0; i < index; i++) {
      if (CONTENT_PRODUCERS.has(steps[i]?.tool || "")) dependencies.add(i);
    }
  }

  return [...dependencies].sort((a, b) => a - b);
}

/**
 * Return deterministic, topologically safe waves of step indexes.
 * Only independent steps share a wave; dependencies always finish first.
 */
export function buildExecutionBatches(steps: ExecutionStepLike[], maxParallel = 3): number[][] {
  if (!steps.length) return [];
  const limit = Math.max(1, Math.floor(Number(maxParallel) || 1));
  const dependencies = steps.map((_, i) => dependenciesForStep(steps, i));
  const pending = new Set(steps.map((_, i) => i));
  const completed = new Set<number>();
  const batches: number[][] = [];

  while (pending.size) {
    const ready = [...pending]
      .filter((index) => dependencies[index].every((dependency) => completed.has(dependency)))
      .sort((a, b) => a - b)
      .slice(0, limit);

    // All inferred edges point backward, so this is defensive against malformed input.
    const batch = ready.length ? ready : [Math.min(...pending)];
    batches.push(batch);
    for (const index of batch) {
      pending.delete(index);
      completed.add(index);
    }
  }

  return batches;
}
