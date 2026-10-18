import { describe, expect, it } from "vitest";
import { ACCOUNT_TYPES, accountTypeLabel, normalizeAccountType } from "./account-types";

describe("Maaroof account types", () => {
  it("defines exactly seven stable account types", () => {
    expect(ACCOUNT_TYPES.map((item) => item.value)).toEqual([
      "individual", "creator", "business", "ecommerce", "agency", "nonprofit", "public_sector",
    ]);
  });

  it("normalizes missing, invalid, and legacy values safely", () => {
    expect(normalizeAccountType(null)).toBe("individual");
    expect(normalizeAccountType("unknown")).toBe("individual");
    expect(normalizeAccountType(" BUSINESS ")).toBe("business");
  });

  it("provides localized labels for supported account types", () => {
    expect(accountTypeLabel("creator", "ar")).toBe("صانع محتوى / شخصية عامة");
    expect(accountTypeLabel("creator", "en")).toBe("Creator / public figure");
    expect(accountTypeLabel("creator", "ku")).toBe("دروستکەری ناوەڕۆک / کەسایەتی گشتی");
  });
});
