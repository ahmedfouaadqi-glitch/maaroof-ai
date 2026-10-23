// Pure: full export payload for a workspace task — every tool output, the ten
// engines' answers, real links, and the machine pack for the examined entity.
import type { ExportPayload, ExportSection, ExportLang } from "@/lib/exports";
import { packSections, linksSection, entityFromResult, engineAnswerSections, engineAnswersOf } from "@/lib/machine-pack";
import { payloadFromResult } from "@/lib/export-bus";

export type TaskToolResult = { tool: string; ok: boolean; output: any };
const BANNED = /fire\s*crawl/gi;

const TX = {
  ar: { summary: "الخلاصة", engines: "إجابات المحركات", tool: "نتيجة الأداة" },
  en: { summary: "Summary", engines: "Engine answers", tool: "Tool result" },
  ku: { summary: "پوختە", engines: "وەڵامی بزوێنەرەکان", tool: "ئەنجامی ئامراز" },
};

function scrub<T>(v: T): T {
  return JSON.parse(JSON.stringify(v).replace(BANNED, "Maaroof")) as T;
}

export function buildTaskExportPayload(i: { title: string; goal: string; finalText: string; results: TaskToolResult[]; lang: ExportLang; markets?: string[] }): ExportPayload {
  const T = TX[i.lang] || TX.en;
  const ok = i.results.filter((r) => r.ok && r.output && typeof r.output === "object" && !r.output.skipped);
  const sections: ExportSection[] = [];
  if (i.finalText.trim()) sections.push({ heading: T.summary, kind: "text", text: i.finalText });
  for (const r of ok) {
    const sub = payloadFromResult(r.tool, r.output).sections;
    if (sub.length) sections.push({ heading: `${T.tool}: ${r.tool}`, kind: "text", text: "" }, ...sub);
  }
  const answers = ok.filter((r) => engineAnswersOf(r.output).length);
  if (answers.length) {
    sections.push({ heading: T.engines, kind: "text", text: "" });
    for (const r of answers) sections.push(...engineAnswerSections(r.output, i.lang));
  }
  const entity = ok.map((r) => entityFromResult(r.output)).find(Boolean) || null;
  if (entity) {
    sections.push(...packSections({
      brand: entity.brand, site: entity.site, summary: entity.summary, markets: i.markets,
      onboarding: { facts: (entity.facts || []).join("\n"), links: [entity.site, ...(entity.links || [])].filter(Boolean).join("\n"), faqs: entity.faqs },
    } as any, i.lang));
  }
  sections.push(linksSection(sections, i.lang));
  return scrub({ title: i.title, subtitle: i.goal, sections, lang: i.lang } as ExportPayload);
}
