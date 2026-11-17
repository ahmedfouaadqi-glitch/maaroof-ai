import { describe, expect, it } from "vitest";
import { resolveOwnerWorkspacePresentation } from "./owner-mode";

describe("resolveOwnerWorkspacePresentation", () => {
  it("hides balance, token counts and tool prices in the owner workspace by default", () => {
    expect(resolveOwnerWorkspacePresentation()).toEqual({
      isSingleOwnerMode: true,
      showBalanceCards: false,
      showTokenCounts: false,
      showToolPrices: false,
    });
  });

  it("keeps the presentation policy separate from non-owner workspaces", () => {
    expect(resolveOwnerWorkspacePresentation({ isSingleOwnerMode: false })).toEqual({
      isSingleOwnerMode: false,
      showBalanceCards: true,
      showTokenCounts: true,
      showToolPrices: true,
    });
  });

  it("allows an explicit owner-facing exception without changing the accounting layer", () => {
    expect(resolveOwnerWorkspacePresentation({ hideToolPrices: false })).toMatchObject({
      showBalanceCards: false,
      showTokenCounts: false,
      showToolPrices: true,
    });
  });
});
