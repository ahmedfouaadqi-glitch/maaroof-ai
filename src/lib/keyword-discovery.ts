// Pure: new-keyword discovery from real ten-engine answers + stratified keyword sampling.
// Nothing is invented: every discovered phrase appears literally in at least one recorded answer.
import type { SheetData } from "./spreadsheet-reader";

export type DiscoveryAnswer = { market: string; engine: string; status: string; answer: string; query?: string; cacheHit?: boolean };
export type DiscoveredKeyword = {
  keyword: string;
  market: string;
  engines: string[];
  answered: number;
  snippet: string;
  confirmed: boolean; // mentioned by at least two engines
  inFile: boolean;
};

const norm = (s: string) => String(s || "").toLocaleLowerCase().replace(/\s+/g, " ").trim();
const NOISE = /\d|https?:|www\.|followers|photos|videos|\.com|@|#/i;

/** Discovery question in the market language; asks for search phrases only. */
export function discoveryQuestion(o: { brand: string; category: string; market: string; competitors: string[]; lang: string }): string {
  const comps = o.competitors.filter(Boolean).slice(0, 4).join(", ");
  if (o.lang === "ar" || o.lang === "ku") {
    return `ما العبارات الحقيقية التي يكتبها العملاء في محركات البحث والمساعدات الذكية عندما يبحثون عن ${o.category} في ${o.market}${comps ? ` (منافسون في السوق: ${comps})` : ""}؟ اذكر 15 عبارة بحث فقط، كل عبارة في سطر يبدأ بشرطة، بلغة السوق، دون شرح ودون اسم ${o.brand}.`;
  }
  return `What real phrases do customers type into search engines and AI assistants when looking for ${o.category} in ${o.market}${comps ? ` (competitors in this market: ${comps})` : ""}? List 15 search phrases only, one per line starting with a dash, in the market's language, with no explanation and without the name ${o.brand}.`;
}

/** Phrases listed in an answer (bullets/numbered lines), 2–6 words, technical noise removed. */
export function extractPhrases(answer: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of String(answer || "").split(/\n|؛|;/)) {
    if (!/^\s*(?:[-*•–]|\d+[.)-])\s*\S/.test(raw)) continue; // only listed lines
    const line = raw.replace(/^\s*(?:[-*•–]|\d+[.)-])\s*/, "").replace(/[«»"“”'`*]/g, "").replace(/[.،,:]+$/, "").trim();
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 6 || NOISE.test(line)) continue;
    const n = norm(line);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(line);
  }
  return out;
}

/** Groups phrases across engines; excludes anything already known (file/site). */
export function discoveryConsensus(answers: DiscoveryAnswer[], known: string[], fileKeywords: string[] = []): DiscoveredKeyword[] {
  const knownSet = new Set(known.map(norm));
  const fileSet = new Set(fileKeywords.map(norm));
  const answeredByMarket = new Map<string, Set<string>>();
  const map = new Map<string, DiscoveredKeyword>();
  for (const a of answers) {
    if (a.status !== "answered") continue;
    answeredByMarket.set(a.market, (answeredByMarket.get(a.market) || new Set()).add(a.engine));
    for (const phrase of extractPhrases(a.answer)) {
      const n = norm(phrase);
      if (knownSet.has(n)) continue;
      const key = a.market + "|" + n;
      const cur = map.get(key) || { keyword: phrase, market: a.market, engines: [], answered: 0, snippet: "", confirmed: false, inFile: fileSet.has(n) };
      if (!cur.engines.includes(a.engine)) cur.engines.push(a.engine);
      if (!cur.snippet) {
        const at = a.answer.toLocaleLowerCase().indexOf(n);
        cur.snippet = a.answer.slice(Math.max(0, at - 40), at + n.length + 40).replace(/\s+/g, " ").trim();
      }
      map.set(key, cur);
    }
  }
  return [...map.values()]
    .map((k) => ({ ...k, answered: answeredByMarket.get(k.market)?.size || 0, confirmed: k.engines.length >= 2 }))
    .sort((a, b) => b.engines.length - a.engines.length || a.keyword.localeCompare(b.keyword));
}

/** Stratified sample: round-robin across tabs (top rows first), skipping already-measured keywords. */
export function stratifiedSample(groups: string[][], limit: number, skip: string[] = []): string[] {
  const skipSet = new Set(skip.map(norm));
  const seen = new Set<string>();
  const queues = groups.map((g) => g.filter((k) => k && !skipSet.has(norm(k))));
  const out: string[] = [];
  let i = 0;
  while (out.length < limit && queues.some((q) => i < q.length)) {
    for (const q of queues) {
      if (out.length >= limit) break;
      const k = q[i];
      if (k === undefined) continue;
      const n = norm(k);
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(k);
    }
    i++;
  }
  return out;
}

/** Keyword lists per sheet (used as sampling strata). */
export function sheetStrata(sheets: SheetData[], keywordColumn: (s: SheetData) => number): string[][] {
  return sheets.filter((s) => !/negative|سلبي/i.test(s.name)).map((s) => {
    const i = keywordColumn(s);
    return i < 0 ? [] : s.rows.map((r) => String(r[i] ?? "").trim()).filter(Boolean);
  });
}

export const DEFAULT_SAMPLE_PER_MARKET = 60;
