/**
 * Optional Alexandria connector. Discovery is non-executing; capability calls are
 * blocked unless a server feature flag, a cost quote, explicit user approval,
 * organization terms acceptance, and a stable request id are all present.
 */
import { canExecuteSpecializedSource, normalizeSourceEvidence } from "./source-intelligence";

const API = "https://api.firecrawl.dev/v2";
const MAX_DISCOVERY_LIMIT = 5;
const MAX_QUERY_LENGTH = 400;

export type AlexandriaCandidate = {
  provider: string;
  capability: string;
  label: string;
  description: string;
  estimatedCredits: number | null;
  termsRequired: boolean;
  discoveryOnly: true;
};

export type AlexandriaDiscoveryResult = {
  enabled: boolean;
  candidates: AlexandriaCandidate[];
  limitation: string | null;
};

export class SpecializedSourceGateError extends Error {
  code: string;
  constructor(code: string) {
    super("Specialized data source was not executed because a required safety condition was not met.");
    this.name = "SpecializedSourceGateError";
    this.code = code;
  }
}

function apiKey(): string {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new SpecializedSourceGateError("source_access_not_configured");
  return key;
}

function pickCandidates(payload: any): AlexandriaCandidate[] {
  const data = payload?.data ?? payload;
  const candidates = Array.isArray(data?.tools) ? data.tools
    : Array.isArray(data?.alexandria) ? data.alexandria
    : Array.isArray(data?.results) ? data.results
    : [];
  const out: AlexandriaCandidate[] = [];
  for (const item of candidates) {
    const row = item?.tool ?? item;
    const provider = String(row?.provider || "").trim();
    const capability = String(row?.capability || row?.name || "").trim();
    if (!provider || !capability) continue;
    const rawCost = row?.creditsCost ?? row?.credits ?? row?.costCredits ?? row?.price?.credits ?? row?.pricing?.credits;
    const cost = rawCost == null ? null : Number(rawCost);
    out.push({
      provider: provider.slice(0, 100),
      capability: capability.slice(0, 180),
      label: String(row?.label || row?.title || row?.description || capability).slice(0, 180),
      description: String(row?.description || row?.summary || "").slice(0, 600),
      estimatedCredits: cost != null && Number.isFinite(cost) && cost >= 0 ? cost : null,
      termsRequired: !!(row?.requiresTerms || row?.termsRequired || row?.requiresAction?.type === "accept_terms"),
      discoveryOnly: true,
    });
    if (out.length >= MAX_DISCOVERY_LIMIT) break;
  }
  return out;
}

/** Free catalogue discovery only; this function never calls a discovered provider capability. */
export async function discoverAlexandriaCapabilities(input: {
  query: string;
  limit?: number;
}): Promise<AlexandriaDiscoveryResult> {
  if (process.env.MAAROOF_ALEXANDRIA_ENABLED !== "true") {
    return { enabled: false, candidates: [], limitation: "specialized_source_not_enabled" };
  }
  const query = String(input.query || "").trim().slice(0, MAX_QUERY_LENGTH);
  if (query.length < 3) return { enabled: true, candidates: [], limitation: "query_too_short" };
  const limit = Math.max(1, Math.min(MAX_DISCOVERY_LIMIT, Math.floor(Number(input.limit) || 3)));
  try {
    const response = await fetch(API + "/search", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey() },
      body: JSON.stringify({
        query,
        sources: ["alexandria"],
        domainTools: true,
        toolDetail: "summary",
        includeCosts: true,
        limit,
      }),
    });
    if (!response.ok) {
      return {
        enabled: true,
        candidates: [],
        limitation: response.status === 403 ? "specialized_source_access_required"
          : response.status === 429 ? "specialized_discovery_rate_limited"
          : "specialized_discovery_unavailable",
      };
    }
    const body = await response.json();
    return { enabled: true, candidates: pickCandidates(body).slice(0, limit), limitation: null };
  } catch {
    return { enabled: true, candidates: [], limitation: "specialized_discovery_unavailable" };
  }
}

export type AlexandriaExecutionInput = {
  provider: string;
  capability: string;
  options: Record<string, unknown>;
  estimatedCredits: number | null;
  maxCredits: number;
  userConfirmedPaidRun: boolean;
  requestId: string;
  /** Must be set by secured admin configuration after accepting the exact required terms. */
  adminTermsAccepted: boolean;
  userId?: string | null;
  toolKey?: string | null;
};

/**
 * Run an explicitly selected capability. No code path accepts terms on behalf
 * of an organization. Callers must relay the result/error to the user honestly.
 */
export async function executeAlexandriaCapability(input: AlexandriaExecutionInput): Promise<{
  result: any;
  provenance: ReturnType<typeof normalizeSourceEvidence>;
  creditsCost: number | null;
}> {
  if (process.env.MAAROOF_ALEXANDRIA_ENABLED !== "true") throw new SpecializedSourceGateError("specialized_source_not_enabled");
  if (!input.provider.trim() || !input.capability.trim()) throw new SpecializedSourceGateError("capability_required");
  const gate = canExecuteSpecializedSource({
    discoveredCostCredits: input.estimatedCredits,
    maxCredits: input.maxCredits,
    userConfirmedPaidRun: input.userConfirmedPaidRun,
    adminTermsAccepted: input.adminTermsAccepted && process.env.MAAROOF_ALEXANDRIA_TERMS_ACCEPTED === "true",
    requestId: input.requestId,
  });
  if (!gate.allowed) throw new SpecializedSourceGateError(gate.reason || "specialized_source_blocked");

  const response = await fetch(API + "/scrape", {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey(),
      "x-request-id": input.requestId,
    },
    body: JSON.stringify({
      alexandria: {
        provider: input.provider,
        capability: input.capability,
        options: input.options || {},
      },
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    const code = String(body?.code || (response.status === 403 ? "specialized_source_access_required" : response.status === 429 ? "specialized_source_rate_limited" : "specialized_source_unavailable"));
    // Terms are a human action, never auto-accepted or retried with a new request id.
    throw new SpecializedSourceGateError(code.slice(0, 120));
  }
  const data = body?.data || {};
  const creditsCostRaw = data.creditsCost ?? body?.creditsCost;
  const creditsCost = creditsCostRaw == null ? null : Number(creditsCostRaw);
  if (creditsCost != null && Number.isFinite(creditsCost) && creditsCost > input.maxCredits) {
    // Provider call already happened; report the overrun explicitly rather than hiding it.
    throw new SpecializedSourceGateError("provider_cost_exceeded_declared_cap");
  }
  const provenance = normalizeSourceEvidence({
    provider: "specialized_catalogue",
    capability: input.capability,
    sourceRef: null,
    retrievedAt: new Date().toISOString(),
    locale: typeof input.options?.language === "string" ? input.options.language : null,
    realityKind: "observation",
    status: "success",
    sampleSize: Array.isArray(data.records) ? data.records.length : null,
    measurementUnit: "provider_result",
    limitation: creditsCost == null ? "actual_cost_not_returned" : null,
    sourceReliability: 60,
  });
  return { result: body, provenance, creditsCost: creditsCost != null && Number.isFinite(creditsCost) ? creditsCost : null };
}
