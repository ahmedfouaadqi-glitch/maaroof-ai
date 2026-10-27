import { describe, expect, it } from "vitest";
import { inferCategoryFromSignals, resolveCompetitiveContext } from "./competitive-context";

describe("competitive context resolution", () => {
  it("reuses the workspace identity and website without asking again", () => {
    const resolved = resolveCompetitiveContext({
      workspace: { name: "Mengotti Couture", brand_url: "https://mengotticouture.com", country: "United States" },
      requestText: "Analyze the keyword workbook for this client.",
    });
    expect(resolved.brand).toBe("Mengotti Couture");
    expect(resolved.site).toBe("https://mengotticouture.com");
    expect(resolved.category).toBe("Luxury fashion & couture");
    expect(resolved.categorySource).toBe("inferred");
  });

  it("uses the saved workspace sector before inferring from generic text", () => {
    const resolved = resolveCompetitiveContext({
      workspace: { name: "Client A", brand_summary: "Industrial safety equipment" },
      requestText: "Analyze this business website.",
    });
    expect(resolved.category).toBe("Industrial safety equipment");
    expect(resolved.categorySource).toBe("workspace");
  });

  it("uses a category explicitly supplied by the user", () => {
    const resolved = resolveCompetitiveContext({
      explicitCategory: "Luxury eveningwear",
      workspace: { name: "Mengotti Couture", brand_summary: "Retail" },
    });
    expect(resolved.category).toBe("Luxury eveningwear");
    expect(resolved.categorySource).toBe("provided");
  });

  it("can infer a category from workbook keyword evidence", () => {
    expect(inferCategoryFromSignals(["black evening dresses", "couture gown", "designer dress"])).toBe("Luxury fashion & couture");
  });

  it("infers common healthcare and medical sectors from product and service values in a workbook", () => {
    expect(inferCategoryFromSignals(["Medical clinic", "patient care", "diagnostic equipment", "pharmacy services"])).toBe("Healthcare & medical");
  });

  it("infers finance and education as distinct sectors for generic brand names", () => {
    expect(inferCategoryFromSignals(["digital banking", "payment processing", "financial services"])).toBe("Finance & banking");
    expect(inferCategoryFromSignals(["online courses", "e-learning academy", "training"])).toBe("Education & training");
  });

  it("uses real workbook signals to resolve an otherwise generic workspace", () => {
    const resolved = resolveCompetitiveContext({
      workspace: { name: "Brand X" },
      requestText: "Analyze this keyword workbook",
      workbookSignals: ["industrial safety equipment", "factory machinery", "industrial supplies"],
    });
    expect(resolved.category).toBe("Industrial & manufacturing");
    expect(resolved.categorySource).toBe("inferred");
  });

  it("does not invent a category when no signals support one", () => {
    const resolved = resolveCompetitiveContext({ workspace: { name: "Client A" }, requestText: "Review my project." });
    expect(resolved.category).toBe("");
    expect(resolved.categorySource).toBe("unresolved");
  });

  it("recovers a site and brand label from a request URL only when workspace identity is absent", () => {
    const resolved = resolveCompetitiveContext({ requestText: "Research https://example-brand.com and competitors." });
    expect(resolved.site).toBe("https://example-brand.com");
    expect(resolved.brand).toBe("example brand");
  });
});
