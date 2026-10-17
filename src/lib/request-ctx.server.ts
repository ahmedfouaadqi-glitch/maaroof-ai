// Per-request Worker execution context (for waitUntil). Set in src/server.ts.
import { AsyncLocalStorage } from "node:async_hooks";

type Ctx = { waitUntil?: (p: Promise<unknown>) => void } | undefined;
const g = globalThis as any;
export const requestCtx: AsyncLocalStorage<Ctx> = g.__reqCtxAls ?? (g.__reqCtxAls = new AsyncLocalStorage<Ctx>());

/** True only when the current request has a Worker lifetime extension hook. */
export function canRunAfterResponse(): boolean {
  const ctx = requestCtx.getStore();
  return !!ctx && typeof ctx.waitUntil === "function";
}

/**
 * Schedules server work after the HTTP response without tying it to the client
 * connection. The work must persist its own progress; waitUntil is not a durable
 * queue and cannot guarantee recovery from Worker/process termination.
 */
export function runAfterResponseTask(task: () => Promise<unknown>): boolean {
  const ctx = requestCtx.getStore();
  if (!ctx || typeof ctx.waitUntil !== "function") return false;
  ctx.waitUntil(Promise.resolve().then(task));
  return true;
}
