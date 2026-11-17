import { describe, expect, it } from "vitest";
import { jobPageWindow, splitPage } from "./job-pagination";

describe("job pagination", () => {
  it("uses a stable first-page default and caps page size", () => {
    expect(jobPageWindow(null, null)).toEqual({ page: 0, pageSize: 1000, from: 0, to: 1000 });
    expect(jobPageWindow(2, 5000)).toEqual({ page: 2, pageSize: 1000, from: 2000, to: 3000 });
  });

  it("normalizes invalid and negative page inputs", () => {
    expect(jobPageWindow(-3, 0)).toEqual({ page: 0, pageSize: 1, from: 0, to: 1 });
  });

  it("detects and removes the look-ahead row", () => {
    expect(splitPage([1, 2, 3], 2)).toEqual({ items: [1, 2], hasMore: true });
    expect(splitPage([1, 2], 2)).toEqual({ items: [1, 2], hasMore: false });
  });
});
