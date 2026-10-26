import { describe, expect, it } from "vitest";
import { hasActionableRecommendations, hasUsefulAnalyticalContent } from "./chat-message-actions";

describe("contextual chat actions", () => {
  it("hides actions for greetings and short replies", () => {
    expect(hasUsefulAnalyticalContent("مرحباً! كيف أستطيع مساعدتك؟")).toBe(false);
    expect(hasUsefulAnalyticalContent("Hello! What can I help with today?")).toBe(false);
    expect(hasActionableRecommendations("شكراً لك.")).toBe(false);
  });

  it("shows actions for a structured analytical answer", () => {
    const answer = [
      "## التشخيص",
      "يظهر التحليل أن الصفحة تحتاج إلى تحسينات عملية في المحتوى والأداء. ينبغي ترتيب الأولويات قبل التنفيذ.",
      "- تحسين العناوين والوصف.",
      "- قياس سرعة الصفحة والتحقق من نتائج التعديلات.",
      "## الخطوات التالية",
      "أوصي بتنفيذ التغييرات تدريجياً ثم مراجعة المؤشرات."
    ].join("\n");
    expect(hasUsefulAnalyticalContent(answer)).toBe(true);
    expect(hasActionableRecommendations(answer)).toBe(true);
  });

  it("does not treat a long neutral explanation as an actionable task by default", () => {
    const answer = "هذه فقرة وصفية تشرح السياق والمعلومات العامة دون اقتراح أي إجراء أو خطة تنفيذ. ".repeat(8);
    expect(hasUsefulAnalyticalContent(answer)).toBe(true);
    expect(hasActionableRecommendations(answer)).toBe(false);
  });
});
