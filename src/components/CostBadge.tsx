import { Coins, DollarSign } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function CostBadge({ tokens, usd, compact }: { tokens: number; usd: number; compact?: boolean }) {
  const { lang } = useI18n();
  const usdStr = usd > 0 ? (usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(3)}`) : "$0";
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2 py-0.5 text-[10px] font-medium">
        <Coins className="size-3 text-primary" /> {tokens.toLocaleString(lang === "ar" ? "ar-EG" : "en")} · {usdStr}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold">
      <Coins className="size-3.5 text-primary" /> {tokens.toLocaleString(lang === "ar" ? "ar-EG" : "en")}
      <span className="opacity-50">·</span>
      <DollarSign className="size-3.5 text-emerald-500" />{usdStr}
    </span>
  );
}
