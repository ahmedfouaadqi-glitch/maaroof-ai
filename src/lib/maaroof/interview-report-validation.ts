export type InterviewReportLocale = "ar" | "en" | "ku";

export function validateCitationRefs(value: string, sourceCount: number, locale: InterviewReportLocale): string {
  const unavailable = locale === "en"
    ? "[source reference unavailable]"
    : locale === "ku"
      ? "[سەرچاوەی پشتگیری بەردەست نییە]"
      : "[مرجع المصدر غير متاح]";
  return value.replace(/\[(\d+)\]/g, (match, rawIndex: string) => {
    const index = Number(rawIndex);
    return Number.isInteger(index) && index >= 1 && index <= sourceCount ? match : unavailable;
  });
}

export function localizedMissingSection(id: string, locale: InterviewReportLocale) {
  const copy = locale === "en"
    ? { title: `${id.toUpperCase()} analysis needs completion`, finding: "The model did not return this selected section.", gap: "No section-specific finding was generated; do not treat this as a measured result.", recommendation: "Complete this section using verified evidence and the interview context.", measurement: "This is a fallback note, not a measurement or audit result." }
    : locale === "ku"
      ? { title: `شیکاری ${id.toUpperCase()} پێویستی بە تەواوکردن هەیە`, finding: "مۆدێل ئەم بەشەی هەڵبژێردراوی نەگەڕاندووەتەوە.", gap: "هیچ دۆزینەوەیەکی تایبەت بە بەشەکە دروست نەکراوە؛ وەک ئەنجامی پێوانەکراو مامەڵەی لەگەڵ مەکە.", recommendation: "ئەم بەشە بە بەڵگەی پشتڕاستکراوە و کۆنتێکستی چاوپێکەوتن تەواو بکە.", measurement: "ئەمە تێبینییەکی جێگرەوەیە، نەک ئەنجامی پێوانەکردن یان پشکنین." }
      : { title: `استكمال تحليل ${id.toUpperCase()}`, finding: "لم يُرجع النموذج هذا القسم المحدد.", gap: "لم يُنشأ استنتاج خاص بهذا القسم؛ لا تعتبر ذلك نتيجة قياس.", recommendation: "استكمل هذا القسم بالاستناد إلى أدلة موثقة وسياق المقابلة.", measurement: "هذه ملاحظة احتياطية وليست نتيجة قياس أو تدقيق." };
  return { id, title: copy.title, findings: [copy.finding], gaps: [copy.gap], recommendations: [copy.recommendation], measurementNote: copy.measurement };
}
