// Real platform probes via Lovable AI Gateway.
// Asks Gemini and OpenAI GPT what they actually "know" about a brand, then
// scores the answer 0-100 based on substance, brand recall, and citations.
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders } from "@/lib/lovable-ai";

type Lang = "en" | "ar" | "ku";

const QUESTION: Record<Lang, (b: string, ctx?: string) => string> = {
  en: (b, ctx) => `What do you know about the brand/company "${b}"${ctx ? ` in ${ctx}` : ""}? List concrete facts (location, services, founding, notable mentions) and cite any sources or URLs you recall. If you do not know it, say so clearly.`,
  ar: (b, ctx) => `ماذا تعرف عن العلامة/الشركة "${b}"${ctx ? ` في ${ctx}` : ""}؟ اذكر حقائق محددة (الموقع، الخدمات، التأسيس، الإشارات البارزة) واذكر أي مصادر أو روابط تتذكرها. إذا لم تكن تعرفها فقل ذلك بوضوح.`,
  ku: (b, ctx) => `چی دەزانیت دەربارەی برند/کۆمپانیای "${b}"${ctx ? ` لە ${ctx}` : ""}؟ ڕاستی دیاریکراو بنووسە (شوێن، خزمەتگوزاری، دامەزراندن، ئاماژە) و هەر سەرچاوەیەک یان بەستەرێک بێنە. ئەگەر نازانیت بە ڕوونی بڵێ.`,
};

const UNKNOWN_PATTERNS = /\b(i (don'?t|do not) (know|have)|no (reliable|specific|verifiable) (information|data)|not (familiar|aware)|cannot (find|confirm)|unable to (find|locate))\b|لا أعرف|ليس لديّ|لا توجد معلومات|نازانم|زانیاریم نییە/i;

function scoreAnswer(brand: string, answer: string): number {
  const text = (answer || "").trim();
  if (!text) return 0;

  // Hard "I don't know" → very low
  if (UNKNOWN_PATTERNS.test(text) && text.length < 600) return 5;

  let score = 0;
  // Length / substance (max 35)
  score += Math.min(35, Math.round(text.length / 30));
  // Brand recall (max 15)
  const lower = text.toLowerCase();
  const brandLower = brand.toLowerCase();
  const mentions = (lower.match(new RegExp(brandLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  score += Math.min(15, mentions * 5);
  // URL / citation count (max 25)
  const urls = text.match(/https?:\/\/[^\s)\]]+/g) || [];
  score += Math.min(25, urls.length * 8);
  // Concrete signal words (max 25)
  const signals = /(founded|established|headquart|located|based in|offers|provides|services|products|website|address|تأسست|تأسس|مقرها|تقدّم|تقدم|خدمات|منتجات|موقع|عنوان|دامەزرا|بنکە|خزمەتگوزاری)/gi;
  const hits = (text.match(signals) || []).length;
  score += Math.min(25, hits * 4);

  return Math.max(0, Math.min(100, score));
}

async function probe(model: string, brand: string, lang: Lang, market: string | undefined, apiKey: string): Promise<number | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: lovableAiHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Answer strictly from your own knowledge. Do not browse. If you do not know the entity, say so honestly. Be concise (under 200 words) and include any URLs or named sources you recall." },
          { role: "user", content: QUESTION[lang](brand, market) },
        ],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      if (res.status === 429 || res.status === 402) return null;
      return null;
    }
    const data: any = await res.json();
    const content = String(data?.choices?.[0]?.message?.content || "");
    return scoreAnswer(brand, content);
  } catch {
    return null;
  }
}

/**
 * Probe Gemini and ChatGPT (via Lovable Gateway) for what they know about a brand.
 * Returns measured scores for both keys; either may be null on failure.
 */
export async function probePlatforms(
  brand: string,
  lang: Lang,
  market: string | undefined,
  apiKey: string,
): Promise<{ gemini: number | null; chatgpt: number | null }> {
  const [gemini, chatgpt] = await Promise.all([
    probe("google/gemini-3-flash-preview", brand, lang, market, apiKey),
    probe("openai/gpt-5-mini", brand, lang, market, apiKey),
  ]);
  return { gemini, chatgpt };
}
