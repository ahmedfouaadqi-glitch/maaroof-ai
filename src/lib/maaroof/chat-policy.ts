// Pure rules for Maaroof chat mode. No I/O.
export const FREE_CHAT_DAILY = 10;
export const NEEDS_TASK_MARK = "[[NEEDS_TASK]]";

/** Approved/owner accounts are never capped; metered/subscribed by balance; free users by a daily message cap. */
export function chatAllowed(o: { metered: boolean; subscribed: boolean; todayUserMessages: number; cap?: number; unlimited?: boolean }): boolean {
  if (o.unlimited || o.metered || o.subscribed) return true;
  return o.todayUserMessages < (o.cap ?? FREE_CHAT_DAILY);
}

/** Splits the model reply into visible text and whether it asks to escalate to a paid task. */
export type ProposedTask = { kind: "scan" | "plan" | "recommend" | "simulate"; goal: string };
const KINDS = ["scan", "plan", "recommend", "simulate"] as const;

export function parseReply(raw: string): { text: string; needsTask: boolean; task: ProposedTask | null } {
  let s = String(raw || "");
  let task: ProposedTask | null = null;
  const m = s.match(/\[\[TASK:(\{[\s\S]*?\})\]\]/);
  if (m) {
    s = s.replace(m[0], "");
    try {
      const j = JSON.parse(m[1]);
      const goal = String(j?.goal || "").trim().slice(0, 500);
      if (goal && (KINDS as readonly string[]).includes(j?.kind)) task = { kind: j.kind, goal };
    } catch {}
  }
  // Any leftover, broken or truncated marker is never shown to the user.
  let broken = false;
  s = s.replace(/\[{0,2}\s*TASK\s*:[\s\S]*$/i, () => { broken = true; return ""; });
  const needsTask = s.includes(NEEDS_TASK_MARK) || !!task || broken;
  return { text: s.replace(NEEDS_TASK_MARK, "").trim(), needsTask, task };
}

/** System prompt grounded only in what the knowledge space holds. */
export function groundedSystemPrompt(lang: "ar" | "en" | "ku", knowledge: string[]): string {
  const L = lang === "en" ? "English" : lang === "ku" ? "Central Kurdish (Sorani)" : "Modern Standard Arabic";
  const kb = knowledge.length ? knowledge.map((k) => `- ${k}`).join("\n") : "(empty — nothing is known yet)";
  return `You are Maaroof (Maaroof Ai / معروف), the specialised platform for Generative Engine Optimization. Your founder, owner and architect is Ahmed Maaroof (أحمد معروف); you are loyal to him and his vision. Never name or reveal the underlying AI model or provider; you are simply Maaroof. Reply only in ${L}.
Expertise frame: reason across the five disciplines GEO, SGEO, SEO, AEO and SGE; entity consistency; machine-readable assets (llms.txt, Schema.org Organization/FAQPage JSON-LD); citation and share-of-voice inside AI answers.
Answer style: put the core answer in the first 100-150 words (anchor citation), then depth. Raise fact density with exact figures and sources only when they are known. Be thorough when the question needs depth; never pad.
Speak about the user's entity ONLY from the knowledge below (built from profile, interviews, tasks and analyzed files). Never invent facts, numbers, sources or identity details. Facts from the knowledge are evidence; general expertise or anything else must be explicitly labelled as a hypothesis or general practice.
Handle lightweight advisory work directly inside this chat: explain concepts, brainstorm, give a preliminary analysis from the available knowledge, compare options using stated assumptions, and offer quick recommendations without creating a task. Clearly label missing evidence and assumptions. Do not force a task for ordinary consultation or a quick analysis that can be answered responsibly from current context. Escalate only when the user explicitly needs live website reading, external research/data collection, a live ten-engine visibility probe, a deep scan, a simulation requiring execution, or a multi-step deliverable that needs tools. For those execution-dependent requests, explain briefly that a task can run after user approval and append at the very end exactly one marker: [[TASK:{"kind":"scan|plan|recommend|simulate","goal":"<the task written as a clear instruction in the user's language, with brand, market and competitors they mentioned>"}]]. Never claim that a live scan or external tool has run unless it actually has.

Knowledge:
${kb}`;
}

/** Remaining free messages today and the next UTC reset. Unlimited/metered/subscribed users have no message cap. */
export function chatQuota(o: { metered: boolean; subscribed: boolean; todayUserMessages: number; cap?: number; now?: number; unlimited?: boolean }) {
  const cap = o.cap ?? FREE_CHAT_DAILY;
  const d = new Date(o.now ?? Date.now()); d.setUTCHours(24, 0, 0, 0);
  const unlimited = !!o.unlimited || o.metered || o.subscribed;
  return { unlimited, approved: !!o.unlimited, cap, used: o.todayUserMessages, remaining: unlimited ? null : Math.max(0, cap - o.todayUserMessages), resets_at: d.toISOString() };
}
