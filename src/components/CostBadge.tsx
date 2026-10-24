import { Coins } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Format a USD amount using the smallest natural unit:
 *  - >= $1     → "$1.23"
 *  - >= $0.01  → "12¢"     (cents)
 *  - >  0      → "300 m¢"  (milli-cents = 1/1000 of a cent = $0.00001)
 *  - 0         → "—"
 *
 * Storage stays in USD with up to 6 decimals; display is always the
 * easiest unit to read.
 */
export function formatUsd(usd: number): string {
  const v = Number(usd) || 0;
  if (v <= 0) return "—";
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) {
    const cents = v * 100;
    return `${cents % 1 === 0 ? cents.toFixed(0) : cents.toFixed(1)}¢`;
  }
  // milli-cent
  const mc = Math.round(v * 100000);
  return `${mc.toLocaleString()} m¢`;
}

export function CostBadge({
  tokens,
  usd,
  compact,
  unpricedLabel,
}: {
  tokens: number;
  usd: number;
  compact?: boolean;
  unpricedLabel?: string;
}) {
  const { lang } = useI18n();
  const unpriced = (!tokens || tokens <= 0) && (!usd || usd <= 0);

  if (unpriced) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
        {unpricedLabel ?? (lang === "ar" ? "غير مسعّرة" : lang === "ku" ? "نرخ نەنراوە" : "Unpriced")}
      </span>
    );
  }

  const usdStr = formatUsd(usd);
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2 py-0.5 text-[10px] font-medium">
        <Coins className="size-3 text-primary" />
        {tokens.toLocaleString(lang === "ar" ? "ar-EG" : "en")}
        <span className="opacity-50">·</span>
        <span className="text-emerald-500 font-semibold">{usdStr}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold">
      <Coins className="size-3.5 text-primary" />
      {tokens.toLocaleString(lang === "ar" ? "ar-EG" : "en")}
      <span className="opacity-50">·</span>
      <span className="text-emerald-500">{usdStr}</span>
    </span>
  );
}
