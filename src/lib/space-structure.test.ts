import { describe, it, expect } from "vitest";
import { descendantIds, inferAccountKind, allowedChildKinds, canCreateSpace, spaceLimit } from "./space-structure";

const base = { sellsProduct: false, managesClients: false, multipleProducts: false, isPerson: false, isMedia: false };

describe("space structure", () => {
  it("marketing agency with clients may add client and product spaces", () => {
    expect(inferAccountKind({ ...base, managesClients: true })).toBe("agency_with_clients");
    expect(allowedChildKinds("company", "agency_with_clients")).toEqual(["product", "subsidiary", "client"]);
  });
  it("product company may add product spaces only", () => {
    expect(inferAccountKind({ ...base, sellsProduct: true })).toBe("product_company");
    expect(allowedChildKinds("company", "product_company")).toEqual(["product", "subsidiary"]);
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
  it("client and subsidiary hold products; products hold nothing", () => {
    expect(allowedChildKinds("client", "agency_with_clients")).toEqual(["product"]);
    expect(allowedChildKinds("subsidiary", "product_company")).toEqual(["product"]);
    expect(allowedChildKinds("product", "product_company")).toEqual([]);
  });
  it("delete counts every descendant once", () => {
    const items = [{ id: "a", parent_id: null }, { id: "b", parent_id: "a" }, { id: "c", parent_id: "b" }, { id: "d", parent_id: null }];
    expect(descendantIds("a", items).sort()).toEqual(["a", "b", "c"]);
  });
});
