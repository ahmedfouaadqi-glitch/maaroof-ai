import { describe, expect, it } from "vitest";
import { buildTaskGoalFromResult } from "./chat-actions";

describe("buildTaskGoalFromResult", () => {
  it("keeps the prior request and answer as bounded context", () => {
    const goal = buildTaskGoalFromResult({
      language: "ar",
      originalRequest: "افحص موقعي",
      answer: "وجد التقرير نقصاً في وصف الخدمات.",
    });
    expect(goal).toContain("افحص موقعي");
    expect(goal).toContain("وجد التقرير نقصاً في وصف الخدمات.");
    expect(goal).toContain("لا تُجرِ تغييرات خارجية دون موافقة صريحة");
  });

  it("uses a supplied task objective without losing report context", () => {
    const goal = buildTaskGoalFromResult({
      language: "en",
      originalRequest: "Audit my website",
      answer: "The service description is missing.",
      proposedGoal: "Improve the service description.",
    });
    expect(goal).toContain("Task objective: Improve the service description.");
    expect(goal).toContain("The service description is missing.");
  });

  it("bounds long responses and supports Sorani Kurdish labels", () => {
    const goal = buildTaskGoalFromResult({
      language: "ku",
      originalRequest: "داواکاری",
      answer: "x".repeat(5000),
    });
    expect(goal.length).toBeLessThanOrEqual(3400);
    expect(goal).toContain("ئامانجی ئەرک");
    expect(goal).toContain("سنووری جێبەجێکردن");
    expect(goal.length).toBeLessThanOrEqual(1800);
    expect(goal).toContain("سنووری جێبەجێکردن");
    expect(goal.match(/x/g)?.length).toBeLessThanOrEqual(650);
  });
});
