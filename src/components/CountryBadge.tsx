import { MapPin, Loader2 } from "lucide-react";
import { useCountry } from "@/lib/use-country";
import { useI18n } from "@/lib/i18n";

export function CountryBadge({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { info, loading, source, requestPreciseLocation } = useCountry();
  const { lang } = useI18n();

  if (loading && !info) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
      </div>
    );
  }
  if (!info) return null;

  const name = lang === "ar" ? info.name_ar : lang === "ku" ? info.name_ku : info.name_en;
  const refineLabel =
    lang === "ar" ? "تحديد دقيق" : lang === "ku" ? "وردتر دیاریبکە" : "Refine";
  const sourceTitle =
    source === "gps"
      ? lang === "ar"
        ? t("auto.precisely_defined_gps")
        : "Precise (GPS)"
      : source === "ip"
        ? lang === "ar"
          ? t("auto.auto_detected_by_ip")
          : "Auto-detected via IP"
        : "";

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs"
      title={sourceTitle}
    >
      <span className="text-base leading-none">{info.flag}</span>
      {!compact && <span className="font-medium text-foreground">{name}</span>}
      {source !== "gps" && (
        <button
          type="button"
          onClick={requestPreciseLocation}
          className="ms-1 inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:text-foreground hover:border-primary/40"
          aria-label={refineLabel}
        >
          <MapPin className="size-2.5" />
          {!compact && <span>{refineLabel}</span>}
        </button>
      )}
    </div>
  );
}
