// Cognitive layer — server-only helpers.
// Detect user intent from tool runs and update user_intent_profile so every
// future tool call can inject the context into its system prompt.

import type { SupabaseClient } from "@supabase/supabase-js";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders, extractJsonObject } from "@/lib/lovable-ai";

export type DetectedIntent = {
  primary_goal: "growth" | "crisis" | "competitor" | "launch" | "retention" | "exploration";
  audience: string;
  gap: string;
  opportunity: string;
  urgency: "low" | "medium" | "high";
  next_tool: string;
  next_reason_ar: string;
  next_reason_en: string;
  next_reason_ku: string;
};

export type IntentProfile = {
  detected_intent: Partial<DetectedIntent> | null;
  context_summary: string | null;
  last_signals: Array<{ tool: string; at: string; input?: string; output?: string }>;
  signal_count: number;
};

export const EMPTY_PROFILE: IntentProfile = {
  detected_intent: null,
  context_summary: null,
  last_signals: [],
  signal_count: 0,
};

export async function loadIntentProfile(admin: SupabaseClient, userId: string | null | undefined): Promise<IntentProfile> {
  if (!userId) return EMPTY_PROFILE;
  try {
    const { data } = await admin
      .from("user_intent_profile")
      .select("detected_intent, context_summary, last_signals, signal_count")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return EMPTY_PROFILE;
    return {
      detected_intent: (data.detected_intent as any) || null,
      context_summary: (data.context_summary as any) || null,
      last_signals: Array.isArray(data.last_signals) ? (data.last_signals as any) : [],
      signal_count: Number((data as any).signal_count || 0),
    };
  } catch {
    return EMPTY_PROFILE;
  }
}

export function buildIntentHint(profile: IntentProfile, lang: "ar" | "en" | "ku" = "en"): string {
  const intent = profile.detected_intent;
  if (!intent && !profile.context_summary) return "";
  const labels = {
    ar: { title: "إدراك النية — استخدم هذا السياق لتعزيز الجواب:", goal: "الهدف", audience: "الجمهور", gap: "الفجوة", op: "الفرصة", urg: "الإلحاح", sum: "ملخص السياق" },
    ku: { title: "تێگەیشتنی مەبەست — ئەم سیاقە بەکار بهێنە بۆ باشترکردنی وەڵام:", goal: "ئامانج", audience: "ئامانجدار", gap: "بۆشایی", op: "هەلومەرج", urg: "پەلە", sum: "پوختەی سیاق" },
    en: { title: "Intent awareness — use this context to sharpen the answer:", goal: "Goal", audience: "Audience", gap: "Gap", op: "Opportunity", urg: "Urgency", sum: "Context summary" },
  } as const;
  const L = labels[lang] || labels.en;
  const lines: string[] = [L.title];
  if (intent?.primary_goal) lines.push(`- ${L.goal}: ${intent.primary_goal}`);
  if (intent?.audience) lines.push(`- ${L.audience}: ${intent.audience}`);
  if (intent?.gap) lines.push(`- ${L.gap}: ${intent.gap}`);
  if (intent?.opportunity) lines.push(`- ${L.op}: ${intent.opportunity}`);
  if (intent?.urgency) lines.push(`- ${L.urg}: ${intent.urgency}`);
  if (profile.context_summary) lines.push(`- ${L.sum}: ${profile.context_summary}`);
  return "\n\n" + lines.join("\n");
}

const MAX_SUMMARY = 500;
const MAX_SIGNALS = 10;
const MAX_TEXT = 600;

function clip(s: any, max = MAX_TEXT): string {
  const v = typeof s === "string" ? s : (() => { try { return JSON.stringify(s); } catch { return String(s); } })();
  return v.length > max ? v.slice(0, max) + "…" : v;
}

/** Call Lovable AI to extract intent from the latest tool run + prior context. */
export async function extractIntent(params: {
  apiKey: string;
  prev: IntentProfile;
  toolKey: string;
  inputSummary: string;
  outputSummary: string;
  knownTools: string[];
}): Promise<DetectedIntent | null> {
  const { apiKey, prev, toolKey, inputSummary, outputSummary, knownTools } = params;

  const system = `You are an intent-detection engine for a GEO/SEO marketing platform. From a user's latest tool run and prior context, infer their underlying goal, audience, gap, opportunity, and urgency. Output STRICT JSON only, no prose, matching this schema:
{
  "primary_goal": "growth"|"crisis"|"competitor"|"launch"|"retention"|"exploration",
  "audience": string (<=80 chars),
  "gap": string (<=120 chars),
  "opportunity": string (<=120 chars),
  "urgency": "low"|"medium"|"high",
  "next_tool": one of [${knownTools.map((k) => `"${k}"`).join(",")}],
  "next_reason_ar": string (<=140 chars, Arabic),
  "next_reason_en": string (<=140 chars, English),
  "next_reason_ku": string (<=140 chars, Sorani Kurdish)
}
Pick next_tool as the single most useful next action for the user. Be precise and conservative — never invent facts.`;

  const userMsg = `LATEST TOOL: ${toolKey}
LATEST INPUT (truncated): ${clip(inputSummary)}
LATEST OUTPUT (truncated): ${clip(outputSummary)}

PRIOR CONTEXT SUMMARY: ${clip(prev.context_summary || "(none)")}
PRIOR INTENT: ${clip(prev.detected_intent || "(none)", 300)}

Return JSON only.`;

  try {
    const r = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: lovableAiHeaders(apiKey),
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    const content = j?.choices?.[0]?.message?.content || "";
    const parsed = extractJsonObject<DetectedIntent>(content);
    if (!parsed || !parsed.primary_goal) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Roll prior signals + add the latest one, capped to MAX_SIGNALS. */
export function rollSignals(prev: IntentProfile, signal: { tool: string; input?: string; output?: string }): IntentProfile["last_signals"] {
  const next = [
    { tool: signal.tool, at: new Date().toISOString(), input: clip(signal.input || "", 240), output: clip(signal.output || "", 240) },
    ...prev.last_signals,
  ];
  return next.slice(0, MAX_SIGNALS);
}

/** Merge a fresh intent into a rolling context summary. Kept short and human-readable. */
export function mergeContextSummary(prev: IntentProfile, fresh: DetectedIntent | null): string {
  const parts: string[] = [];
  if (fresh) {
    parts.push(`goal=${fresh.primary_goal}`);
    if (fresh.audience) parts.push(`aud=${fresh.audience}`);
    if (fresh.gap) parts.push(`gap=${fresh.gap}`);
    if (fresh.opportunity) parts.push(`op=${fresh.opportunity}`);
    if (fresh.urgency) parts.push(`urg=${fresh.urgency}`);
  }
  const newLine = parts.join(" · ");
  const base = prev.context_summary ? `${prev.context_summary}\n${newLine}` : newLine;
  return base.length > MAX_SUMMARY ? base.slice(base.length - MAX_SUMMARY) : base;
}
