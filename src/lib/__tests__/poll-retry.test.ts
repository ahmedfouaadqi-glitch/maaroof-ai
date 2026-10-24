import { describe, it, expect } from "vitest";
import { shouldRetryPoll, pollBackoffMs } from "@/lib/maaroof/jobs";

describe("job watcher retry", () => {
  it("keeps watching on a network error", () => expect(shouldRetryPoll(null)).toBe(true));
  it("keeps watching while the sign-in token refreshes (401)", () => expect(shouldRetryPoll(401)).toBe(true));
  it("keeps watching on server errors", () => expect(shouldRetryPoll(503)).toBe(true));
  it("stops when the task is not found", () => expect(shouldRetryPoll(404)).toBe(false));
  it("backs off from 2s up to 10s", () => {
    expect(pollBackoffMs(1)).toBe(2000);
    expect(pollBackoffMs(3)).toBe(6000);
    expect(pollBackoffMs(20)).toBe(10000);
  });
});
