import { describe, it, expect } from "vitest";
import { chatAllowed, parseReply, groundedSystemPrompt, FREE_CHAT_DAILY } from "./chat-policy";

describe("chat policy", () => {
  it("free users stop at the daily cap", () => {
    expect(chatAllowed({ metered: false, subscribed: false, todayUserMessages: FREE_CHAT_DAILY - 1 })).toBe(true);
    expect(chatAllowed({ metered: false, subscribed: false, todayUserMessages: FREE_CHAT_DAILY })).toBe(false);
  });
  it("metered users are not capped by message count", () => {
    expect(chatAllowed({ metered: true, subscribed: false, todayUserMessages: 999 })).toBe(true);
  });
  it("detects escalation mark", () => {
    expect(parseReply("needs search [[NEEDS_TASK]]")).toEqual({ text: "needs search", needsTask: true, task: null });
  });
  it("empty knowledge is declared, not invented", () => {
    expect(groundedSystemPrompt("ar", [])).toContain("nothing is known yet");
  });
});

import { chatQuota } from "./chat-policy";
describe("chat quota", () => {
  it("free user with 3 sent has 7 left and resets at next UTC midnight", () => {
    const q = chatQuota({ metered: false, subscribed: false, todayUserMessages: 3, now: Date.UTC(2026, 9, 23, 5) });
    expect(q.remaining).toBe(7);
    expect(q.resets_at).toBe("2026-10-24T00:00:00.000Z");
  });
  it("never negative", () => { expect(chatQuota({ metered: false, subscribed: false, todayUserMessages: 15 }).remaining).toBe(0); });
  it("metered users are unlimited", () => { expect(chatQuota({ metered: true, subscribed: false, todayUserMessages: 50 }).remaining).toBeNull(); });
});
