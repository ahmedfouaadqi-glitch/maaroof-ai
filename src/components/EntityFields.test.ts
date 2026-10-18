import { describe, expect, it } from "vitest";
import {
  ENTITY_TYPES,
  entityDraftFrom,
  entityUpdateFrom,
  normalizeEntityType,
  suggestEntityType,
} from "./EntityFields";

describe("entity truth card account types", () => {
  it("exposes all seven account types", () => {
    expect(ENTITY_TYPES).toEqual([
      "product_company",
      "marketing_company",
      "news_agency",
      "content_creator",
      "public_figure",
      "individual",
      "multi_client_agency",
    ]);
  });

  it("normalizes legacy values without guessing a more specific identity", () => {
    expect(normalizeEntityType("organization")).toBe("product_company");
    expect(normalizeEntityType("person")).toBe("individual");
    expect(entityDraftFrom({ entity_type: "organization", entity_links: [] }).type).toBe(
      "product_company",
    );
    expect(entityDraftFrom({ entity_type: "person", entity_links: [] }).type).toBe(
      "individual",
    );
  });

  it("suggests only types supported by the provided links", () => {
    expect(suggestEntityType("")).toBe("individual");
    expect(suggestEntityType("https://instagram.com/example\nhttps://youtube.com/@example")).toBe(
      "content_creator",
    );
    expect(suggestEntityType("https://example.com")).toBe("product_company");
  });

  it("persists the normalized type and normalized links", () => {
    expect(
      entityUpdateFrom({
        type: "multi_client_agency",
        hq: "IQ",
        mk: ["IQ"],
        sp: "SEO and content",
        links: "maaroofai.com\nhttps://instagram.com/maaroof",
      }),
    ).toEqual({
      entity_type: "multi_client_agency",
      hq_country: "IQ",
      target_markets: ["IQ"],
      specialty_scope: "SEO and content",
      entity_links: ["https://maaroofai.com", "https://instagram.com/maaroof"],
    });
  });
});
