import { describe, expect, it, vi } from "vitest";
import { resolveDirectPostHandler } from "@/lib/maaroof/direct-tool-dispatch.server";
import { Route as analyzeRoute } from "@/routes/api/analyze";
import { Route as competitorMonitorRoute } from "@/routes/api/competitor-monitor";

describe("in-process tool dispatch", () => {
  it("resolves a simple POST handler from the existing file route", async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const resolved = resolveDirectPostHandler({ Route: { options: { server: { handlers: { POST: handler } } } } });
    expect(resolved).toBe(handler);
    const response = await resolved!({ request: new Request("https://maaroofai.com/api/test", { method: "POST" }) });
    expect(await response.json()).toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("can resolve a real TanStack API route module without calling it", () => {
    expect(resolveDirectPostHandler({ Route: analyzeRoute })).toEqual(expect.any(Function));
  });

  it("does not bypass route middleware", () => {
    const handler = vi.fn(async () => Response.json({ ok: true }));
    expect(resolveDirectPostHandler({ Route: { options: { server: { middleware: [vi.fn()], handlers: { POST: handler } } } } })).toBeNull();
  });

  it("uses HTTP fallback for handler factories or unknown routes", () => {
    expect(resolveDirectPostHandler({ Route: { options: { server: { handlers: () => ({ POST: vi.fn() }) } } } })).toBeNull();
    expect(resolveDirectPostHandler({ Route: { options: { server: { handlers: {} } } } })).toBeNull();
  });

  it("returns a paused status before scanning or billing for direct monitoring calls", async () => {
    const handler = resolveDirectPostHandler({ Route: competitorMonitorRoute });
    expect(handler).toEqual(expect.any(Function));
    const response = await handler!({
      request: new Request("https://maaroofai.com/api/competitor-monitor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", brand: "Example", competitors: ["Other"], lang: "en" }),
      }),
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "temporarily_paused",
      skipped: "temporarily_paused",
      message: expect.stringContaining("No scan was run"),
    });
  });
});
