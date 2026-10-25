import { describe, it, expect } from "vitest";
import { createSeqCounter, isStaleJob, isTerminalJobStatus, parseAfter, JOB_STALE_MS } from "@/lib/maaroof/jobs";

describe("workspace jobs", () => {
  it("never widens workspace-scoped reads into owner-wide history after an error", async () => {
    const { shouldFallbackFromWorkspaceScope } = await import("@/lib/maaroof/jobs");
    expect(shouldFallbackFromWorkspaceScope({ code: "42703", message: 'column "workspace_id" does not exist' })).toBe(false);
    expect(shouldFallbackFromWorkspaceScope({ code: "PGRST116", message: "query failed" })).toBe(false);
    expect(shouldFallbackFromWorkspaceScope(null)).toBe(false);
  });
  it("recognizes missing workspace_id for legacy inserts only", async () => {
    const { isMissingWorkspaceIdColumn } = await import("@/lib/maaroof/jobs");
    expect(isMissingWorkspaceIdColumn({ code: "42703", message: 'column "workspace_id" does not exist' })).toBe(true);
    expect(isMissingWorkspaceIdColumn({ code: "PGRST204", message: "Could not find the workspace_id column in schema cache" })).toBe(true);
    expect(isMissingWorkspaceIdColumn({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe(false);
  });
  it("numbers events sequentially from 1", () => {
    const n = createSeqCounter();
    expect([n(), n(), n()]).toEqual([1, 2, 3]);
  });
  it("terminal statuses", () => {
    expect(isTerminalJobStatus("cancelled")).toBe(true);
    expect(isTerminalJobStatus("running")).toBe(false);
  });
  it("running job idle over 10 minutes is stale; finished never", () => {
    const now = Date.now();
    const old = new Date(now - JOB_STALE_MS - 1000).toISOString();
    expect(isStaleJob({ status: "running", updated_at: old }, now)).toBe(true);
    expect(isStaleJob({ status: "completed", updated_at: old }, now)).toBe(false);
    expect(isStaleJob({ status: "running", updated_at: new Date(now).toISOString() }, now)).toBe(false);
  });
  it("parses after cursor safely", () => {
    expect(parseAfter("7")).toBe(7);
    expect(parseAfter("-3")).toBe(0);
    expect(parseAfter(null)).toBe(0);
  });
  it("deep audit idle over 30s is stuck", async () => {
    const { isStaleAuditJob } = await import("@/lib/maaroof/jobs");
    const now = Date.now();
    expect(isStaleAuditJob({ status: "running", updated_at: new Date(now - 31_000).toISOString() }, now)).toBe(true);
    expect(isStaleAuditJob({ status: "running", updated_at: new Date(now - 10_000).toISOString() }, now)).toBe(false);
    expect(isStaleAuditJob({ status: "failed", updated_at: new Date(now - 99_000).toISOString() }, now)).toBe(false);
  });
});

describe("agent watchdog", () => {
  it("agent job with no heartbeat for over 3 minutes is stuck", async () => {
    const { isStaleAgentJob } = await import("@/lib/maaroof/jobs");
    const now = Date.now();
    expect(isStaleAgentJob({ status: "running", updated_at: new Date(now - 601_000).toISOString() }, now)).toBe(true);
    expect(isStaleAgentJob({ status: "running", updated_at: new Date(now - 300_000).toISOString() }, now)).toBe(false);
    expect(isStaleAgentJob({ status: "completed", updated_at: new Date(now - 99_000).toISOString() }, now)).toBe(false);
  });
});

describe("auto resume", () => {
  it("allows one free resume only for a watchdog-stopped job", async () => {
    const { canAutoResume, AGENT_STUCK_MSG } = await import("@/lib/maaroof/jobs");
    const j = { status: "failed", error: AGENT_STUCK_MSG, request_payload: {} };
    expect(canAutoResume(j)).toBe(true);
    expect(canAutoResume({ ...j, request_payload: { auto_resume_job_id: "pending" } })).toBe(false);
    expect(canAutoResume({ ...j, request_payload: { auto_resume_job_id: "pending" } }, true)).toBe(true);
    expect(canAutoResume({ ...j, request_payload: { auto_resumed: true } })).toBe(false);
    expect(canAutoResume({ ...j, error: "other" })).toBe(false);
  });
});
