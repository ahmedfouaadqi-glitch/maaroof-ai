import { describe, expect, it } from "vitest";
import { completionWithFallback } from "./provider-fallback.server";

function completion(content: string, status = 200) {
  return new Response(JSON.stringify(status >= 200 && status < 300
    ? { choices: [{ message: { content } }] }
    : { error: { message: content } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("automatic provider fallback", () => {
  it("uses the gateway automatically when the primary key is rejected with HTTP 402", async () => {
    const calls: Array<{ url: string; headers: Headers; body: any }> = [];
    const result = await completionWithFallback({
      primaryModel: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "test" }],
      primaryKey: "rejected-key",
      fallbackKey: "lovable-key",
      fallbackModels: ["google/gemini-2.5-flash"],
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const headers = new Headers(init?.headers);
        const body = JSON.parse(String(init?.body || "{}"));
        calls.push({ url, headers, body });
        if (url.includes("openrouter.ai")) return completion("insufficient credits", 402);
        return completion('{"answer":"valid result","brands":[],"urls":[]}');
      }) as typeof fetch,
      acceptContent: (value) => value.includes('"answer"'),
    });

    expect(result.status).toBe("answered");
    expect(result.providerPath).toBe("fallback");
    expect(result.modelUsed).toBe("google/gemini-2.5-flash");
    expect(result.attempts[0].httpStatus).toBe(402);
    expect(calls).toHaveLength(2);
    expect(calls[1].headers.get("Lovable-API-Key")).toBe("lovable-key");
  });

  it("skips the primary provider when its key is absent", async () => {
    const urls: string[] = [];
    const result = await completionWithFallback({
      primaryModel: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "test" }],
      primaryKey: null,
      fallbackKey: "lovable-key",
      fallbackModels: ["google/gemini-2.5-flash"],
      fetchImpl: (async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return completion('{"answer":"gateway result"}');
      }) as typeof fetch,
    });

    expect(result.status).toBe("answered");
    expect(result.providerPath).toBe("fallback");
    expect(urls).toEqual(["https://ai.gateway.lovable.dev/v1/chat/completions"]);
  });

  it("does not call the fallback when the primary response is usable", async () => {
    const urls: string[] = [];
    const result = await completionWithFallback({
      primaryModel: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "test" }],
      primaryKey: "primary-key",
      fallbackKey: "lovable-key",
      fetchImpl: (async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return completion('{"answer":"primary result"}');
      }) as typeof fetch,
    });

    expect(result.status).toBe("answered");
    expect(result.providerPath).toBe("primary");
    expect(urls).toEqual(["https://openrouter.ai/api/v1/chat/completions"]);
  });

  it("falls back when primary content is nonempty but fails caller validation", async () => {
    const urls: string[] = [];
    const result = await completionWithFallback({
      primaryModel: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "test" }],
      primaryKey: "primary-key",
      fallbackKey: "lovable-key",
      fallbackModels: ["google/gemini-2.5-flash"],
      acceptContent: (value) => value.includes('"answer"'),
      fetchImpl: (async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return completion(urls.length === 1 ? "not JSON" : '{"answer":"corrected"}');
      }) as typeof fetch,
    });

    expect(result.status).toBe("answered");
    expect(result.providerPath).toBe("fallback");
    expect(urls).toHaveLength(2);
  });

  it("preserves both failure reasons if neither provider succeeds", async () => {
    const result = await completionWithFallback({
      primaryModel: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "test" }],
      primaryKey: "rejected-key",
      fallbackKey: "lovable-key",
      fallbackModels: ["google/gemini-2.5-flash"],
      fetchImpl: (async (input: RequestInfo | URL) => String(input).includes("openrouter.ai")
        ? completion("rejected", 402)
        : completion("unavailable", 503)) as typeof fetch,
    });

    expect(result.status).toBe("http_error");
    expect(result.providerPath).toBeNull();
    expect(result.error).toContain("HTTP 402");
    expect(result.error).toContain("HTTP 503");
  });

  it("returns an explicit no-key state rather than claiming success", async () => {
    const result = await completionWithFallback({
      primaryModel: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "test" }],
      primaryKey: null,
      fallbackKey: null,
      fetchImpl: (async () => { throw new Error("must not be called"); }) as typeof fetch,
    });

    expect(result.status).toBe("no_answer");
    expect(result.providerPath).toBeNull();
    expect(result.error).toContain("No provider API key");
  });
});
