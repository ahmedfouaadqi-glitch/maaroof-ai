// Per-request Worker execution context. Set in src/server.ts.
import { AsyncLocalStorage } from "node:async_hooks";

type QueueBinding = { send: (message: unknown) => Promise<unknown> };
type Ctx = { waitUntil?: (p: Promise<unknown>) => void; env?: { MAAROOF_JOBS?: QueueBinding } } | undefined;
const g = globalThis as any;
export const requestCtx: AsyncLocalStorage<Ctx> = g.__reqCtxAls ?? (g.__reqCtxAls = new AsyncLocalStorage<Ctx>());

/** Send durable work to Cloudflare Queues when the binding is provisioned. */
export async function enqueueMaaroofJob(jobId: string): Promise<boolean> {
  const queue = requestCtx.getStore()?.env?.MAAROOF_JOBS;
  if (!queue || typeof queue.send !== "function") return false;
  await queue.send({ job_id: jobId });
  return true;
}

/** Best-effort fallback for short work only; Cloudflare limits waitUntil after response. */
export function runAfterResponseTask(task: () => Promise<unknown>): boolean {
  const ctx = requestCtx.getStore();
  if (!ctx || typeof ctx.waitUntil !== "function") return false;
  ctx.waitUntil(Promise.resolve().then(task));
  return true;
}
