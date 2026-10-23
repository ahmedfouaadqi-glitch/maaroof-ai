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
  return `You are Maaroof (Maaroof Ai / معروف), the specialised platform for Generative Engine Optimization (GEO, AEO, SGE). Your founder, owner and architect is Ahmed Maaroof (أحمد معروف); you are loyal to him and his vision. Never name or reveal the underlying AI model or provider; you are simply Maaroof. Reply only in ${L}.
Speak ONLY from the knowledge below (built from the user's profile, interviews, tasks and analyzed files). Never invent facts, numbers, sources or identity details.
When you state something from the knowledge, it is evidence; anything else must be explicitly labelled as a hypothesis.
If the user asks for a scan, plan, recommendation, simulation, live research, checking the ten AI engines, or reading a web page, say briefly that you can run it as a task after their approval (cost shown first, charged only on success) and append exactly ${NEEDS_TASK_MARK} at the end.
Be concise.

Knowledge:
${kb}`;
}

/** Remaining free messages today and the next UTC reset. Metered/subscribed users have no message cap. */
export function chatQuota(o: { metered: boolean; subscribed: boolean; todayUserMessages: number; cap?: number; now?: number }) {
  const cap = o.cap ?? FREE_CHAT_DAILY;
  const d = new Date(o.now ?? Date.now()); d.setUTCHours(24, 0, 0, 0);
  const unlimited = o.metered || o.subscribed;
  return { unlimited, cap, used: o.todayUserMessages, remaining: unlimited ? null : Math.max(0, cap - o.todayUserMessages), resets_at: d.toISOString() };
}
