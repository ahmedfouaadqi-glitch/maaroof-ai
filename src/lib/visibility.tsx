// Per-user UI visibility — controls which tools, widgets, pages a user sees.
// Reads `profiles.ui_visibility` (browser client, RLS scoped to own profile).
// Default-visible if a key is missing; only explicit `false` hides.
import { useEffect, useMemo, useState } from "react";
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

export type VisibilityShape = {
  tools?: Record<string, boolean>;
  agent?: Record<string, boolean>;
  widgets?: Partial<Record<WidgetKey, boolean>>;
  pages?: Partial<Record<PageKey, boolean>>;
};

const cache = new Map<string, VisibilityShape>();

export function useVisibility() {
  const { user } = useAuth();
  const [vis, setVis] = useState<VisibilityShape>(() => (user ? cache.get(user.id) || {} : {}));
  const [loading, setLoading] = useState(!!user && !cache.has(user?.id || ""));

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
      cache.set(user.id, v);
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
