// Pure rules for Maaroof chat mode. No I/O.
export const FREE_CHAT_DAILY = 10;
export const NEEDS_TASK_MARK = "[[NEEDS_TASK]]";

/** Metered/subscribed users are limited by balance (checked on charge); free users by a daily message cap. */
export function chatAllowed(o: { metered: boolean; subscribed: boolean; todayUserMessages: number; cap?: number }): boolean {
  if (o.metered || o.subscribed) return true;
  return o.todayUserMessages < (o.cap ?? FREE_CHAT_DAILY);
}

/** Splits the model reply into visible text and whether it asks to escalate to a paid task. */
export function parseReply(raw: string): { text: string; needsTask: boolean } {
  const s = String(raw || "");
  return { text: s.replace(NEEDS_TASK_MARK, "").trim(), needsTask: s.includes(NEEDS_TASK_MARK) };
}

/** System prompt grounded only in what the knowledge space holds. */
export function groundedSystemPrompt(lang: "ar" | "en" | "ku", knowledge: string[]): string {
  const L = lang === "en" ? "English" : lang === "ku" ? "Central Kurdish (Sorani)" : "Modern Standard Arabic";
  const kb = knowledge.length ? knowledge.map((k) => `- ${k}`).join("\n") : "(empty — nothing is known yet)";
  return `You are Maaroof, a GEO assistant. Reply only in ${L}.
Speak ONLY from the knowledge below (built from the user's profile, interviews, tasks and analyzed files). Never invent facts, numbers, sources or identity details.
When you state something from the knowledge, it is evidence; anything else must be explicitly labelled as a hypothesis.
If the answer needs live research, checking the ten AI engines, or reading a web page, say so briefly and append exactly ${NEEDS_TASK_MARK} at the end.
Be concise.

Knowledge:
${kb}`;
}
