// Architecture & Concept: Ahmed Maaroof
// Pure comparison between the two latest live probes. No numbers without both runs.

export type ProbeSnap = { at: string; mentioned: number; total: number };

export function compareProbes(runs: ProbeSnap[], lang: "ar" | "en" | "ku" = "ar"): string | null {
  const s = [...(runs || [])].filter((r) => r && r.total > 0).sort((a, b) => b.at.localeCompare(a.at));
  if (s.length < 2) return null;
  const [now, prev] = s;
  const date = prev.at.slice(0, 10);
  if (lang === "en") return `Mentioned in ${now.mentioned} of ${now.total} models, vs ${prev.mentioned} of ${prev.total} in the previous check (${date}).`;
  if (lang === "ku") return `لە ${now.mentioned} لە ${now.total} مۆدێل ناوت هات، بەراورد بە ${prev.mentioned} لە ${prev.total} لە پشکنینی پێشوو (${date}).`;
  return `ظهرت في ${now.mentioned} من ${now.total} نماذج، مقابل ${prev.mentioned} من ${prev.total} في الفحص السابق (${date}).`;
}
