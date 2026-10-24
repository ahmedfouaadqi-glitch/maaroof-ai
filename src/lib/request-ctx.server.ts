// Per-request Worker execution context (for waitUntil). Set in src/server.ts.
import { AsyncLocalStorage } from "node:async_hooks";

type Ctx = { waitUntil?: (p: Promise<unknown>) => void } | undefined;
const g = globalThis as any;
export const requestCtx: AsyncLocalStorage<Ctx> = g.__reqCtxAls ?? (g.__reqCtxAls = new AsyncLocalStorage<Ctx>());

/** Schedules work to continue after the response. Without waitUntil (Node dev server) the
 * promise is left running unawaited instead of being dropped. Always returns true. */
export function runAfterResponse(p: Promise<unknown>): boolean {
  const ctx = requestCtx.getStore();
  if (ctx && typeof ctx.waitUntil === "function") { ctx.waitUntil(p); return true; }
  p.catch((e) => console.error("[runAfterResponse] background work failed", e));
  return true;
}
