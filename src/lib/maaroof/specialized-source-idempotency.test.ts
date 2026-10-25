import { describe, it, expect } from "vitest";
import { decideSpecializedRunReplay } from "./alexandria.server";

describe("specialized source run idempotency", () => {
  it("allows a new reservation only when no prior request exists", () => {
    expect(decideSpecializedRunReplay(null, "candidate-123")).toEqual({ action: "reserve" });
  });

  it("replays a successful response without invoking or charging the source again", () => {
    const response = { ok: true, specialized_execution: { result_count: 3 } };
    expect(decideSpecializedRunReplay({
      candidate_id: "candidate-123", status: "succeeded", response,
    }, "candidate-123")).toEqual({ action: "replay", response });
  });

  it("blocks reuse of a request ID for a different candidate", () => {
    expect(decideSpecializedRunReplay({
      candidate_id: "candidate-a", status: "succeeded", response: { ok: true },
    }, "candidate-b")).toEqual({ action: "block", reason: "request_id_conflict", status: "succeeded" });
  });

  it("never re-executes uncertain, reserved, running or rejected requests", () => {
    for (const status of ["reserved", "running", "uncertain", "rejected"]) {
      expect(decideSpecializedRunReplay({ candidate_id: "candidate-123", status }, "candidate-123"))
        .toEqual({ action: "block", reason: "request_already_processed", status });
    }
  });
});
