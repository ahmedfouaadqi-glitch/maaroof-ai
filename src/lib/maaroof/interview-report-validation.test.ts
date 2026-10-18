import { describe, expect, it } from "vitest";
import { localizedMissingSection, validateCitationRefs } from "@/lib/maaroof/interview-report-validation";

describe("interview report citation validation", () => {
  it("preserves citation indexes that map to available sources", () => {
    expect(validateCitationRefs("Evidence [1] and [2].", 2, "en")).toBe("Evidence [1] and [2].");
  });

  it("replaces missing, zero, and out-of-range source indexes", () => {
    expect(validateCitationRefs("Claim [0], claim [3], and claim [12].", 2, "ar"))
      .toBe("Claim [مرجع المصدر غير متاح], claim [مرجع المصدر غير متاح], and claim [مرجع المصدر غير متاح].");
  });

  it("provides an explicit localized fallback instead of silently omitting a selected domain", () => {
    const section = localizedMissingSection("geo", "ar");
    expect(section.id).toBe("geo");
    expect(section.gaps[0]).toContain("لا تعتبر ذلك نتيجة قياس");
    expect(section.measurementNote).toContain("ليست نتيجة قياس");
  });
});
