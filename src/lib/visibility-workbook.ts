/**
 * Pure builder for the three-sheet visibility workbook.
 * Every value comes from the recorded probe; missing evidence reads "not measured" with a reason.
 */
export type WbLang = "ar" | "en" | "ku";
export type WbSheet = { name: string; rows: (string | number)[][] };

type Answer = {
  engine: string; mentioned?: boolean; rank?: number | null; answer?: string; grounded_answer?: string;
  brands?: string[]; cited_urls?: string[]; sources?: { url: string; title?: string }[];
};
export type ProbeLike = {
  blind_query?: string; category?: string; official_website?: string; asked?: string[];
  answers?: Answer[]; evidence?: { url: string; title?: string }[];
};

const L = (lang: WbLang, ar: string, en: string, ku: string) => (lang === "ar" ? ar : lang === "ku" ? ku : en);
const norm = (s: string) => s.trim().toLowerCase();

export function rate(numerator: number, denominator: number): { value_pct: number | null; numerator: number; denominator: number } {
  return { value_pct: denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : null, numerator, denominator };
}

/** Blind: brand named in the unbranded competitive answer. */
export function blindRecommendationRate(brand: string, answers: Answer[]) {
  const answered = answers.filter((a) => (a.answer || "").trim());
  return rate(answered.filter((a) => a.mentioned).length, answered.length);
}

/** Direct: engine answered the branded question and its answer names the brand. */
export function directRecognitionRate(brand: string, answers: Answer[]) {
  const b = norm(brand);
  const answered = answers.filter((a) => (a.grounded_answer || "").trim());
  return rate(answered.filter((a) => b && norm(a.grounded_answer || "").includes(b)).length, answered.length);
}

/** Competitor share = engines naming the competitor / engines that answered the blind question. */
export function competitorShares(brand: string, answers: Answer[]) {
  const b = norm(brand);
  const answered = answers.filter((a) => (a.answer || "").trim());
  const map = new Map<string, { name: string; engines: Set<string> }>();
  for (const a of answered) {
    for (const raw of a.brands || []) {
      const k = norm(raw);
      if (!k || k === b) continue;
      if (!map.has(k)) map.set(k, { name: raw.trim(), engines: new Set() });
      map.get(k)!.engines.add(a.engine);
    }
  }
  return [...map.values()]
    .map((x) => ({ name: x.name, engines: [...x.engines], share: rate(x.engines.size, answered.length) }))
    .sort((x, y) => y.engines.length - x.engines.length);
}

const fmt = (r: { value_pct: number | null; numerator: number; denominator: number }, lang: WbLang) =>
  r.value_pct == null ? L(lang, "لم تُقَس — لا توجد إجابات", "Not measured — no answers", "نەپێوراوە — وەڵام نییە") : `${r.value_pct}% (${r.numerator}/${r.denominator})`;

export function buildVisibilityWorkbook(brand: string, probe: ProbeLike, lang: WbLang, engineLabel: (k: string) => string = (k) => k): WbSheet[] {
  const answers = probe.answers || [];
  const asked = probe.asked || [];
  const NM = L(lang, "لم تُقَس", "Not measured", "نەپێوراوە");

  const summary: WbSheet = {
    name: L(lang, "ملخص الفحص", "Executive summary", "پوختە"),
    rows: [
      [L(lang, "البند", "Item", "بڕگە"), L(lang, "القيمة", "Value", "بەها")],
      [L(lang, "العلامة", "Brand", "براند"), brand],
      [L(lang, "الفئة", "Category", "پۆل"), probe.category || NM],
      [L(lang, "الموقع الرسمي", "Official website", "ماڵپەڕ"), probe.official_website || NM],
      [L(lang, "المحركات المجيبة", "Engines answered", "بزوێنەری وەڵامدەر"), `${answers.length}/${asked.length || answers.length}`],
      [L(lang, "معدل الترشيح الأعمى", "Blind recommendation rate", "ڕێژەی پێشنیاری بێناو"), fmt(blindRecommendationRate(brand, answers), lang)],
      [L(lang, "معدل المعرفة المباشرة", "Direct recognition rate", "ڕێژەی ناسینی ڕاستەوخۆ"), fmt(directRecognitionRate(brand, answers), lang)],
      [L(lang, "السؤال الأعمى", "Blind question", "پرسیاری بێناو"), probe.blind_query || NM],
      [L(lang, "أساس القياس", "Basis", "بنەما"), L(lang, "فحص حي لإجابات المحركات", "Live engine answers", "وەڵامی زیندوو")],
    ],
  };

  const answered = new Set(answers.map((a) => a.engine));
  const engineRows = answers.map((a) => [
    engineLabel(a.engine),
    a.mentioned ? L(lang, "نعم", "Yes", "بەڵێ") : L(lang, "لا", "No", "نەخێر"),
    a.rank ?? "—",
    (a.answer || NM).slice(0, 30000),
    (a.grounded_answer || NM).slice(0, 30000),
    (a.cited_urls || []).join("\n") || "—",
  ]);
  for (const e of asked) if (!answered.has(e)) engineRows.push([engineLabel(e), NM, "—", L(lang, "لم يُجب المحرك", "Engine did not answer", "وەڵامی نەدایەوە"), NM, "—"]);
  const competitors: WbSheet = {
    name: L(lang, "المنافسون والمحركات", "Competitors & engines", "ڕکابەران"),
    rows: [
      [L(lang, "المنافس", "Competitor", "ڕکابەر"), L(lang, "الحصة", "Share", "بەش"), L(lang, "المحركات", "Engines", "بزوێنەرەکان")],
      ...competitorShares(brand, answers).map((c) => [c.name, fmt(c.share, lang), c.engines.map(engineLabel).join("، ")]),
      [],
      [L(lang, "المحرك", "Engine", "بزوێنەر"), L(lang, "ذُكرت العلامة", "Brand mentioned", "ناوهاتن"), L(lang, "الترتيب", "Rank", "ڕیز"), L(lang, "إجابة السؤال الأعمى", "Blind answer", "وەڵامی بێناو"), L(lang, "إجابة السؤال المباشر", "Direct answer", "وەڵامی ڕاستەوخۆ"), L(lang, "روابط مستشهد بها", "Cited links", "بەستەرەکان")],
      ...engineRows,
    ],
  };

  const links = new Map<string, string>();
  for (const e of probe.evidence || []) if (e?.url) links.set(e.url, e.title || "");
  for (const a of answers) for (const s of a.sources || []) if (s?.url && !links.has(s.url)) links.set(s.url, s.title || "");
  const evidence: WbSheet = {
    name: L(lang, "الأدلة والروابط", "Evidence & links", "بەڵگەکان"),
    rows: [
      [L(lang, "الرابط", "URL", "بەستەر"), L(lang, "العنوان", "Title", "ناونیشان")],
      ...(links.size ? [...links].map(([u, t]) => [u, t || "—"]) : [[NM, L(lang, "لم تُسجَّل روابط في هذا الفحص", "No links recorded in this run", "هیچ بەستەرێک تۆمار نەکراوە")]]),
    ],
  };
  return [summary, competitors, evidence];
}

export async function downloadVisibilityWorkbook(title: string, sheets: WbSheet[], rtl: boolean) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31), { views: [{ rightToLeft: rtl }] });
    s.rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => { c.width = 32; c.alignment = { wrapText: true, vertical: "top" }; });
  }
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = `${title.replace(/[\\/?*[\]:]/g, "_")}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
