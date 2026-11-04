import { describe, expect, it } from "vitest";
import { detectMarkets, marketByCode, sheetsForMarket } from "./market-scope";

describe("sheetsForMarket", () => {
  const us = detectMarkets(["United States"])[0];
  const uk = detectMarkets(["United Kingdom"])[0];

  it("uses explicitly labelled sheets for a market", () => {
    const sheets = [{ name: "United States keywords" }, { name: "United Kingdom keywords" }, { name: "Generic notes" }];
    expect(sheetsForMarket(sheets, [us, uk], us).map((sheet) => sheet.name)).toEqual(["United States keywords", "Generic notes"]);
  });

  it("uses generic sheets for a single market when no tab is market-labelled", () => {
    const sheets = [{ name: "Keyword research" }, { name: "Search terms" }];
    expect(sheetsForMarket(sheets, [us], us)).toEqual(sheets);
  });

  it("shares generic sheets across multiple markets without leaking explicitly labelled sheets", () => {
    const generic = { name: "Keyword research" };
    const usSheet = { name: "United States keywords" };
    const ukSheet = { name: "United Kingdom keywords" };
    const sheets = [generic, usSheet, ukSheet];
    expect(sheetsForMarket(sheets, [us, uk], us)).toEqual([generic, usSheet]);
    expect(sheetsForMarket(sheets, [us, uk], uk)).toEqual([generic, ukSheet]);
  });

  it("uses a generic site-keyword sheet for each market", () => {
    const siteKeywords = { name: "كلمات الموقع" };
    expect(sheetsForMarket([siteKeywords], [us, uk], us)).toEqual([siteKeywords]);
    expect(sheetsForMarket([siteKeywords], [us, uk], uk)).toEqual([siteKeywords]);
  });
});

describe("explicit global market", () => {
  it("resolves the global scope without inventing a country", () => {
    expect(detectMarkets(["Global"]).map((market) => market.code)).toContain("global");
    expect(detectMarkets(["عالمي"]).map((market) => market.code)).toContain("global");
    expect(marketByCode("global")).toEqual({ code: "global", en: "Global", ar: "عالمي", gl: "world" });
    expect(marketByCode("world")?.code).toBe("global");
    const unlabelled = [{ name: "Master Keywords" }, { name: "Products" }];
    expect(sheetsForMarket(unlabelled, [marketByCode("global")!], marketByCode("global")!)).toEqual(unlabelled);
  });
});

describe("geographic market coverage", () => {
  it("recognizes countries from the workspace geographic selector even if they were not in the legacy market list", () => {
    expect(detectMarkets(["Italy"]).map((market) => market.code)).toContain("it");
    expect(marketByCode("it")?.en).toBe("Italy");
    expect(detectMarkets(["إيطاليا"]).map((market) => market.code)).toContain("it");
  });
});
