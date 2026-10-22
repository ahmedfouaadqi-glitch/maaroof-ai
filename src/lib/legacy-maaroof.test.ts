import { describe, it, expect } from "vitest";
import { mapLegacyMaaroofTab } from "./legacy-maaroof";

describe("mapLegacyMaaroofTab", () => {
  it("tasks goes to ops", () => expect(mapLegacyMaaroofTab("tasks")).toBe("ops"));
  it("channels stays channels", () => expect(mapLegacyMaaroofTab("channels")).toBe("channels"));
  it("approvals stays approvals", () => expect(mapLegacyMaaroofTab("approvals")).toBe("approvals"));
  it("knowledge stays knowledge", () => expect(mapLegacyMaaroofTab("knowledge")).toBe("knowledge"));
  it("chat goes to main space", () => expect(mapLegacyMaaroofTab("chat")).toBeUndefined());
});
