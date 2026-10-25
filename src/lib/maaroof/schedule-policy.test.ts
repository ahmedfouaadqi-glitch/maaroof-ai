import { describe, it, expect } from "vitest";
import { nextCronRunDate, parseCronExpression, validateSchedulePolicy } from "./schedule-policy";

describe("schedule safety policy", () => {
  it("rejects malformed or unsupported cron expressions instead of silently scheduling hourly", () => {
    expect(parseCronExpression("not cron")).toBeNull();
    expect(parseCronExpression("0 25 * * *")).toBeNull();
    expect(nextCronRunDate("not cron", new Date("2026-10-26T08:00:00Z"))).toBeNull();
  });

  it("computes the next custom cron run in UTC", () => {
    expect(nextCronRunDate("0 9 * * 1-5", new Date("2026-10-26T08:45:00Z"))?.toISOString())
      .toBe("2026-10-26T09:00:00.000Z");
    expect(nextCronRunDate("*/15 * * * *", new Date("2026-10-26T08:07:30Z"))?.toISOString())
      .toBe("2026-10-26T08:15:00.000Z");
  });

  it("fails closed if a workspace is not owned or a forced tool is not executable", () => {
    const base = {
      cadence: "daily", approvalMode: "per_run", maxRuns: 1,
      forceTools: ["research"], allowedTools: ["research"], workspaceOwned: true,
    };
    expect(validateSchedulePolicy({ ...base, workspaceOwned: false }).errors).toContain("workspace_not_owned");
    expect(validateSchedulePolicy({ ...base, forceTools: ["unknown_tool"] }).errors).toContain("force_tool_not_executable");
  });

  it("requires a bounded run count for unattended approval modes", () => {
    expect(validateSchedulePolicy({
      cadence: "daily", approvalMode: "auto_within_quota", maxRuns: 0,
      forceTools: [], allowedTools: [], workspaceOwned: true,
    }).errors).toContain("automatic_schedule_requires_finite_max_runs");
  });

  it("validates cron and accepts bounded per-run schedules", () => {
    expect(validateSchedulePolicy({
      cadence: "custom_cron", cronExpression: "0 9 * * 1-5", approvalMode: "per_run",
      maxRuns: 1, forceTools: ["research"], allowedTools: ["research"], workspaceOwned: true,
    }).valid).toBe(true);
  });
});
