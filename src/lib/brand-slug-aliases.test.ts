import { describe, it, expect } from "vitest";
import { canonicalBrandSlug } from "./brand-slug-aliases";
describe("brand slug aliases", () => {
  it("old GEO Iraq card points to maaroof-ai", () => expect(canonicalBrandSlug("جيو-العراق")).toBe("maaroof-ai"));
  it("workspace duplicate points to maaroof-ai", () => expect(canonicalBrandSlug("maaroof-ai-ec917124")).toBe("maaroof-ai"));
  it("canonical slug is not an alias", () => expect(canonicalBrandSlug("maaroof-ai")).toBeNull());
});
