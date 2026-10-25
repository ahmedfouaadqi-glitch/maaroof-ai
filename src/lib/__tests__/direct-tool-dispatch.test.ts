import { describe, expect, it, vi } from "vitest";
import { resolveDirectPostHandler } from "@/lib/maaroof/direct-tool-dispatch.server";

describe("in-process tool dispatch", () => {
  it("resolves a simple POST handler from the existing file route", async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const resolved = resolveDirectPostHandler({ Route: { options: { server: { handlers: { POST: handler } } } } });
    expect(resolved).toBe(handler);
    const response = await resolved!({ request: new Request("https://maaroofai.com/api/test", { method: "POST" }) });
    expect(await response.json()).toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not bypass route middleware", () => {
    const handler = vi.fn(async () => Response.json({ ok: true }));
    expect(resolveDirectPostHandler({ Route: { options: { server: { middleware: [vi.fn()], handlers: { POST: handler } } } } })).toBeNull();
  });

  it("uses HTTP fallback for handler factories or unknown routes", () => {
    expect(resolveDirectPostHandler({ Route: { options: { server: { handlers: () => ({ POST: vi.fn() }) } } } })).toBeNull();
    expect(resolveDirectPostHandler({ Route: { options: { server: { handlers: {} } } } })).toBeNull();
  });
});
