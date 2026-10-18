import { ENGINE_LIST, type EngineKey } from "@/lib/ai-engines";

export type EngineFailureCode = "unavailable" | "rate_limit" | "unauthorized" | "invalid_response" | "network";

export type EngineInterviewOutcome = {
  engineKey: EngineKey;
  question?: string | null;
  failureCode?: EngineFailureCode;
};

export type SpaceInterviewRow = {
  space_id: string;
  user_id: string;
  question: string;
  topic: string;
  engine_key: EngineKey;
  engine_name: string;
  generation_status: "ready" | "failed";
  engine_order: number;
  failure_reason: string | null;
};

export type ExistingEngineInterviewRow = {
  engine_key: string;
  generation_status: string;
};

export function enginesNeedingQuestions(
  existing: ExistingEngineInterviewRow[],
): EngineKey[] {
  const ready = new Set(
    existing.filter((row) => row.generation_status === "ready").map((row) => row.engine_key),
  );
  return ENGINE_LIST.filter((engine) => !ready.has(engine.key)).map((engine) => engine.key);
}

export const ENGINE_PERSPECTIVES: Record<EngineKey, string> = {
  chatgpt: "clarify user intent, structure, and measurable outcomes",
  gemini: "connect the knowledge space context and identify missing relationships",
  claude: "surface nuance, constraints, and overlooked assumptions",
  perplexity: "identify factual gaps and what evidence would verify them",
  copilot: "focus on implementation steps, ownership, and operational use",
  grok: "challenge assumptions and ask what could invalidate the current understanding",
  mistral: "ask a concise technical or domain-specific question",
  deepseek: "trace causes, dependencies, and reasoning gaps",
  kimi: "consider longer-term context and information that may be missing over time",
  qwen: "check practical clarity and whether the knowledge works across languages and audiences",
};

export function engineFailureReason(
  locale: string,
  code: EngineFailureCode = "unavailable",
): string {
  const messages = {
    ar: {
      unavailable: "هذا المحرك غير متاح حالياً. يمكنك إعادة المحاولة.",
      rate_limit: "المحرك مشغول حالياً. حاول مرة أخرى لاحقاً.",
      unauthorized: "تعذر الوصول إلى المحرك حالياً.",
      invalid_response: "تعذر إنشاء سؤال صالح من هذا المحرك.",
      network: "تعذر الاتصال بالمحرك. يمكنك إعادة المحاولة.",
    },
    en: {
      unavailable: "This engine is currently unavailable. You can retry.",
      rate_limit: "This engine is busy. Try again shortly.",
      unauthorized: "This engine could not be reached.",
      invalid_response: "This engine did not produce a valid question.",
      network: "The engine could not be reached. You can retry.",
    },
    ku: {
      unavailable: "ئەم مۆتۆڕە ئێستا بەردەست نییە؛ دەتوانیت دووبارە هەوڵ بدەیتەوە.",
      rate_limit: "ئەم مۆتۆڕە ئێستا سەرقاڵە؛ دواتر دووبارە هەوڵ بدەوە.",
      unauthorized: "ئێستا نەکرا پەیوەندی بە مۆتۆڕەکەوە بکرێت.",
      invalid_response: "مۆتۆڕەکە پرسیارێکی دروستی بەرهەم نەهێنا.",
      network: "پەیوەندی بە مۆتۆڕەکەوە نەکرا؛ دەتوانیت دووبارە هەوڵ بدەیتەوە.",
    },
  } as const;
  const lang = locale === "en" || locale === "ku" ? locale : "ar";
  return messages[lang][code];
}

export function buildSpaceInterviewRows(
  spaceId: string,
  userId: string,
  locale: string,
  outcomes: EngineInterviewOutcome[],
): SpaceInterviewRow[] {
  const byKey = new Map(outcomes.map((outcome) => [outcome.engineKey, outcome]));
  return ENGINE_LIST.map((engine, engine_order) => {
    const outcome = byKey.get(engine.key);
    const question = typeof outcome?.question === "string" ? outcome.question.trim().slice(0, 1000) : "";
    const ready = question.length > 0;
    return {
      space_id: spaceId,
      user_id: userId,
      question: ready ? question : "",
      topic: "gap",
      engine_key: engine.key,
      engine_name: engine.name,
      engine_order,
      generation_status: ready ? "ready" : "failed",
      failure_reason: ready ? null : engineFailureReason(locale, outcome?.failureCode || "unavailable"),
    };
  });
}
