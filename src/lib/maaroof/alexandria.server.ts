import { createHash } from "node:crypto";
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
  candidateId: string;
  optionsSchema: Record<string, any> | null;
  responseSchema: Record<string, any> | null;
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

/** Organization admins maintain this semicolon-separated allow-list outside code deployment.
 * Entries must be exact provider names or exact provider/capability pairs from the discovered contract.
 */
export function isAlexandriaTermsAccepted(provider: string, capability: string): boolean {
  const entries = String(process.env.MAAROOF_ALEXANDRIA_TERMS_ACCEPTED || "")
    .split(";").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return entries.includes(provider.trim().toLowerCase()) ||
    entries.includes((provider.trim() + "/" + capability.trim()).toLowerCase());
}

export function normalizeAlexandriaCandidates(payload: any): AlexandriaCandidate[] {
  const roots = [payload?.data ?? payload, payload].filter(Boolean);
  const candidates: any[] = [];
  const visit = (value: any) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (Array.isArray(value.tools)) candidates.push(...value.tools);
    if (Array.isArray(value.results)) candidates.push(...value.results);
    // Search API/SDK variants may wrap Alexandria candidates under one or more data records.
    if (Array.isArray(value.alexandria)) visit(value.alexandria);
    if (value.data && typeof value.data === "object") visit(value.data);
    if (value.tool && typeof value.tool === "object") candidates.push(value.tool);
  };
  roots.forEach(visit);
  const out: AlexandriaCandidate[] = [];
  const seen = new Set<string>();
  for (const item of candidates) {
    const row = item?.tool ?? item;
    const provider = String(row?.provider || "").trim();
    const capability = String(row?.capability || row?.name || "").trim();
    if (!provider || !capability) continue;
    const identity = provider + "|" + capability;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const rawCost = row?.creditsCost ?? row?.credits_cost ?? row?.credits ?? row?.costCredits ?? row?.price?.credits ?? row?.pricing?.credits;
    const cost = rawCost == null ? null : Number(rawCost);
    const estimatedCredits = cost != null && Number.isFinite(cost) && cost >= 0 ? cost : null;
    const optionsSchema = row?.optionsSchema ?? row?.options_schema ?? row?.options ?? row?.inputSchema ?? row?.input_schema ?? row?.parameters;
    const responseSchema = row?.responseSchema ?? row?.response_schema ?? row?.response;
    const candidateId = createHash("sha256").update(identity).digest("hex").slice(0, 24);
    out.push({
      provider: provider.slice(0, 100),
      capability: capability.slice(0, 180),
      label: String(row?.label || row?.title || row?.description || capability).slice(0, 180),
      description: String(row?.description || row?.summary || "").slice(0, 600),
      estimatedCredits,
      termsRequired: !!(row?.requiresTerms || row?.termsRequired || row?.requiresAction?.type === "accept_terms"),
      discoveryOnly: true,
      candidateId,
      optionsSchema: optionsSchema && typeof optionsSchema === "object" ? optionsSchema as Record<string, any> : null,
      responseSchema: responseSchema && typeof responseSchema === "object" ? responseSchema as Record<string, any> : null,
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
        toolDetail: "full",
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
    return { enabled: true, candidates: normalizeAlexandriaCandidates(body).slice(0, limit), limitation: null };
  } catch {
    return { enabled: true, candidates: [], limitation: "specialized_discovery_unavailable" };
  }
}

export type SpecializedRunReplayDecision =
  | { action: "reserve" }
  | { action: "replay"; response: Record<string, any> }
  | { action: "block"; reason: "request_id_conflict" | "request_already_processed"; status: string };

/** Prevent a reused request ID from charging or invoking a provider twice. */
export function decideSpecializedRunReplay(existing: {
  candidate_id?: string | null;
  status?: string | null;
  response?: unknown;
} | null, candidateId: string): SpecializedRunReplayDecision {
  if (!existing) return { action: "reserve" };
  if (String(existing.candidate_id || "") !== candidateId) {
    return { action: "block", reason: "request_id_conflict", status: String(existing.status || "unknown") };
  }
  if (existing.status === "succeeded" && existing.response && typeof existing.response === "object" && !Array.isArray(existing.response)) {
    return { action: "replay", response: existing.response as Record<string, any> };
  }
  return { action: "block", reason: "request_already_processed", status: String(existing.status || "unknown") };
}

export type AlexandriaResponseNormalization = {
  data: any;
  creditsCost: number | null;
  errorCode: string | null;
};

/** Normalize the v2 /scrape response, where the selected capability is nested under data.alexandria. */
export function normalizeAlexandriaExecutionResponse(
  body: any,
  provider: string,
  capability: string,
): AlexandriaResponseNormalization {
  if (!body || typeof body !== "object") return { data: null, creditsCost: null, errorCode: "specialized_source_invalid_response" };
  const envelope = body.data ?? body;
  const calls: any[] = Array.isArray(envelope?.alexandria)
    ? envelope.alexandria
    : Array.isArray(body?.alexandria) ? body.alexandria : [];
  let selected: any = null;
  if (calls.length) {
    selected = calls.find((item) =>
      String(item?.provider || "").toLowerCase() === provider.toLowerCase() &&
      String(item?.capability || "").toLowerCase() === capability.toLowerCase()
    ) || (calls.length === 1 ? calls[0] : null);
    if (!selected) return { data: null, creditsCost: null, errorCode: "specialized_source_response_mismatch" };
    if (selected.error || selected.success === false) {
      const rawCode = String(selected.error?.code || selected.code || "specialized_source_unavailable").toLowerCase();
      const code = rawCode.includes("term") ? "specialized_source_terms_not_accepted"
        : rawCode.includes("rate") || rawCode.includes("429") ? "specialized_source_rate_limited"
        : rawCode.includes("access") || rawCode.includes("403") ? "specialized_source_access_required"
        : rawCode.includes("cost") || rawCode.includes("budget") ? "provider_cost_exceeded_declared_cap"
        : "specialized_source_unavailable";
      return { data: null, creditsCost: null, errorCode: code };
    }
  }
  const result = selected?.data ?? selected?.records ?? (calls.length ? selected : envelope);
  const rawCost = selected?.creditsCost ?? selected?.credits_cost ?? selected?.costCredits ??
    envelope?.creditsCost ?? envelope?.credits_cost ?? body?.creditsCost ?? body?.credits_cost;
  const cost = rawCost == null ? null : Number(rawCost);
  return {
    data: result,
    creditsCost: cost != null && Number.isFinite(cost) && cost >= 0 ? cost : null,
    errorCode: null,
  };
}

export type AlexandriaOptionValidation = { valid: boolean; errors: string[] };

/** Strict, bounded validation against the discovered tool's JSON Schema contract. Unknown contracts fail closed. */
export function validateAlexandriaOptions(schema: Record<string, any> | null, value: unknown): AlexandriaOptionValidation {
  const errors: string[] = [];
  if (!schema || typeof schema !== "object" || schema.type !== "object" || !schema.properties || typeof schema.properties !== "object") {
    return { valid: false, errors: ["options_schema_unavailable"] };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, errors: ["options_must_be_object"] };
  const options = value as Record<string, unknown>;
  const properties = schema.properties as Record<string, any>;
  const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
  if (Object.keys(options).length > 40) errors.push("too_many_options");
  for (const key of required) {
    if (!(key in options) || options[key] == null || options[key] === "") errors.push("required:" + key);
  }
  for (const [key, item] of Object.entries(options)) {
    const rule = properties[key];
    if (!rule) {
      if (schema.additionalProperties !== true) errors.push("unknown_option:" + key);
      continue;
    }
    if (typeof item === "string" && item.length > 10000) { errors.push("string_too_long:" + key); continue; }
    if (Array.isArray(item) && item.length > 100) { errors.push("array_too_long:" + key); continue; }
    const type = rule?.type;
    const typeOkay =
      !type ||
      (type === "string" && typeof item === "string") ||
      (type === "number" && typeof item === "number" && Number.isFinite(item)) ||
      (type === "integer" && typeof item === "number" && Number.isInteger(item)) ||
      (type === "boolean" && typeof item === "boolean") ||
      (type === "array" && Array.isArray(item)) ||
      (type === "object" && !!item && typeof item === "object" && !Array.isArray(item));
    if (!typeOkay) { errors.push("wrong_type:" + key); continue; }
    if (Array.isArray(rule.enum) && !rule.enum.some((v: unknown) => Object.is(v, item))) errors.push("invalid_enum:" + key);
    if (typeof item === "number") {
      if (Number.isFinite(rule.minimum) && item < rule.minimum) errors.push("below_minimum:" + key);
      if (Number.isFinite(rule.maximum) && item > rule.maximum) errors.push("above_maximum:" + key);
    }
    if (typeof item === "string") {
      if (Number.isFinite(rule.minLength) && item.length < rule.minLength) errors.push("below_min_length:" + key);
      if (Number.isFinite(rule.maxLength) && item.length > rule.maxLength) errors.push("above_max_length:" + key);
    }
    if (Array.isArray(item)) {
      if (Number.isFinite(rule.minItems) && item.length < rule.minItems) errors.push("below_min_items:" + key);
      if (Number.isFinite(rule.maxItems) && item.length > rule.maxItems) errors.push("above_max_items:" + key);
    }
  }
  return { valid: errors.length === 0, errors: errors.slice(0, 40) };
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
  budgetOverrunDetected: boolean;
}> {
  if (process.env.MAAROOF_ALEXANDRIA_ENABLED !== "true") throw new SpecializedSourceGateError("specialized_source_not_enabled");
  if (!input.provider.trim() || !input.capability.trim()) throw new SpecializedSourceGateError("capability_required");
  const gate = canExecuteSpecializedSource({
    discoveredCostCredits: input.estimatedCredits,
    maxCredits: input.maxCredits,
    userConfirmedPaidRun: input.userConfirmedPaidRun,
    adminTermsAccepted: input.adminTermsAccepted && isAlexandriaTermsAccepted(input.provider, input.capability),
    requestId: input.requestId,
  });
  if (!gate.allowed) throw new SpecializedSourceGateError(gate.reason || "specialized_source_blocked");

  const response = await fetch(API + "/scrape", {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey(),
    },
    body: JSON.stringify({
      requestId: input.requestId,
      alexandria: {
        provider: input.provider,
        capability: input.capability,
        options: input.options || {},
      },
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    const rawCode = String(body?.code || (response.status === 403 ? "specialized_source_access_required" : response.status === 429 ? "specialized_source_rate_limited" : "specialized_source_unavailable")).toLowerCase();
    const code = rawCode.includes("term") ? "specialized_source_terms_not_accepted"
      : rawCode.includes("rate") || response.status === 429 ? "specialized_source_rate_limited"
      : rawCode.includes("access") || response.status === 403 ? "specialized_source_access_required"
      : "specialized_source_unavailable";
    throw new SpecializedSourceGateError(code);
  }
  const normalized = normalizeAlexandriaExecutionResponse(body, input.provider, input.capability);
  if (normalized.errorCode) throw new SpecializedSourceGateError(normalized.errorCode);
  const data = normalized.data;
  const creditsCost = normalized.creditsCost;
  // The preflight quote gates execution. If the provider reports a higher final bill,
  // preserve that fact in the returned record rather than throwing away an already-billed result.
  const budgetOverrunDetected = creditsCost != null && Number.isFinite(creditsCost) && creditsCost > input.maxCredits;
  const provenance = normalizeSourceEvidence({
    provider: "specialized_catalogue",
    capability: input.capability,
    sourceRef: null,
    retrievedAt: new Date().toISOString(),
    locale: typeof input.options?.language === "string" ? input.options.language : null,
    realityKind: "observation",
    status: "success",
    sampleSize: Array.isArray(data?.records) ? data.records.length
      : Array.isArray(data?.results) ? data.results.length
      : Array.isArray(data?.items) ? data.items.length : null,
    measurementUnit: "provider_result",
    limitation: creditsCost == null ? "actual_cost_not_returned" : budgetOverrunDetected ? "provider_reported_cost_exceeded_declared_cap" : null,
    sourceReliability: 60,
  });
  return {
    result: data,
    provenance,
    creditsCost: creditsCost != null && Number.isFinite(creditsCost) ? creditsCost : null,
    budgetOverrunDetected,
  };
}
