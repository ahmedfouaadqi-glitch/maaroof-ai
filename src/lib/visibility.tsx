// Per-user UI visibility — controls which tools, widgets, pages a user sees.
// Reads `profiles.ui_visibility` (browser client, RLS scoped to own profile).
// Default-visible if a key is missing; only explicit `false` hides.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type WidgetKey =
  | "tokens_bar"
  | "cost_badge"
  | "progress_bar"
  | "results_export"
  | "history"
  | "alerts_bell"
  | "handoff_menu"
  | "engines_orbit"
  | "specialty_banner"
  | "tool_links";

export type PageKey = "dashboard" | "agent" | "tools" | "guide" | "pricing";

export type ToolPriceOverride = {
  enabled?: boolean;
  tokens_per_use?: number;
  usd_per_use?: number;
};

export type VisibilityShape = {
  tools?: Record<string, boolean>;
  agent?: Record<string, boolean>;
  widgets?: Partial<Record<WidgetKey, boolean>>;
  pages?: Partial<Record<PageKey, boolean>>;
};

const visCache = new Map<string, VisibilityShape>();
const priceCache = new Map<string, { overrides: Record<string, ToolPriceOverride>; plan: Record<string, { tokens: number; usd: number; enabled: boolean }> }>();

// Safe useAuth — returns null when no provider (e.g. on /tools/$slug)
function useAuthSafe() {
  try { return useAuth(); } catch { return null; }
}

export function useVisibility() {
  const auth = useAuthSafe();
  const user = auth?.user || null;
  const [vis, setVis] = useState<VisibilityShape>(() => (user ? visCache.get(user.id) || {} : {}));
  const [loading, setLoading] = useState(!!user && !visCache.has(user?.id || ""));

  useEffect(() => {
    if (!user) {
      setVis({});
      setLoading(false);
      return;
    }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("ui_visibility")
        .eq("id", user.id)
        .maybeSingle();
      if (cancel) return;
      const v = ((data as any)?.ui_visibility || {}) as VisibilityShape;
      visCache.set(user.id, v);
      setVis(v);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user?.id]);

  const api = useMemo(() => ({
    loading,
    raw: vis,
    isToolVisible: (key: string) => vis.tools?.[key] !== false,
    isAgentFeatureVisible: (key: string) => vis.agent?.[key] !== false,
    isWidgetVisible: (key: WidgetKey) => vis.widgets?.[key] !== false,
    isPageVisible: (key: PageKey) => vis.pages?.[key] !== false,
  }), [vis, loading]);

  return api;
}

// Convenience: hide children entirely when widget is disabled
export function Widget({ k, children }: { k: WidgetKey; children: React.ReactNode }) {
  const { isWidgetVisible, loading } = useVisibility();
  if (loading) return <>{children}</>;
  if (!isWidgetVisible(k)) return null;
  return <>{children}</>;
}

/**
 * Page-level guard: if the current route is hidden for this user,
 * redirect home. Call once at the top of a page component.
 */
const PATH_TO_PAGE: Array<[RegExp, PageKey]> = [
  [/^\/dashboard(\/|$)/, "dashboard"],
  [/^\/agent(\/|$)/, "agent"],
  [/^\/tools(\/|$)/, "tools"],
  [/^\/guide(\/|$)/, "guide"],
  [/^\/pricing(\/|$)/, "pricing"],
];

export function usePageGuard() {
  const vis = useVisibility();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (vis.loading) return;
    const match = PATH_TO_PAGE.find(([rx]) => rx.test(pathname));
    if (!match) return;
    if (!vis.isPageVisible(match[1])) navigate({ to: "/" });
  }, [vis.loading, pathname]);
}

/**
 * Resolve a tool's natural price for the current user.
 * Order: per_user_tool_overrides → active plan's tool_plan_access → unpriced.
 * Returns { tokens, usd, source, enabled } — `enabled=false` means admin disabled it.
 */
export function useToolPrice(toolKey: string) {
  const auth = useAuthSafe();
  const user = auth?.user || null;
  const profile = auth?.profile as any;
  const [data, setData] = useState<{ tokens: number; usd: number; source: "user_override" | "plan" | "unpriced"; enabled: boolean }>({
    tokens: 0, usd: 0, source: "unpriced", enabled: true,
  });

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      let cached = priceCache.get(user.id);
      if (!cached) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("per_user_tool_overrides, subscription_tier, is_subscribed, subscription_expires_at")
          .eq("id", user.id)
          .maybeSingle();
        const overrides = ((prof as any)?.per_user_tool_overrides || {}) as Record<string, ToolPriceOverride>;
        const planMap: Record<string, { tokens: number; usd: number; enabled: boolean }> = {};
        const active = !!(prof as any)?.is_subscribed && (!(prof as any)?.subscription_expires_at || new Date((prof as any).subscription_expires_at) >= new Date());
        if (active && (prof as any)?.subscription_tier) {
          const { data: planRow } = await supabase.from("subscription_plans").select("id").eq("name", (prof as any).subscription_tier).maybeSingle();
          const pid = (planRow as any)?.id;
          if (pid) {
            const { data: rows } = await supabase.from("tool_plan_access").select("tool_key, tokens_per_use, usd_per_use, enabled").eq("plan_id", pid);
            for (const r of (rows as any[]) || []) {
              planMap[r.tool_key] = { tokens: Number(r.tokens_per_use) || 0, usd: Number(r.usd_per_use) || 0, enabled: !!r.enabled };
            }
          }
        }
        cached = { overrides, plan: planMap };
        priceCache.set(user.id, cached);
      }
      if (cancel) return;
      const ov = cached.overrides[toolKey];
      if (ov && ov.enabled === false) { setData({ tokens: 0, usd: 0, source: "user_override", enabled: false }); return; }
      if (ov && (Number(ov.tokens_per_use) > 0 || Number(ov.usd_per_use) > 0)) {
        setData({ tokens: Number(ov.tokens_per_use) || 0, usd: Number(ov.usd_per_use) || 0, source: "user_override", enabled: true });
        return;
      }
      const pl = cached.plan[toolKey];
      if (pl && pl.enabled && (pl.tokens > 0 || pl.usd > 0)) {
        setData({ tokens: pl.tokens, usd: pl.usd, source: "plan", enabled: true });
        return;
      }
      setData({ tokens: 0, usd: 0, source: "unpriced", enabled: true });
    })();
    return () => { cancel = true; };
  }, [user?.id, toolKey, profile?.subscription_tier]);

  return data;
}

// Clear price cache (call after admin changes pricing)
export function clearToolPriceCache(userId?: string) {
  if (userId) priceCache.delete(userId);
  else priceCache.clear();
}
