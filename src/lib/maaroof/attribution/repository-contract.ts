import { z } from "zod";
import { validateAttributionEvent, type AttributionEvent } from "./domain";
import type { ConversionInput } from "./adapters";

/**
 * Persistence boundary only. This module intentionally contains no database
 * client or implementation. Every repository operation requires an explicit
 * actor + workspace scope; adapters must enforce ownership before persistence.
 */

export const AttributionWorkspaceScopeSchema = z.object({
  actorUserId: z.string().uuid(),
  workspaceId: z.string().uuid(),
}).strict();
export type AttributionWorkspaceScope = z.infer<typeof AttributionWorkspaceScopeSchema>;

export type WorkspaceScopeValidation =
  | { success: true; scope: AttributionWorkspaceScope; events: AttributionEvent[] }
  | { success: false; issues: string[] };

/** Prevents null, cross-workspace or malformed events from entering a tenant write. */
export function validateWorkspaceEventBatch(
  scopeInput: unknown,
  eventsInput: unknown[],
): WorkspaceScopeValidation {
  const scopeParsed = AttributionWorkspaceScopeSchema.safeParse(scopeInput);
  if (!scopeParsed.success) {
    return {
      success: false,
      issues: scopeParsed.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message),
    };
  }

  const issues: string[] = [];
  const events: AttributionEvent[] = [];
  for (let index = 0; index < eventsInput.length; index += 1) {
    const event = eventsInput[index];
    if (!event || typeof event !== "object" || (event as any).workspaceId !== scopeParsed.data.workspaceId) {
      issues.push(`events[${index}].workspaceId: workspace_scope_mismatch`);
      continue;
    }
    const parsed = validateAttributionEvent(event);
    if (!parsed.success) {
      issues.push(...parsed.error.issues.map((issue) => `events[${index}].${issue.path.join(".")}: ${issue.message}`));
      continue;
    }
    if (parsed.data.consent !== "granted") {
      issues.push(`events[${index}].consent: consent_not_granted`);
      continue;
    }
    events.push(parsed.data as AttributionEvent);
  }

  return issues.length
    ? { success: false, issues }
    : { success: true, scope: scopeParsed.data, events };
}

export const AttributionRetentionPolicySchema = z.object({
  eventRetentionDays: z.number().int().positive(),
  conversionRetentionDays: z.number().int().positive(),
  deleteOnConsentRevoked: z.boolean(),
}).strict();
export type AttributionRetentionPolicy = z.infer<typeof AttributionRetentionPolicySchema>;

export type ScopedPage<T> = {
  records: T[];
  nextCursor: string | null;
};

export type AttributionEventQuery = {
  from: string;
  to: string;
  limit: number;
  cursor?: string | null;
};

/**
 * Database implementations must:
 * - re-check actor ownership server-side for every method;
 * - apply workspace_id predicates to every read, write and delete;
 * - enforce provider + external event ID uniqueness;
 * - persist only events with granted consent;
 * - apply retention and consent-revocation deletion policy;
 * - never expose a cross-workspace query method.
 */
export interface AttributionRepository {
  appendEvents(
    scope: AttributionWorkspaceScope,
    events: AttributionEvent[],
  ): Promise<{ inserted: number; duplicates: number }>;

  listEvents(
    scope: AttributionWorkspaceScope,
    query: AttributionEventQuery,
  ): Promise<ScopedPage<AttributionEvent>>;

  upsertConversions(
    scope: AttributionWorkspaceScope,
    conversions: ConversionInput[],
  ): Promise<{ inserted: number; updated: number; duplicates: number }>;

  deleteExpiredEvents(
    scope: AttributionWorkspaceScope,
    olderThan: string,
  ): Promise<{ deleted: number }>;

  deleteExpiredConversions(
    scope: AttributionWorkspaceScope,
    olderThan: string,
  ): Promise<{ deleted: number }>;

  deleteWorkspaceData(
    scope: AttributionWorkspaceScope,
  ): Promise<{ deletedEvents: number; deletedConversions: number }>;
}

/** Authorization is deliberately a separate port from persistence. */
export interface AttributionWorkspaceAuthorizer {
  assertWorkspaceAccess(scope: AttributionWorkspaceScope): Promise<void>;
}
