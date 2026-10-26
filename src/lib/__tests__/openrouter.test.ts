import { describe, it, expect } from "vitest";
import { openRouterChat, detectCouncilRequest } from "@/lib/maaroof/openrouter.server";

describe("openrouter chat", () => {
  it("returns empty string when every model fails so chat falls back", async () => {
    const f = (async () => new Response("x", { status: 500 })) as any;
    expect(await openRouterChat([{ role: "user", content: "hi" }], { fetchImpl: f, apiKey: "k" })).toBe("");
  });
  it("moves to the next model after a failure", async () => {
    let n = 0;
    const f = (async () => (++n === 1 ? new Response("x", { status: 429 }) : Response.json({ choices: [{ message: { content: "ok" } }] }))) as any;
    expect(await openRouterChat([{ role: "user", content: "hi" }], { fetchImpl: f, apiKey: "k" })).toBe("ok");
  });
  it("detects explicit ten-engine requests", () => {
    expect(detectCouncilRequest("اسأل النماذج العشر عن علامتي")).toBe(true);
    expect(detectCouncilRequest("مرحبا")).toBe(false);
  });
});
