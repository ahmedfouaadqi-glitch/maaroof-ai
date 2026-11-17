import { describe, expect, it } from "vitest";
import { buildReportBrandPreview, validateReportBranding } from "./report-branding";

const base = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  mode: "full_white_label" as const,
  displayName: "Client Brand",
  logoUrl: "https://cdn.example.com/logo.svg",
  primaryColor: "#123456",
  secondaryColor: "#223344",
  accentColor: "#abcdef",
  language: "ar" as const,
};

describe("report branding", () => {
  it("builds isolated full-white-label preview settings", () => {
    const parsed = validateReportBranding(base);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const preview = buildReportBrandPreview(parsed.data);
    expect(preview.showMaaroofBrand).toBe(false);
    expect(preview.brandName).toBe("Client Brand");
    expect(preview.direction).toBe("rtl");
  });

  it("keeps Maaroof branding in co-branded and Maaroof modes", () => {
    const parsed = validateReportBranding({ ...base, mode: "co_branded" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(buildReportBrandPreview(parsed.data).showMaaroofBrand).toBe(true);
  });

  it("rejects insecure logo URLs and invalid colors", () => {
    expect(validateReportBranding({ ...base, logoUrl: "http://cdn.example.com/logo.svg" }).success).toBe(false);
    expect(validateReportBranding({ ...base, primaryColor: "red" }).success).toBe(false);
  });

  it("keeps branding bound to the declared workspace", () => {
    const preview = buildReportBrandPreview({ ...base, mode: "maaroof_branded" });
    expect(preview.workspaceId).toBe(base.workspaceId);
    expect(preview.brandName).toBe("MAAROOF Ai");
  });
});
