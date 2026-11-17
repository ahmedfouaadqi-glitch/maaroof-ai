import type { ReportKind, ReportStatus } from "./report-approval";

export type ReportCenterItem = {
  reportId: string;
  workspaceId: string | null;
  title: string;
  kind: ReportKind;
  status: ReportStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ReportCenterFilter = {
  workspaceId: string | null;
  status?: ReportStatus | "all";
  kind?: ReportKind | "all";
};

export function filterReports(items: ReportCenterItem[], filter: ReportCenterFilter): ReportCenterItem[] {
  return items
    .filter((item) => item.workspaceId === filter.workspaceId)
    .filter((item) => !filter.status || filter.status === "all" || item.status === filter.status)
    .filter((item) => !filter.kind || filter.kind === "all" || item.kind === filter.kind)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function latestReportVersions(items: ReportCenterItem[]): ReportCenterItem[] {
  const latest = new Map<string, ReportCenterItem>();
  for (const item of items) {
    const key = item.workspaceId + ":" + item.reportId;
    const current = latest.get(key);
    if (!current || item.version > current.version) latest.set(key, item);
  }
  return Array.from(latest.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
