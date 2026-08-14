import { describe, expect, it } from "vitest";
import { assertBrowserIntent, resolveBrowserCapability } from "@/lib/maaroof/browser.server";

const settings = {
  browser: {
    enabled: false,
    allow_user_connector: false,
    require_user_confirmation: true,
  },
} as any;

describe("browser capability boundary", () => {
  it("fails closed when no adapter is configured", () => {
    const capability = resolveBrowserCapability("embedded", settings, {});
    expect(capability.status).toBe("unavailable");
    expect(capability.canNavigate).toBe(false);
    expect(() => assertBrowserIntent({ action: "inspect", path: "embedded", userConfirmed: true }, capability)).toThrow("browser_adapter_unavailable");
  });

  it("requires an explicit confirmation for a user connector", () => {
    const capability = resolveBrowserCapability(
      "user_connector",
      { browser: { enabled: true, allow_user_connector: true, require_user_confirmation: true } } as any,
      {},
    );
    expect(capability.status).toBe("opt_in");
    expect(capability.requiresUserConfirmation).toBe(true);
    expect(capability.canNavigate).toBe(false);
  });
});
