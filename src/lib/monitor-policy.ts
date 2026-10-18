// Competitor-monitoring policy (global in app_settings.monitor_policy,
// per-user override in profiles.quota_overrides.monitor). Pure resolver.
export type MonitorPolicy = {
  enabled: boolean;
  max_watches: number;
  max_competitors: number;
  min_frequency_hours: number;
};

export const DEFAULT_MONITOR_POLICY: MonitorPolicy = {
  enabled: true,
  max_watches: 3,
  max_competitors: 5,
  min_frequency_hours: 24,
};

export function resolveMonitorPolicy(global: any, userOverride: any): MonitorPolicy {
  const g = { ...DEFAULT_MONITOR_POLICY, ...(global && typeof global === "object" ? global : {}) };
  const u = userOverride && typeof userOverride === "object" ? userOverride : {};
  const pick = <K extends keyof MonitorPolicy>(k: K) => (u[k] !== undefined && u[k] !== null ? u[k] : g[k]);
  return {
    enabled: !!pick("enabled"),
    max_watches: Math.max(0, Number(pick("max_watches")) || 0),
    max_competitors: Math.max(1, Number(pick("max_competitors")) || 1),
    min_frequency_hours: Math.max(1, Number(pick("min_frequency_hours")) || 1),
  };
}

export type PolicyCheck = { ok: true } | { ok: false; reason: "monitor_disabled" | "monitor_max_watches" | "monitor_max_competitors" | "monitor_min_frequency" };

export function checkMonitorPolicy(p: MonitorPolicy, activeWatches: number, competitors: number, frequencyHours: number): PolicyCheck {
  if (!p.enabled) return { ok: false, reason: "monitor_disabled" };
  if (activeWatches >= p.max_watches) return { ok: false, reason: "monitor_max_watches" };
  if (competitors > p.max_competitors) return { ok: false, reason: "monitor_max_competitors" };
  if (frequencyHours < p.min_frequency_hours) return { ok: false, reason: "monitor_min_frequency" };
  return { ok: true };
}


export type MonitorQuotaDecision = {
  used: number;
  limit: number;
  subscriptionActive: boolean;
  allowed: boolean;
  error: "monthly_cap_reached" | "subscription_required" | null;
};

/** Resolve the monthly analysis quota shared by create and recheck actions. */
export function resolveMonitorQuota(profile: any, cost: number, now = new Date()): MonitorQuotaDecision {
  const used = Math.max(0, Number(profile?.monthly_analyses_used) || 0);
  const overrideLimit = Number(profile?.quota_overrides?.monthly_analyses) || 0;
  const expiresAt = profile?.subscription_expires_at;
  const subscriptionActive = !!profile?.is_subscribed &&
    (!expiresAt || new Date(expiresAt).getTime() >= now.getTime());
  const limit = subscriptionActive ? Math.max(100, overrideLimit) : Math.max(5, overrideLimit);
  const allowed = limit - used >= Math.max(1, Number(cost) || 1);
  return {
    used,
    limit,
    subscriptionActive,
    allowed,
    error: allowed ? null : subscriptionActive ? "monthly_cap_reached" : "subscription_required",
  };
}
