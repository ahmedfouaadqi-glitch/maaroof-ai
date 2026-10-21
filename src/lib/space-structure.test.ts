import { describe, it, expect } from "vitest";
import { inferAccountKind, allowedChildKinds, canCreateSpace, spaceLimit } from "./space-structure";

const base = { sellsProduct: false, managesClients: false, multipleProducts: false, isPerson: false, isMedia: false };

describe("space structure", () => {
  it("marketing agency with clients may add client and product spaces", () => {
    expect(inferAccountKind({ ...base, managesClients: true })).toBe("agency_with_clients");
    expect(allowedChildKinds("company", "agency_with_clients")).toEqual(["product", "client"]);
  });
  it("product company may add product spaces only", () => {
    expect(inferAccountKind({ ...base, sellsProduct: true })).toBe("product_company");
    expect(allowedChildKinds("company", "product_company")).toEqual(["product"]);
  });
  it("person without links is an individual and child spaces cannot nest", () => {
    expect(inferAccountKind({ ...base, isPerson: true })).toBe("individual");
    expect(allowedChildKinds("product", "agency_with_clients")).toEqual([]);
  });
  it("space count follows the plan", () => {
    expect(spaceLimit(null)).toBe(1);
    expect(canCreateSpace(1, "free")).toBe(false);
    expect(canCreateSpace(4, "pro")).toBe(true);
  });
});
