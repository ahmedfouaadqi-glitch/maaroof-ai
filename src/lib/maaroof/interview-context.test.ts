import { describe, expect, it } from "vitest";
import { defaultInterviewTargetType } from "@/lib/maaroof/interview-context";

describe("default interview target from saved profile and workspace", () => {
  it.each([
    ["organization", "company"],
    ["person", "creator"],
    ["individual", "individual"],
    ["unknown", ""],
    [null, ""],
  ])("falls back from profile entity type %s to %s", (profileEntityType, expected) => {
    expect(defaultInterviewTargetType(null, profileEntityType)).toBe(expected);
  });

  it.each([
    ["individual", "individual"],
    ["creator", "creator"],
    ["company", "company"],
    ["agency", "agency"],
  ])("uses explicit saved interview persona %s", (persona, expected) => {
    expect(defaultInterviewTargetType(persona, "organization")).toBe(expected);
  });

  it.each([
    ["own", "organization", "company"],
    ["brand", "organization", "brand"],
    ["client", "organization", "client"],
    ["agency", "individual", "agency"],
    ["company", "person", "company"],
    ["creator", "organization", "creator"],
  ])(
    "resolves workspace kind %s when no explicit profile persona exists",
    (workspaceKind, profileEntityType, expected) => {
      expect(defaultInterviewTargetType(null, profileEntityType, workspaceKind)).toBe(expected);
    },
  );

  it("lets a client or brand workspace override the account default", () => {
    expect(defaultInterviewTargetType("agency", "organization", "client")).toBe("client");
    expect(defaultInterviewTargetType("company", "organization", "brand")).toBe("brand");
  });

  it("uses explicit profile persona before identity-derived fallback", () => {
    expect(defaultInterviewTargetType("agency", "person", "own")).toBe("agency");
    expect(defaultInterviewTargetType("creator", "organization")).toBe("creator");
  });

  it("does not infer agency from organization alone", () => {
    expect(defaultInterviewTargetType(null, "organization")).toBe("company");
  });

  it("falls back to profile identity for an unknown workspace kind", () => {
    expect(defaultInterviewTargetType(null, "person", "legacy-kind")).toBe("creator");
  });

  it("requires an explicit selection if profile identity is unknown", () => {
    expect(defaultInterviewTargetType(null, null, "legacy-kind")).toBe("");
  });
});
