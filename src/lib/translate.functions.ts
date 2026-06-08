import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders } from "@/lib/lovable-ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chargeTokens } from "@/lib/tokens.server";

const Input = z.object({
  text: z.string().min(1).max(4000),
  sourceLang: z.enum(["ar", "en", "ku"]),
  targetLang: z.enum(["ar", "en", "ku"]),
});

const LANG_NAME: Record<string, string> = {
  ar: "Modern Standard Arabic",
  en: "English",
  ku: "Central Kurdish (Sorani, with Arabic script)",
};

export const translateText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    if (data.sourceLang === data.targetLang) return { text: data.text };

    const charge = await chargeTokens({ userId: context.userId, toolKey: "translate" });
    if (!charge.ok) throw new Error(`quota_exceeded:${charge.reason}`);

    const res = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: lovableAiHeaders(apiKey),
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You translate UI strings for a SaaS product. Translate from ${LANG_NAME[data.sourceLang]} to ${LANG_NAME[data.targetLang]}. Preserve placeholders like {n}, {name}, HTML tags, emoji, and brand names (MAAROOF, ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek, Kimi). Output ONLY the translation — no quotes, no explanations.` },
          { role: "user", content: data.text },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`AI gateway ${res.status}`);
    const json = await res.json();
    const out = String(json?.choices?.[0]?.message?.content ?? "").trim();
    return { text: out || data.text };
  });
