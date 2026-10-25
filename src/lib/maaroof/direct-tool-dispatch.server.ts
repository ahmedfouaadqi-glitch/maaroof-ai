// Server-only in-process dispatch for internal Maaroof tools.
// Cloudflare can block a Worker calling its own public origin. Calling the same
// route handler directly avoids that network loop while preserving the endpoint's
// existing auth, validation, billing, and response contract.
type RouteLike = {
  Route?: {
    options?: {
      server?: {
        middleware?: unknown[];
        handlers?: Record<string, unknown> | ((ctx: any) => unknown);
      };
    };
  };
};

type Handler = (context: { request: Request; params?: Record<string, string>; context?: Record<string, unknown> }) => Response | Promise<Response>;

const ROUTE_LOADERS: Record<string, () => Promise<RouteLike>> = {
  "/api/analyze": () => import("@/routes/api/analyze"),
  "/api/suggest": () => import("@/routes/api/suggest"),
  "/api/compare": () => import("@/routes/api/compare"),
  "/api/known": () => import("@/routes/api/known"),
  "/api/feasibility": () => import("@/routes/api/feasibility"),
  "/api/bizdev": () => import("@/routes/api/bizdev"),
  "/api/research": () => import("@/routes/api/research"),
  "/api/visibility": () => import("@/routes/api/visibility"),
  "/api/brand-boost": () => import("@/routes/api/brand-boost"),
  "/api/company-email": () => import("@/routes/api/company-email"),
  "/api/applied-ranking": () => import("@/routes/api/applied-ranking"),
  "/api/geo-strategist": () => import("@/routes/api/geo-strategist"),
  "/api/competitor-monitor": () => import("@/routes/api/competitor-monitor"),
  "/api/social-analysis": () => import("@/routes/api/social-analysis"),
  "/api/what-if": () => import("@/routes/api/what-if"),
  "/api/brand-authority": () => import("@/routes/api/brand-authority"),
  "/api/geo-rewrite": () => import("@/routes/api/geo-rewrite"),
};

export const DIRECT_ROUTE_PATHS = Object.freeze(Object.keys(ROUTE_LOADERS));

export function resolveDirectPostHandler(routeLike: unknown): Handler | null {
  const route = routeLike as any;
  const server = route?.Route?.options?.server ?? route?.options?.server;
  // Do not bypass route-level middleware. A route using middleware must go through
  // TanStack Start's normal HTTP router so its middleware chain is honored.
  if (Array.isArray(server?.middleware) && server.middleware.length > 0) return null;
  const handlers = server?.handlers;
  // Handler factories need Start's runtime context; safely use HTTP fallback instead.
  if (!handlers || typeof handlers !== "object") return null;
  const entry = handlers.POST;
  if (entry && typeof entry === "object") {
    if (Array.isArray((entry as any).middleware) && (entry as any).middleware.length > 0) return null;
    return typeof (entry as any).handler === "function" ? (entry as any).handler as Handler : null;
  }
  return typeof entry === "function" ? entry as Handler : null;
}

/**
 * Invoke an allow-listed POST route within this Worker. A null result means direct
 * dispatch could not be resolved before the handler ran, so the caller may use HTTP fallback.
 * Errors thrown by the handler are intentionally propagated: never re-run a tool that
 * may already have performed side effects or spent credits.
 */
export async function dispatchToolInProcess(path: string, request: Request): Promise<Response | null> {
  const load = ROUTE_LOADERS[path];
  if (!load) return null;
  let route: RouteLike;
  try {
    route = await load();
  } catch (error) {
    console.warn("[maaroof] direct route import unavailable; using HTTP fallback", path, String((error as any)?.message || error).slice(0, 180));
    return null;
  }
  const handler = resolveDirectPostHandler(route);
  if (!handler) {
    console.warn("[maaroof] direct route handler unavailable; using HTTP fallback", path);
    return null;
  }
  // Current internal tool handlers consume the request and authenticate using the
  // same forwarded bearer token as the old HTTP call.
  return await handler({ request, params: {}, context: {} });
}
