/** Evidence-only final answer used when a final drafting model times out or fails. */
export type FinalizerToolResult = { tool: string; ok: boolean; output?: unknown };

function conciseEvidence(value: unknown, maxChars = 1300): string {
  let serialized = "";
  try { serialized = JSON.stringify(value ?? null, null, 2); }
  catch { serialized = String(value ?? ""); }
  return serialized.length > maxChars ? serialized.slice(0, maxChars) + "\n… (truncated)" : serialized;
}

export function buildEvidenceFinalAnswer(
  goal: string,
  results: FinalizerToolResult[],
  language: "ar" | "en" | "ku",
  market: string,
): string {
  const successful = results.filter((result) => result.ok);
  const failed = results.filter((result) => !result.ok);
  const ar = language === "ar";
  const ku = language === "ku";
  const title = ar ? "تقرير احتياطي مبني على النتائج المسجلة" : ku ? "ڕاپۆرتی جێگرەوەی پشتبەستوو بە ئەنجامە تۆمارکراوەکان" : "Evidence-based fallback report";
  const goalLabel = ar ? "الهدف" : ku ? "ئامانج" : "Goal";
  const marketLabel = ar ? "النطاق" : ku ? "بازنە" : "Scope";
  const successLabel = ar ? "الأدوات التي نجحت" : ku ? "ئامرازە سەرکەوتووەکان" : "Successful tools";
  const noEvidence = ar
    ? "لم تُسجّل أي أداة ناجحة يمكن تلخيصها. لم تُختلق نتائج، ولم يُعاد تشغيل الأدوات تلقائياً."
    : ku
      ? "هیچ ئەنجامێکی سەرکەوتووی تۆمارکراو بۆ پوختەکردنەوە نییە. ئەنجام دروست نەکراوە و ئامرازەکان خۆکارانە دووبارە نەکراونەتەوە."
      : "No successful tool output was recorded to summarize. No findings were invented and tools were not automatically rerun.";
  const lines = successful.map((result) =>
    "### " + result.tool + "\n\n" + conciseEvidence(result.output)
  );
  const failedLabel = ar ? "خطوات لم تكتمل" : ku ? "هەنگاوە تەواونەبووەکان" : "Incomplete steps";
  const failedLine = failed.length ? "\n\n## " + failedLabel + "\n\n" + failed.map((x) => x.tool).join(", ") : "";
  const intro = ar
    ? "تعذّرت الصياغة النهائية الآلية؛ لذلك أُصدر هذا التقرير من مخرجات الأدوات المحفوظة فقط. قد يكون أقل تنسيقاً من التقرير المعتاد، لكنه لا يضيف استنتاجات غير مدعومة."
    : ku
      ? "داڕشتنی کۆتایی بە شێوەی خۆکار سەرکەوتوو نەبوو؛ بۆیە ئەم ڕاپۆرتە تەنها لە ئەنجامە پاشەکەوتکراوەکانی ئامرازەکان پێکهاتووە و هیچ دەرئەنجامێکی بێ‌بەڵگە زیاد ناکات."
      : "Automated final drafting was unavailable, so this report uses only saved tool outputs. It may be less polished than the usual report and does not add unsupported conclusions.";
  return [
    "# " + title,
    "**" + goalLabel + ":** " + goal,
    "**" + marketLabel + ":** " + market,
    "",
    intro,
    "",
    "## " + successLabel + " (" + successful.length + "/" + results.length + ")",
    ...(lines.length ? lines : [noEvidence]),
    failedLine,
  ].filter(Boolean).join("\n");
}
