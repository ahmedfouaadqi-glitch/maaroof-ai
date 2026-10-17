import { describe, expect, it } from "vitest";
import { defaultInterviewTargetType } from "@/lib/maaroof/interview-context";

describe("default interview target from saved identity", () => {
  it.each([
    ["organization", "company"],
    ["person", "creator"],
    ["individual", "individual"],
    ["unknown", ""],
    [null, ""],
  ])("maps profile entity type %s to %s", (profileEntityType, expected) => {
    expect(defaultInterviewTargetType(profileEntityType)).toBe(expected);
  });

  it.each([
    ["own", "organization", "company"],
    ["brand", "organization", "brand"],
    ["client", "organization", "client"],
    ["agency", "individual", "agency"],
    ["company", "person", "company"],
    ["creator", "organization", "creator"],
  ])(
    "lets workspace kind %s provide a more specific default",
    (workspaceKind, profileEntityType, expected) => {
      expect(defaultInterviewTargetType(profileEntityType, workspaceKind)).toBe(expected);
    },
  );

  it("does not infer agency from organization alone", () => {
    expect(defaultInterviewTargetType("organization")).toBe("company");
  });

  it("falls back to the saved profile identity for an unrecognized workspace kind", () => {
    expect(defaultInterviewTargetType("person", "legacy-kind")).toBe("creator");
  });
});
