import { describe, it, expect } from "vitest";
import { canBroadcast, broadcastSection, domainsInText } from "./knowledge-facts";

describe("broadcast rules", () => {
  it("never broadcasts hypotheses", () => {
    expect(canBroadcast({ confidence: "hypothesis" })).toBe(false);
  });
  it("never broadcasts expired evidence", () => {
    expect(canBroadcast({ confidence: "evidence", expires_at: "2000-01-01T00:00:00Z" })).toBe(false);
  });
  it("includes only facts the user approved", () => {
    const s = broadcastSection([
      { fact: "A approved", confidence: "evidence", broadcast: true },
      { fact: "B not approved", confidence: "evidence", broadcast: false },
      { fact: "C hypothesis", confidence: "hypothesis", broadcast: true },
    ]);
    expect(s).toContain("A approved");
    expect(s).not.toContain("B not approved");
    expect(s).not.toContain("C hypothesis");
  });
  it("extracts domains from a task result", () => {
    expect(domainsInText("see https://www.example.com/a and http://shop.iq/x")).toEqual(["example.com", "shop.iq"]);
  });
});
