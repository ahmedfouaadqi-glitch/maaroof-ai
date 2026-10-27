// Pure helpers for «دردشة» (unified chat + tasks). No I/O.
export type DardashaAttachment = { name: string; analysis: string };

/** Message sent to the chat: the user's text plus analyzed attachment summaries as context. */
export const MAX_DARDASHA_MESSAGE_CHARS = 12000;

export function composeChatMessage(text: string, atts: DardashaAttachment[]): string {
  const t = text.trim();
  const ctx = atts.filter((a) => a.analysis.trim()).map((a) => `[مرفق: ${a.name}] ${a.analysis.trim().slice(0, 600)}`);
  return [t, ...ctx].filter(Boolean).join("\n\n");
}

/** A task may start only after an explicit approval click on a proposed task with a goal. */
export function canStartTask(p: { approved: boolean; goal: string; running: boolean }): boolean {
  return p.approved && p.goal.trim().length > 0 && !p.running;
}

/** Automatic run options — no manual toggles in the UI. */
export const AUTO_RUN_OPTIONS = { salvage_on_failure: true, focused_plan: false, parallel_tools: false } as const;
