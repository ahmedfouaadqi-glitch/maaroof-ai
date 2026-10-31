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

/** Records the verified workspace for this request so shared helpers (cache, brand context) stay scoped to it. */
export function setActiveWorkspace(id: string | null): void {
  const ctx = requestCtx.getStore() as any;
  if (ctx && typeof ctx === "object") { try { ctx.__maaroofWorkspaceId = id; } catch {} }
}
/** The workspace verified by workspaceGuard for this request, or null for the main account. */
export function activeWorkspaceId(): string | null {
  const ctx = requestCtx.getStore() as any;
  const v = ctx && typeof ctx === "object" ? ctx.__maaroofWorkspaceId : null;
  return typeof v === "string" && v ? v : null;
}
