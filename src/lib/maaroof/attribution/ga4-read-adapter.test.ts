import { describe, expect, it, vi } from "vitest";
import { readGa4AttributionReport } from "./ga4-read-adapter";

function response(rows: unknown[], rowCount = rows.length, currencyCode = "USD") {
  return new Response(JSON.stringify({
    rows,
    rowCount,
    metadata: { currencyCode },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

const ga4Row = (source: string) => ({
  dimensionValues: [
    { value: source },
    { value: "referral" },
    { value: "(not set)" },
    { value: "https://chatgpt.com/" },
    { value: "/landing" },
  ],
  metricValues: [{ value: "5" }, { value: "1" }, { value: "10.00" }],
});

describe("readGa4AttributionReport", () => {
  it("reads a GA4 report with read-only runReport requests and maps aggregate rows", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response([ga4Row("chatgpt.com")]));
    const result = await readGa4AttributionReport({
      propertyId: "123456789",
      accessToken: "short-lived-test-token",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/properties/123456789:runReport");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer short-lived-test-token");
    expect(result.rows[0].sessionSource).toBe("chatgpt.com");
    expect(result.currencyCode).toBe("USD");
  });

  it("paginates until all reported rows have been read", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response([ga4Row("chatgpt.com")], 2))
      .mockResolvedValueOnce(response([ga4Row("perplexity.ai")], 2));

    const result = await readGa4AttributionReport({
      propertyId: "123456789",
      accessToken: "token",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      pageSize: 1,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.rows).toHaveLength(2);
    const secondBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(secondBody.offset).toBe("1");
  });

  it("reports truncation when the configured page limit is reached", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response([ga4Row("chatgpt.com"), ga4Row("perplexity.ai")], 4));
    const result = await readGa4AttributionReport({
      propertyId: "123456789",
      accessToken: "token",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      pageSize: 2,
      maxPages: 1,
      fetchImpl,
    });
    expect(result.warnings.some((warning) => warning.includes("pagination limit"))).toBe(true);
  });

  it("does not report pagination truncation when a returned row is malformed", async () => {
    const malformed = { dimensionValues: [], metricValues: [] };
    const fetchImpl = vi.fn().mockResolvedValue(response([malformed], 1));
    const result = await readGa4AttributionReport({
      propertyId: "123456789",
      accessToken: "token",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      fetchImpl,
    });
    expect(result.rows).toHaveLength(0);
    expect(result.warnings.some((warning) => warning.includes("pagination limit"))).toBe(false);
    expect(result.warnings.some((warning) => warning.includes("row did not match"))).toBe(true);
  });

  it("rejects invalid property IDs and date ranges before making a request", async () => {
    const fetchImpl = vi.fn();
    await expect(readGa4AttributionReport({
      propertyId: "properties/123",
      accessToken: "token",
      startDate: "2026-01-31",
      endDate: "2026-01-01",
      fetchImpl,
    })).rejects.toThrow("invalid_ga4_property_id");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces provider errors without silently returning an empty report", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("permission denied", { status: 403 }));
    await expect(readGa4AttributionReport({
      propertyId: "123456789",
      accessToken: "token",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      fetchImpl,
    })).rejects.toThrow("ga4_api_error:403");
  });
});
