import { describe, expect, it } from "vitest";
import { checkEntityConsistency, entityContextLine } from "./entity-consistency";

describe("entity consistency identity anchors", () => {
  it("flags a possible same-name entity when the brand is paired with an undeclared country", () => {
    const alerts = checkEntityConsistency(
      "Maaroof provides software services, and this report discusses its operations in Saudi Arabia.",
      {
        brand_name: "Maaroof",
        hq_country: "IQ",
        target_markets: ["IQ"],
        entity_links: ["https://www.maaroofai.com"],
      },
    );
    expect(alerts.some((alert) => alert.kind === "identity")).toBe(true);
  });

  it("keeps a geography alert when no entity name is present", () => {
    const alerts = checkEntityConsistency(
      "This software market report discusses demand and service providers in Saudi Arabia.",
      { brand_name: "Maaroof", hq_country: "IQ", target_markets: ["IQ"] },
    );
    expect(alerts.some((alert) => alert.kind === "geo")).toBe(true);
    expect(alerts.some((alert) => alert.kind === "identity")).toBe(false);
  });

  it("adds declared official-link domains to the identity context", () => {
    const context = entityContextLine({
      brand_name: "Maaroof",
      hq_country: "IQ",
      entity_links: ["https://www.maaroofai.com/about", "https://instagram.com/maaroof"],
    });
    expect(context).toContain("hq=IQ");
    expect(context).toContain("declared_links=maaroofai.com,instagram.com");
    expect(context).toContain("not independently verified");
  });

  it("uses a matching declared official link to disambiguate the entity", () => {
    const alerts = checkEntityConsistency(
      "Maaroof provides software services in Saudi Arabia. Official details: https://maaroofai.com/about",
      {
        brand_name: "Maaroof",
        hq_country: "IQ",
        target_markets: ["IQ"],
        entity_links: ["https://www.maaroofai.com"],
      },
    );
    expect(alerts.some((alert) => alert.kind === "identity")).toBe(false);
    expect(alerts.some((alert) => alert.kind === "geo")).toBe(true);
  });

});
