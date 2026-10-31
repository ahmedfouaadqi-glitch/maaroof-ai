import { describe, expect, it } from "vitest";
import { deriveOfficialSiteCategory } from "./website-category";

describe("deriveOfficialSiteCategory", () => {
  it("uses first-party description text and removes the target brand", () => {
    const result = deriveOfficialSiteCategory({
      title: "Mengotti Couture | Official Store",
      description: "Mengotti Couture presents contemporary luxury eveningwear and couture collections for women.",
      hostname: "www.mengotticouture.com",
    }, "Mengotti Couture");
    expect(result?.basis).toBe("official_site_description");
    expect(result?.category.toLowerCase()).not.toContain("mengotti");
    expect(result?.category).toContain("luxury eveningwear");
  });

  it("falls back to official site content without guessing a category", () => {
    const result = deriveOfficialSiteCategory({
      description: "Home",
      title: "Welcome",
      markdown: "# Products\nExplore handmade leather accessories, bags and small goods for everyday use.",
      hostname: "brand.example",
    }, "Brand");
    expect(result?.basis).toBe("official_site_content");
    expect(result?.category).toContain("handmade leather accessories");
  });

  it("returns null when the official page exposes no useful category text", () => {
    expect(deriveOfficialSiteCategory({ title: "Home", description: "Welcome", markdown: "Login Cart Menu" }, "Acme")).toBeNull();
  });
});
