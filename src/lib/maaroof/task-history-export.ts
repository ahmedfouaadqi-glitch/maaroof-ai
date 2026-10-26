import type { ExportLang, ExportPayload } from "@/lib/exports";
import { buildTaskExportPayload } from "@/lib/maaroof/task-export";

export type TaskHistoryExportJob = {
  id: string;
  goal: string;
  status: string;
  created_at: string;
  request_payload?: any;
};

export type TaskHistoryEvent = {
  seq?: number;
  event_type: string;
  payload?: any;
  created_at?: string;
};

const LABELS: Record<ExportLang, {
  task: string;
  status: string;
  activity: string;
  completed: string;
  failed: string;
  cancelled: string;
  running: string;
  queued: string;
  unknown: string;
}> = {
  ar: {
    task: "مهمة", status: "الحالة", activity: "سجل العمل",
    completed: "اكتملت", failed: "فشلت", cancelled: "أُلغيت",
    running: "قيد التنفيذ", queued: "بالانتظار", unknown: "غير معروف",
  },
  en: {
    task: "Task", status: "Status", activity: "Activity log",
    completed: "Completed", failed: "Failed", cancelled: "Cancelled",
    running: "Running", queued: "Queued", unknown: "Unknown",
  },
  ku: {
    task: "ئەرک", status: "دۆخ", activity: "تۆماری چالاکی",
    completed: "تەواو", failed: "شکستی هێنا", cancelled: "هەڵوەشێنرایەوە",
    running: "بەردەوامە", queued: "چاوەڕێ", unknown: "نەناسراو",
  },
};

function statusLabel(status: string, lang: ExportLang): string {
  const labels = LABELS[lang];
  return status in labels ? labels[status as keyof typeof labels] : (status || labels.unknown);
}

/** Reconstruct the full export from the persisted event stream of one archived task. */
export function buildTaskHistoryExportPayload(
  job: TaskHistoryExportJob,
  events: TaskHistoryEvent[],
  lang: ExportLang,
): ExportPayload {
  const ordered = [...events].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  const finalEvent = [...ordered].reverse().find((event) => event.event_type === "final");
  const finalText = String(finalEvent?.payload?.text ?? finalEvent?.payload?.summary ?? finalEvent?.payload?.answer ?? "");
  const results = ordered
    .filter((event) => event.event_type === "tool_result" && event.payload && typeof event.payload === "object")
    .map((event, index) => {
      const payload = event.payload;
      return {
        tool: typeof payload.tool === "string" && payload.tool.trim() ? payload.tool : "tool_" + String(payload.index ?? index + 1),
        ok: payload.ok === true,
        output: payload.output ?? null,
      };
    });

  const generated = buildTaskExportPayload({
    title: job.goal?.trim() || LABELS[lang].task,
    goal: job.goal || "",
    finalText,
    results,
    lang,
  });

  const locale = lang === "en" ? "en" : lang === "ku" ? "ku" : "ar";
  const statusSection = {
    heading: LABELS[lang].status,
    kind: "kv" as const,
    rows: [[LABELS[lang].status, statusLabel(job.status, lang)]] as [string, string][],
  };
  const activitySection = {
    heading: LABELS[lang].activity,
    kind: "list" as const,
    list: ordered.map((event) => {
      const time = event.created_at ? new Date(event.created_at).toLocaleTimeString(locale) + " · " : "";
      return time + event.event_type;
    }),
  };

  return {
    ...generated,
    subtitle: new Date(job.created_at).toLocaleString(locale),
    sections: [statusSection, ...generated.sections, activitySection],
  };
}
