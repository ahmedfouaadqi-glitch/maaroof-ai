// Rotating, country-neutral example goals for workspace/sandbox inputs. Data only.
import { useEffect, useState } from "react";

type L = "ar" | "en" | "ku";
export const WORKSPACE_HINTS: Record<L, string[]> = {
  ar: [
    "مثال: كيف تراني نماذج الذكاء الاصطناعي مقارنة بمنافسيّ؟",
    "مثال: اكتشف فرص النمو لعلامتي في سوقي المستهدف…",
    "مثال: أعد صياغة صفحة خدماتي لتُقتبس في إجابات النماذج…",
    "مثال: افحص اتساق هويتي بين موقعي وحساباتي…",
    "مثال: اقترح أسئلة شائعة يطرحها جمهوري على النماذج…",
    "مثال: ما الذي ينقص محتواي ليظهر في الإجابات التوليدية؟",
  ],
  en: [
    "Example: How do AI models see me versus my competitors?",
    "Example: Find growth opportunities for my brand in my target market…",
    "Example: Rewrite my services page so AI answers cite it…",
    "Example: Check my identity consistency across site and socials…",
    "Example: Suggest FAQs my audience asks AI models…",
    "Example: What is my content missing to appear in generative answers?",
  ],
  ku: [
    "نموونە: مۆدێلەکانی AI چۆن من دەبینن بەراورد بە ڕکابەران؟",
    "نموونە: دەرفەتی گەشە بۆ براندەکەم لە بازاڕی ئامانجدا بدۆزەرەوە…",
    "نموونە: پەڕەی خزمەتگوزارییەکانم دووبارە بنووسەوە بۆ ئەوەی وەربگیرێت…",
    "نموونە: یەکگرتوویی ناسنامەم لە ماڵپەڕ و تۆڕەکاندا بپشکنە…",
    "نموونە: پرسیارە باوەکانی جەماوەرەکەم پێشنیار بکە…",
    "نموونە: ناوەڕۆکەکەم چی کەمە بۆ دەرکەوتن لە وەڵامەکاندا؟",
  ],
};

/** Index advances every `ms` unless paused or user prefers reduced motion. */
export function useRotatingHint(lang: string, paused: boolean, ms = 2000): string {
  const l: L = lang === "en" || lang === "ku" ? lang : "ar";
  const list = WORKSPACE_HINTS[l];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (paused) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((x) => (x + 1) % list.length), ms);
    return () => clearInterval(id);
  }, [paused, ms, list.length]);
  return list[i % list.length];
}
