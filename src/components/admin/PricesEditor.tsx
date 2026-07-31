// Dynamic multi-currency price editor used in admin panels.
// Edits a { CODE: amount } map + a default display currency.
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { Plus, Trash2 } from "lucide-react";
import { CURRENCIES, type CurrencyCode } from "@/lib/currencies";

export type PricesValue = {
  prices: Record<string, number>;
  default_currency: string;
};

export function PricesEditor({
  value,
  onChange,
  compact,
}: {
  value: PricesValue;
  onChange: (v: PricesValue) => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const entries = useMemo(() => Object.entries(value.prices || {}), [value.prices]);
  const used = new Set(entries.map(([k]) => k));
  const available = CURRENCIES.filter((c) => !used.has(c.code));

  function setPrice(code: string, amount: number) {
    const next = { ...value.prices, [code]: amount };
    onChange({ ...value, prices: next });
  }
  function rename(oldCode: string, newCode: string) {
    if (oldCode === newCode) return;
    const next: Record<string, number> = {};
    for (const [k, v] of Object.entries(value.prices)) {
      next[k === oldCode ? newCode : k] = v;
    }
    onChange({
      ...value,
      prices: next,
      default_currency: value.default_currency === oldCode ? newCode : value.default_currency,
    });
  }
  function remove(code: string) {
    const { [code]: _drop, ...rest } = value.prices;
    onChange({
      ...value,
      prices: rest,
      default_currency:
        value.default_currency === code
          ? (Object.keys(rest)[0] || "USD")
          : value.default_currency,
    });
  }
  function add() {
    const next = available[0];
    if (!next) return;
    onChange({ ...value, prices: { ...value.prices, [next.code]: 0 } });
  }

  return (
    <div className="space-y-1.5">
      {entries.length === 0 && (
        <div className="text-[11px] text-muted-foreground">{t("auto.no_prices_yet")}</div>
      )}
      {entries.map(([code, amount]) => {
        const def = CURRENCIES.find((c) => c.code === code);
        const selectable = [
          ...(def ? [def] : [{ code: code as CurrencyCode, symbol: code, name_ar: code, name_en: code, decimals: 2 }]),
          ...available,
        ];
        return (
          <div key={code} className={`flex items-center gap-1 ${compact ? "" : "rounded-md border border-border/60 bg-background/40 p-1.5"}`}>
            <select
              value={code}
              onChange={(e) => rename(code, e.target.value)}
              className="rounded border border-border bg-background px-1.5 py-1 text-[11px]"
            >
              {selectable.map((c) => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
            <input
              type="number"
              step={def && def.decimals === 0 ? 1 : 0.01}
              min={0}
              value={amount || ""}
              onChange={(e) => setPrice(code, Number(e.target.value) || 0)}
              className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
              placeholder="0"
            />
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground" title={t("auto.default_display_currency")}>
              <input
                type="radio"
                name={`default-${entries.length}-${code}`}
                checked={value.default_currency === code}
                onChange={() => onChange({ ...value, default_currency: code })}
              />
              {value.default_currency === code ? "★" : "○"}
            </label>
            <button
              type="button"
              onClick={() => remove(code)}
              className="rounded p-1 text-destructive hover:bg-destructive/10"
              title={t("auto.delete")}
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        disabled={available.length === 0}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] hover:border-primary disabled:opacity-50"
      >
        <Plus className="size-3" /> إضافة عملة
      </button>
    </div>
  );
}
