import { describe, expect, it } from "vitest";
import { effectiveWorkspaceGeoScope, workspaceGeoScope } from "./workspace-geo-scope";

describe("workspace geographic scope", () => {
  it("uses the workspace country and does not inherit account scope", () => {
    expect(effectiveWorkspaceGeoScope("ws-a", { id: "ws-a", country: "Iraq" }, { scope: "country", country: "Lebanon" }))
      .toEqual({ scope: "country", country: "Iraq" });
    expect(effectiveWorkspaceGeoScope("ws-a", null, { scope: "country", country: "Lebanon" }))
      .toEqual({ scope: "world" });
  });

  it("rejects a stale workspace object from another workspace", () => {
    expect(effectiveWorkspaceGeoScope("ws-b", { id: "ws-a", country: "Iraq" }, { scope: "world" }))
      .toEqual({ scope: "world" });
  });

  it("treats missing and global workspace countries as worldwide", () => {
    expect(workspaceGeoScope({ id: "ws-a" })).toEqual({ scope: "world" });
    expect(workspaceGeoScope({ country: "Global" })).toEqual({ scope: "world" });
  });
});
