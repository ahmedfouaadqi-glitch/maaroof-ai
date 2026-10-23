import { describe, it, expect } from "vitest";
import { scrapeOrder, searchOrder, FETCH_TIMEOUT_MS, isLinkedIn } from "../fetch-order";

const both = { firecrawl: true, apidirect: true };
describe("fetch order", () => {
  it("linkedin goes to API Direct first, then Firecrawl", () => {
    expect(isLinkedIn("linkedin.com/in/x")).toBe(true);
    expect(scrapeOrder("https://www.linkedin.com/in/x", both)).toEqual(["linkedin_direct", "firecrawl"]);
  });
  it("public pages: Firecrawl then direct read", () => {
    expect(scrapeOrder("maaroofai.com", both)).toEqual(["firecrawl", "direct_http"]);
    expect(scrapeOrder("maaroofai.com", { firecrawl: false, apidirect: true })).toEqual(["direct_http"]);
  });
  it("search: Firecrawl then API Direct; none -> empty (no charge path)", () => {
    expect(searchOrder(both)).toEqual(["firecrawl", "apidirect"]);
    expect(searchOrder({ firecrawl: false, apidirect: false })).toEqual([]);
  });
  it("each attempt times out at 15 seconds", () => {
    expect(FETCH_TIMEOUT_MS).toBe(15000);
  });
});
