import { ExternalLink, Sparkles, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type SourceItem = {
  index?: number;
  url: string;
  title?: string;
  domain?: string;
  snippet?: string;
  fetched_at?: string;
};

type Props = {
  sources?: SourceItem[];
  sourcesUsed?: number[];
  rarityScore?: number;
  uniquenessNotes?: string;
  evidenceMissing?: boolean;
};

export function SourcesList({ sources, sourcesUsed, rarityScore, uniquenessNotes, evidenceMissing }: Props) {
  const { lang } = useI18n();
  const L = {
    title: lang === "ar" ? "المصادر المُستخدمة" : lang === "ku" ? "سەرچاوەکان" : "Evidence used",
    rarity: lang === "ar" ? "ندرة الرؤى" : lang === "ku" ? "دەگمەنی" : "Rarity",
    missing: lang === "ar" ? "أدلة غير كافية — أضف رابطاً أو معلومات أكثر للحصول على تحليل دقيق."
            : lang === "ku" ? "بەڵگە کەمە — بەستەرێک زیاد بکە بۆ شیکارییەکی وردتر."
            : "Insufficient evidence — add a URL or more context for a deeper analysis.",
    empty: lang === "ar" ? "لا توجد مصادر." : lang === "ku" ? "هیچ سەرچاوەیەک نییە." : "No sources.",
  };

  const shown = (sources || []).filter((s) =>
    !sourcesUsed || sourcesUsed.length === 0 || sourcesUsed.includes(s.index || 0));

  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">{L.title}</h4>
        {typeof rarityScore === "number" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            <Sparkles className="size-3" /> {L.rarity} {rarityScore}/100
          </span>
        )}
        {evidenceMissing && (
          <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
            <AlertTriangle className="size-3" /> {L.missing}
          </span>
        )}
      </div>
      {uniquenessNotes && (
        <p className="mb-2 text-xs italic text-muted-foreground">{uniquenessNotes}</p>
      )}
      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground">{L.empty}</p>
      ) : (
        <ol className="space-y-1.5 text-xs">
          {shown.map((s, i) => (
            <li key={s.url + i} className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex size-5 items-center justify-center rounded bg-primary/15 text-[10px] font-mono text-primary">{s.index ?? i + 1}</span>
              <div className="flex-1 min-w-0">
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary">
                  <span className="truncate">{s.title || s.url}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
                {s.domain && <div className="text-[10px] text-muted-foreground">{s.domain}</div>}
                {s.snippet && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{s.snippet}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
