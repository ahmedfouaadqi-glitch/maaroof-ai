// Tokens usage bar — shows balance, daily, monthly with progress + colors.
// Honors `profiles.hide_usage_counter` (hides numbers) and `widgets.tokens_bar` (hides entirely).
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useVisibility } from "@/lib/visibility";

type P = {
  tokens_balance: number;
  tokens_daily_limit: number | null;
  tokens_monthly_limit: number | null;
  tokens_used_today: number;
  tokens_used_month: number;
  hide_usage_counter: boolean | null;
};

function barColor(pct: number) {
  if (pct >= 80) return "from-red-500 to-rose-500";
  if (pct >= 50) return "from-amber-500 to-yellow-500";
  return "from-emerald-500 to-teal-500";
}

export function TokensBar({ compact }: { compact?: boolean }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { isWidgetVisible, loading: visLoading } = useVisibility();
  const [p, setP] = useState<P | null>(null);

  useEffect(() => {
    if (!user) return;
    const reload = () => {
      supabase
        .from("profiles")
        .select("tokens_balance,tokens_daily_limit,tokens_monthly_limit,tokens_used_today,tokens_used_month,hide_usage_counter")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => setP((data as any) || null));
    };
    reload();
    const handler = () => reload();
    window.addEventListener("tokens-changed", handler);
    return () => window.removeEventListener("tokens-changed", handler);
  }, [user?.id]);

  if (!user || !p || visLoading) return null;
  if (!isWidgetVisible("tokens_bar")) return null;
  if (p.hide_usage_counter) return null;

  const isAr = lang === "ar";
  const isKu = lang === "ku";
  const balanceMax = Math.max(p.tokens_balance + p.tokens_used_month, p.tokens_balance || 1);
  const balancePct = Math.min(100, ((balanceMax - p.tokens_balance) / balanceMax) * 100);
  const dailyMax = p.tokens_daily_limit || 0;
  const dailyPct = dailyMax ? Math.min(100, (p.tokens_used_today / dailyMax) * 100) : 0;
  const monthlyMax = p.tokens_monthly_limit || 0;
  const monthlyPct = monthlyMax ? Math.min(100, (p.tokens_used_month / monthlyMax) * 100) : 0;

  const L = isAr
    ? { balance: "رصيدك", today: "اليوم", month: "الشهر", upgrade: "ترقية الباقة", low: "رصيد منخفض" }
    : isKu
    ? { balance: "بەڵانس", today: "ئەمڕۆ", month: "مانگ", upgrade: "بەرزکردنەوەی پلان", low: "بەڵانسی کەم" }
    : { balance: "Balance", today: "Today", month: "Month", upgrade: "Upgrade plan", low: "Low balance" };

  const showUpgrade = balancePct >= 80 || dailyPct >= 80 || monthlyPct >= 80;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs">
        <Coins className="size-3.5 text-primary" />
        <span className="font-mono font-semibold">{p.tokens_balance.toLocaleString()}</span>
        {dailyMax > 0 && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{p.tokens_used_today}/{dailyMax}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="size-5 text-primary" />
          <h3 className="font-display text-sm font-semibold">{L.balance}</h3>
        </div>
        {showUpgrade && (
          <Link to="/pricing" className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1 text-[11px] font-semibold text-primary-foreground">
            <Sparkles className="size-3" /> {L.upgrade}
          </Link>
        )}
      </div>

      <div className="mt-3 space-y-3">
        <Row label={L.balance} used={p.tokens_balance} total={balanceMax} pct={balancePct} invertColor mode="balance" />
        {dailyMax > 0 && <Row label={L.today} used={p.tokens_used_today} total={dailyMax} pct={dailyPct} />}
        {monthlyMax > 0 && <Row label={L.month} used={p.tokens_used_month} total={monthlyMax} pct={monthlyPct} />}
      </div>
    </div>
  );
}

function Row({ label, used, total, pct, invertColor, mode }: { label: string; used: number; total: number; pct: number; invertColor?: boolean; mode?: "balance" }) {
  const color = invertColor ? barColor(100 - pct) : barColor(pct);
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">
          {mode === "balance" ? `${used.toLocaleString()} / ${total.toLocaleString()}` : `${used.toLocaleString()} / ${total.toLocaleString()}`}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-background/60">
        <div className={`h-full bg-gradient-to-r ${color} transition-all`} style={{ width: `${mode === "balance" ? 100 - pct : pct}%` }} />
      </div>
    </div>
  );
}
