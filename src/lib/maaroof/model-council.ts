// Architecture & Concept: Ahmed Maaroof
// Pure, zero-cost layer over REAL live engine answers:
// - a stated reason for every "not mentioned",
// - a council summary (agreement / disagreement / decision) built only from those answers,
// - scrubbing of model versions / proxy wording so users only see brand names.

export type ProbeAnswer = { engine: string; mentioned: boolean; rank: number | null; answer: string; brands: string[]; reason?: string };
type L = "ar" | "en" | "ku";
const t = (l: L, ar: string, en: string, ku?: string) => (l === "en" ? en : l === "ku" ? ku || ar : ar);

export function notMentionedReason(a: ProbeAnswer, brand: string, lang: L = "ar"): string | null {
  if (a.mentioned) return null;
  if (!a.answer && !a.brands.length) return t(lang, "لم يُرجع النموذج إجابة في الوقت المحدد.", "The engine returned no answer in time.", "بزوێنەر وەڵامی نەدایەوە.");
  if (a.brands.length) return t(lang, `لم يُعثر على ذكر قابل للتحقق لـ«${brand}»؛ النموذج رشّح بدلاً منه: ${a.brands.slice(0, 3).join("، ")}. السبب المرجح: نقص مصادر موثوقة تربط العلامة بهذا الموضوع.`, `No verifiable mention of "${brand}"; the engine recommended instead: ${a.brands.slice(0, 3).join(", ")}. Likely reason: too few trusted sources linking the brand to this topic.`);
  return t(lang, `لم يُعثر على ذكر قابل للتحقق لـ«${brand}» ولم يرشح النموذج علامات محددة. السبب المرجح: غياب صفحة تعريف واضحة أو مصدر رسمي.`, `No verifiable mention of "${brand}" and no specific brands named. Likely reason: no clear definition page or official source.`);
}

export function withReasons(answers: ProbeAnswer[], brand: string, lang: L = "ar"): ProbeAnswer[] {
  return answers.map((a) => (a.mentioned ? a : { ...a, reason: notMentionedReason(a, brand, lang) || undefined }));
}

export type CouncilSummary = { asked: number; answered: number; mentionedBy: string[]; silentOn: string[]; consensusBrands: string[]; agreement: string; disagreement: string | null; decision: string };

export function councilFromProbe(answers: ProbeAnswer[], asked: string[], brand: string, lang: L = "ar", nameOf: (k: string) => string = (k) => k): CouncilSummary {
  const mentionedBy = answers.filter((a) => a.mentioned).map((a) => nameOf(a.engine));
  const silentOn = answers.filter((a) => !a.mentioned).map((a) => nameOf(a.engine));
  const count = new Map<string, number>();
  for (const a of answers) for (const b of new Set(a.brands.map((x) => x.trim()).filter(Boolean))) count.set(b, (count.get(b) || 0) + 1);
  const consensusBrands = [...count.entries()].filter(([, n]) => n >= 2).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([b]) => b);
  const n = answers.length;
  const agreement = n === 0
    ? t(lang, "لم يُرجع أي نموذج إجابة، لا يمكن عقد المجلس.", "No engine answered; the council could not convene.")
    : consensusBrands.length
      ? t(lang, `اتفق أكثر من نموذج على ترشيح: ${consensusBrands.join("، ")}.`, `Several engines agreed on: ${consensusBrands.join(", ")}.`)
      : t(lang, "لم تتفق النماذج على علامة واحدة؛ الإجابات متفرقة.", "Engines did not agree on any brand; answers are scattered.");
  const disagreement = mentionedBy.length && silentOn.length
    ? t(lang, `خلاف: ذكر «${brand}» ${mentionedBy.join("، ")} بينما لم يذكرها ${silentOn.join("، ")}.`, `Disagreement: ${mentionedBy.join(", ")} mention "${brand}" while ${silentOn.join(", ")} do not.`)
    : null;
  const ratio = n ? mentionedBy.length / n : 0;
  const decision = n === 0 ? t(lang, "أعد المحاولة لاحقاً؛ لم تُخصم كلفة بلا نتيجة.", "Retry later.")
    : ratio >= 0.6 ? t(lang, `القرار: حضور قوي (${mentionedBy.length}/${n}). ركّز على تثبيت الترتيب وتوسيع المواضيع.`, `Decision: strong presence (${mentionedBy.length}/${n}). Consolidate rank and expand topics.`)
    : ratio > 0 ? t(lang, `القرار: حضور جزئي (${mentionedBy.length}/${n}). عالج أسباب الغياب لدى النماذج الصامتة أولاً.`, `Decision: partial presence (${mentionedBy.length}/${n}). Fix absence reasons on silent engines first.`)
    : t(lang, `القرار: غياب تام (0/${n}). ابدأ بمصدر رسمي وصفحة تعريف وبيانات مهيكلة.`, `Decision: absent (0/${n}). Start with an official source, definition page and structured data.`);
  return { asked: asked.length, answered: n, mentionedBy, silentOn, consensusBrands, agreement, disagreement, decision };
}

const MODEL_ID = /\b(?:google|openai|anthropic|x-ai|mistralai|deepseek|moonshotai|qwen|meta-llama|perplexity)\/[\w.:-]+/gi;
const VERSIONED = /\b(gpt|gemini|claude|grok|mistral|deepseek|kimi|qwen|sonar)[-\s]?\d[\w.-]*(?:[-\s](?:flash|pro|lite|mini|nano|turbo|preview|sonnet|opus|haiku))*\b/gi;
const PROXY = /\s*(?:\((?:via|عبر)[^)]*\)|\b(?:via|through)\s+(?:a\s+)?proxy\b|عبر\s+(?:بروكسي|وسيط)|\bproxy\b|بروكسي)/gi;
const BRAND: Record<string, string> = { gpt: "ChatGPT", gemini: "Gemini", claude: "Claude", grok: "Grok", mistral: "Mistral", deepseek: "DeepSeek", kimi: "Kimi", qwen: "Qwen", sonar: "Perplexity" };

/** Replace model ids / versions with the plain engine brand and drop proxy wording. */
export function scrubModelNames(s: string): string {
  if (!s) return s;
  return s
    .replace(MODEL_ID, (m) => { const p = m.split("/")[1].toLowerCase(); const k = Object.keys(BRAND).find((b) => p.startsWith(b)); return k ? BRAND[k] : "AI"; })
    .replace(VERSIONED, (_m, fam: string) => BRAND[fam.toLowerCase()] || fam)
    .replace(PROXY, "")
    .replace(/\s{2,}/g, " ");
}

/** User-facing: the model running behind Maaroof is shown as "Maaroof" / «معروف», never its technical id. */
export function brandModelIds(s: string, lang: "ar" | "en" | "ku" = "ar"): string {
  if (!s) return s;
  const name = lang === "en" ? "Maaroof" : "معروف";
  return s.replace(MODEL_ID, name).replace(PROXY, "").replace(/\s{2,}/g, " ");
}
