import { describe, expect, it } from "vitest";
import { filterReports, latestReportVersions, type ReportCenterItem } from "./reports-center";

const rows: ReportCenterItem[] = [
  { reportId: "r1", workspaceId: "client-1", title: "Client v1", kind: "client", status: "Released", version: 1, createdAt: "2026-11-01", updatedAt: "2026-11-02" },
  { reportId: "r1", workspaceId: "client-1", title: "Client v2", kind: "client", status: "Approved", version: 2, createdAt: "2026-11-03", updatedAt: "2026-11-04" },
  { reportId: "r2", workspaceId: "client-2", title: "Other client", kind: "technical", status: "Draft", version: 1, createdAt: "2026-11-05", updatedAt: "2026-11-06" },
  { reportId: "r3", workspaceId: null, title: "Main report", kind: "client", status: "Generated", version: 1, createdAt: "2026-11-07", updatedAt: "2026-11-08" },
];

describe("reports center selectors", () => {
  it("filters by exact workspace, status and kind", () => {
    expect(filterReports(rows, { workspaceId: "client-1", status: "Approved", kind: "client" }).map((r) => r.title)).toEqual(["Client v2"]);
    expect(filterReports(rows, { workspaceId: "client-2" }).map((r) => r.title)).toEqual(["Other client"]);
  });

  it("keeps main-account reports separate from client workspaces", () => {
    expect(filterReports(rows, { workspaceId: null }).map((r) => r.title)).toEqual(["Main report"]);
  });

  it("selects the highest version per report within each workspace", () => {
    const latest = latestReportVersions(rows);
    expect(latest.find((r) => r.reportId === "r1" && r.workspaceId === "client-1")?.version).toBe(2);
    expect(latest).toHaveLength(3);
  });
});
