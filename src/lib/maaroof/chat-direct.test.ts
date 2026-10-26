import { describe, it, expect } from "vitest";
import { chatRoute, detectGeoScoreRequest } from "./chat-direct";

describe("chat routing rule", () => {
  it("one tool runs directly", () => expect(chatRoute(1)).toBe("direct"));
  it("two tools run directly", () => expect(chatRoute(2)).toBe("direct"));
  it("three tools need an approved task", () => expect(chatRoute(3)).toBe("task"));
  it("no tool stays chat", () => expect(chatRoute(0)).toBe("chat"));
});

describe("GEO score in chat", () => {
  it("extracts the post text", () => {
    const r = detectGeoScoreRequest("اعطني درجة GEO لهذا المنشور: مينغوتي كوتور دار أزياء راقية في بيروت منذ 2010");
    expect(r?.tool).toBe("analyze");
    expect(r?.text.startsWith("مينغوتي")).toBe(true);
  });
  it("asks nothing to run without content", () => expect(detectGeoScoreRequest("درجة GEO")).toBeNull());
  it("ignores greetings", () => expect(detectGeoScoreRequest("مرحبا كيف حالك")).toBeNull());
});
