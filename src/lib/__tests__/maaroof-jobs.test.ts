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
});
