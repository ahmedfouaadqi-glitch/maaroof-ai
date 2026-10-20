import { describe, it, expect } from "vitest";
import { ACCOUNT_KINDS, kindToEntityType, presenceNotes } from "./account-kinds";

describe("account kinds", () => {
  it("has exactly seven kinds", () => {
    expect(ACCOUNT_KINDS.length).toBe(7);
  });
  it("maps kinds onto the base entity type", () => {
    expect(kindToEntityType("news_agency")).toBe("organization");
    expect(kindToEntityType("content_creator")).toBe("person");
    expect(kindToEntityType("individual")).toBe("individual");
  });
  it("warns a product company without a website", () => {
    expect(presenceNotes(["instagram.com/x"], "product_company", "en").some((n) => n.includes("website"))).toBe(true);
  });
  it("warns about similar names when there are no links", () => {
    expect(presenceNotes([], "individual", "en").some((n) => n.includes("similar names"))).toBe(true);
  });
});
