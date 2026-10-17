// Per-request Worker execution context. Set in src/server.ts.
import { AsyncLocalStorage } from "node:async_hooks";

type QueueBinding = { send: (message: unknown, options?: { delaySeconds?: number }) => Promise<unknown> };
type Ctx = { env?: { MAAROOF_JOBS?: QueueBinding } } | undefined;
const g = globalThis as any;
export const requestCtx: AsyncLocalStorage<Ctx> = g.__reqCtxAls ?? (g.__reqCtxAls = new AsyncLocalStorage<Ctx>());

/** Check queue availability before charging the user for a task. */
export function hasMaaroofQueue(): boolean {
  const queue = requestCtx.getStore()?.env?.MAAROOF_JOBS;
  return !!queue && typeof queue.send === "function";
}

/** Enqueue durable work. Queue messages contain only the persisted job ID. */
export async function enqueueMaaroofJob(jobId: string, delaySeconds = 0): Promise<boolean> {
  const queue = requestCtx.getStore()?.env?.MAAROOF_JOBS;
  if (!queue || typeof queue.send !== "function") return false;
  await queue.send({ job_id: jobId }, delaySeconds > 0 ? { delaySeconds } : undefined);
  return true;
}
