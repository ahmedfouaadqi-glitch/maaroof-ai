import { describe, expect, it } from "vitest";
import {
  STATE_RANK,
  VERIFICATION_STATES,
  fromRealityState,
  fromTaskStatus,
  fromVerdict,
  rollupTasks,
  stateLabel,
  verificationGate,
} from "@/lib/maaroof/truth";

describe("truth labels", () => {
  it("never claims a stronger state than the evidence allows", () => {
    expect(fromVerdict("verified", { independentSources: 1 })).toBe("MEASURED");
    expect(fromVerdict("verified", { independentSources: 3, contradictions: 0 })).toBe("VERIFIED");
    expect(fromVerdict("verified", { independentSources: 3, contradictions: 2 })).toBe("MEASURED");
    expect(fromVerdict("contested")).toBe("ASSUMED");
    expect(fromVerdict("unverified")).toBe("ASSUMED");
    expect(fromVerdict("nonsense")).toBe("UNKNOWN");
  });

  it("maps reality states onto production labels", () => {
    expect(fromRealityState("simulation")).toBe("SIMULATED");
    expect(fromRealityState("hypothesis")).toBe("ASSUMED");
    expect(fromRealityState("measured")).toBe("MEASURED");
    expect(fromRealityState(undefined)).toBe("UNKNOWN");
  });

  it("labels tasks honestly: simulation is never execution", () => {
    expect(fromTaskStatus("simulated")).toBe("SIMULATED");
    expect(fromTaskStatus("done")).toBe("EXECUTED");
    expect(fromTaskStatus("done", { visits: 3 })).toBe("MEASURED");
    expect(fromTaskStatus("failed")).toBe("FAILED");
    expect(fromTaskStatus("running")).toBe("PENDING");
  });

  it("rolls up partial success without over-claiming", () => {
    expect(rollupTasks([]).verdict).toBe("PENDING");
    expect(rollupTasks([{ status: "simulated" }, { status: "simulated" }]).verdict).toBe("SIMULATED");
    expect(rollupTasks([{ status: "done" }, { status: "done" }]).verdict).toBe("COMPLETED");
    expect(rollupTasks([{ status: "done" }, { status: "failed" }]).verdict).toBe("PARTIALLY_COMPLETED");
    expect(rollupTasks([{ status: "failed" }, { status: "failed" }]).verdict).toBe("FAILED");
    expect(rollupTasks([{ status: "done" }, { status: "running" }]).verdict).toBe("PENDING");
  });

  it("reports the weakest task state for a mixed execution", () => {
    expect(rollupTasks([{ status: "done" }, { status: "simulated" }]).state).toBe("SIMULATED");
  });

  it("gates unverifiable claims and explains why", () => {
    const blocked = verificationGate({ state: "SIMULATED", evidenceCount: 0, independentSources: 0 });
    expect(blocked.pass).toBe(false);
    expect(blocked.reasons.length).toBeGreaterThanOrEqual(3);

    const passed = verificationGate({
      state: "VERIFIED", evidenceCount: 4, independentSources: 3, contradictions: 0, require: "MEASURED",
    });
    expect(passed.pass).toBe(true);
    expect(passed.reasons).toEqual([]);
  });

  it("ranks and localizes every state", () => {
    for (const s of VERIFICATION_STATES) {
      expect(typeof STATE_RANK[s]).toBe("number");
      expect(stateLabel(s, "ar")).toBeTruthy();
      expect(stateLabel(s, "en")).toBeTruthy();
      expect(stateLabel(s, "ku")).toBeTruthy();
    }
    expect(STATE_RANK.VERIFIED).toBeGreaterThan(STATE_RANK.SIMULATED);
  });
});
