export type ProtectedDestructiveOperation="tool_result_delete"|"tool_history_clear"|"workspace_delete"|"report_template_delete";
const MESSAGES={
 ar:"تمت حماية البيانات من الحذف. يمكنك الاحتفاظ بالسجل ومراجعته؛ الأرشفة والاستعادة الدائمة غير متاحتين بعد.",
 en:"Deletion is disabled to protect data. History remains available for review; persistent archive and restore are not implemented yet.",
 ku:"سڕینەوە بۆ پاراستنی داتا ناچالاک کراوە. مێژوو بۆ پێداچوونەوە دەمێنێتەوە؛ ئەرشیف و گەڕاندنەوەی هەمیشەیی هێشتا جێبەجێ نەکراون."
} as const;
export function rejectDestructiveOperation(operation:ProtectedDestructiveOperation):never {
 throw new Error(operation+"_disabled_non_destructive_mode");
}
export function nonDestructiveNotice(language:"ar"|"en"|"ku"):string{return MESSAGES[language];}
export function preserveAllResults<T>(items:readonly T[]):T[]{return [...items];}
