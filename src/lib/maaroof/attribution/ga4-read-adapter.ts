import {
  mapGa4ReportRow,
  type Ga4ReportRow,
  type Ga4RowMapping,
} from "./adapters";

const GA4_DIMENSIONS = [
  "sessionSource",
  "sessionMedium",
  "sessionCampaignName",
  "pageReferrer",
  "landingPagePlusQueryString",
] as const;

const GA4_METRICS = ["sessions", "keyEvents", "totalRevenue"] as const;

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type Ga4ApiResponse = {
  rows?: Ga4ReportRow[];
  rowCount?: number;
  metadata?: { currencyCode?: string };
  propertyQuota?: unknown;
};

export type Ga4ReadReportInput = {
  propertyId: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  fetchImpl: FetchLike;
  pageSize?: number;
  maxPages?: number;
};

export type Ga4ReadReportResult = {
  rows: Ga4RowMapping[];
  currencyCode?: string;
  warnings: string[];
};

/**
 * Read-only GA4 Data API adapter.
 *
 * OAuth token acquisition/refresh and secure credential storage are deliberately
 * outside this module. The caller supplies a short-lived access token and a
 * fetch implementation, which also makes the adapter deterministic in tests.
 */
function isValidDate(value: string): boolean {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export async function readGa4AttributionReport(
  input: Ga4ReadReportInput,
): Promise<Ga4ReadReportResult> {
  if (!isValidDate(input.startDate) || !isValidDate(input.endDate)) {
    throw new Error("ga4_dates_must_be_yyyy_mm_dd");
  }
  if (input.startDate > input.endDate) throw new Error("ga4_start_date_after_end_date");

  const requestedPageSize = Number.isFinite(input.pageSize) ? Math.floor(input.pageSize as number) : 10000;
  const requestedMaxPages = Number.isFinite(input.maxPages) ? Math.floor(input.maxPages as number) : 10;
  const pageSize = Math.min(100000, Math.max(1, requestedPageSize));
  const maxPages = Math.min(100, Math.max(1, requestedMaxPages));
  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${input.propertyId}:runReport`;
  const rows: NonNullable<ReturnType<typeof mapGa4ReportRow>>[] = [];
  const warnings: string[] = [];
  let currencyCode: string | undefined;
  let offset = 0;
  let expectedRowCount: number | undefined;
  let page = 0;

  while (page < maxPages) {
    const response = await input.fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
        dimensions: GA4_DIMENSIONS.map((name) => ({ name })),
        metrics: GA4_METRICS.map((name) => ({ name })),
        limit: String(pageSize),
        offset: String(offset),
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1000);
      throw new Error(`ga4_api_error:${response.status}:${detail}`);
    }

    const payload = await response.json() as Ga4ApiResponse;
    const rawRows = Array.isArray(payload.rows) ? payload.rows : [];
    if (typeof payload.rowCount === "number" && Number.isFinite(payload.rowCount)) {
      expectedRowCount = payload.rowCount;
    }
    if (payload.metadata?.currencyCode) currencyCode = payload.metadata.currencyCode;

    for (const rawRow of rawRows) {
      const mapped = mapGa4ReportRow(rawRow);
      if (mapped) rows.push(mapped);
      else warnings.push("A GA4 row did not match the expected dimensions/metrics shape and was skipped.");
    }

    offset += rawRows.length;
    page += 1;
    if (rawRows.length === 0 || rawRows.length < pageSize) break;
    if (expectedRowCount !== undefined && offset >= expectedRowCount) break;
  }

  if (expectedRowCount !== undefined && rows.length < expectedRowCount) {
    warnings.push("The configured pagination limit was reached before all GA4 rows were read.");
  } else if (page === maxPages && expectedRowCount === undefined) {
    warnings.push("The configured pagination limit was reached; GA4 did not provide a row count.");
  }

  return { rows, currencyCode, warnings };
}
