import { useI18n } from "@/lib/i18n";

/** Competitor monitoring is centrally paused; this component intentionally makes no API calls. */
export function CompetitorMonitor() {
  const { lang } = useI18n();
  const title =
    lang === "en" ? "Competitor monitoring" :
    lang === "ku" ? "چاودێری ڕکابەران" :
    "مراقبة المنافسين";
  const message =
    lang === "en"
      ? "Competitor monitoring is temporarily paused. No scans are running and no credits are charged."
      : lang === "ku"
        ? "چاودێری ڕکابەران کاتی ڕاگیراوە؛ هیچ پشکنینێک ناکرێت و هیچ باجێک نابڕدرێت."
        : "مراقبة المنافسين متوقفة مؤقتاً؛ لا تُنفّذ فحوصات ولا يُخصم أي رصيد.";

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
