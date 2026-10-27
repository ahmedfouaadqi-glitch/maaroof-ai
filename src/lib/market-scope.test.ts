import { describe, expect, it } from "vitest";
import { detectMarkets, sheetsForMarket } from "./market-scope";

describe("sheetsForMarket", () => {
  const us = detectMarkets(["United States"])[0];
  const uk = detectMarkets(["United Kingdom"])[0];

  it("uses explicitly labelled sheets for a market", () => {
    const sheets = [{ name: "United States keywords" }, { name: "United Kingdom keywords" }, { name: "Generic notes" }];
    expect(sheetsForMarket(sheets, [us, uk], us).map((sheet) => sheet.name)).toEqual(["United States keywords"]);
  });

  it("uses generic sheets for a single market when no tab is market-labelled", () => {
    const sheets = [{ name: "Keyword research" }, { name: "Search terms" }];
    expect(sheetsForMarket(sheets, [us], us)).toEqual(sheets);
  });

  it("does not duplicate generic sheets across multiple markets", () => {
    const sheets = [{ name: "Keyword research" }];
    expect(sheetsForMarket(sheets, [us, uk], us)).toEqual([]);
    expect(sheetsForMarket(sheets, [us, uk], uk)).toEqual([]);
  });
});
