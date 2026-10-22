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
    expect(parseReply("needs search [[NEEDS_TASK]]")).toEqual({ text: "needs search", needsTask: true });
  });
  it("empty knowledge is declared, not invented", () => {
    expect(groundedSystemPrompt("ar", [])).toContain("nothing is known yet");
  });
});
