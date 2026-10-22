import { describe, it, expect } from "vitest";
import { mapLegacyMaaroofTab } from "./legacy-maaroof";

describe("mapLegacyMaaroofTab", () => {
  it("tasks goes to add-ons", () => expect(mapLegacyMaaroofTab("tasks")).toBe("extras"));
  it("channels goes to add-ons", () => expect(mapLegacyMaaroofTab("channels")).toBe("extras"));
  it("approvals goes to interview", () => expect(mapLegacyMaaroofTab("approvals")).toBe("interview"));
  it("knowledge stays knowledge", () => expect(mapLegacyMaaroofTab("knowledge")).toBe("knowledge"));
  it("chat goes to main space", () => expect(mapLegacyMaaroofTab("chat")).toBeUndefined());
});
