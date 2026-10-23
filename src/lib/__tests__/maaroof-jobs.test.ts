import { describe, it, expect } from "vitest";
import { createSeqCounter, isStaleJob, isTerminalJobStatus, parseAfter, JOB_STALE_MS } from "@/lib/maaroof/jobs";

describe("workspace jobs", () => {
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
  it("agent job with no heartbeat for over 60s is stuck", async () => {
    const { isStaleAgentJob } = await import("@/lib/maaroof/jobs");
    const now = Date.now();
    expect(isStaleAgentJob({ status: "running", updated_at: new Date(now - 61_000).toISOString() }, now)).toBe(true);
    expect(isStaleAgentJob({ status: "running", updated_at: new Date(now - 20_000).toISOString() }, now)).toBe(false);
    expect(isStaleAgentJob({ status: "completed", updated_at: new Date(now - 99_000).toISOString() }, now)).toBe(false);
  });
});
