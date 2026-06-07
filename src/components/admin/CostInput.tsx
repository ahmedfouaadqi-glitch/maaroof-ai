import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

export type UsdUnit = "usd" | "cent" | "mcent";

/**
 * Convert a stored USD numeric to (amount, unit) using the cleanest unit
 * that keeps the number small and readable. Examples:
 *  0.0003  → { amount: 30,  unit: "mcent" }
 *  0.05    → { amount: 5,   unit: "cent"  }
 *  1.20    → { amount: 1.2, unit: "usd"   }
 */
export function splitUsd(usd: number): { amount: number; unit: UsdUnit } {
  const v = Number(usd) || 0;
  if (v <= 0) return { amount: 0, unit: "cent" };
  if (v >= 1) return { amount: round(v, 4), unit: "usd" };
  if (v >= 0.01) return { amount: round(v * 100, 3), unit: "cent" };
  return { amount: Math.round(v * 100000), unit: "mcent" };
}
function round(n: number, d: number) { const f = 10 ** d; return Math.round(n * f) / f; }

export function combineUsd(amount: number, unit: UsdUnit): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (unit === "usd") return amount;
  if (unit === "cent") return amount / 100;
  return amount / 100000;
}

/**
 * Numeric input + unit selector ($ / ¢ / m¢).
 * Emits the stored USD value (numeric, up to 6 decimals).
 */
export function CostInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number;
  onChange: (usd: number) => void;
  placeholder?: string;
  className?: string;
}) {
  const { lang } = useI18n();
  const initial = splitUsd(value);
  const [amount, setAmount] = useState<number | "">(initial.amount === 0 ? "" : initial.amount);
  const [unit, setUnit] = useState<UsdUnit>(initial.unit);

  // Sync if external value changes (e.g. drawer reopened)
  useEffect(() => {
    const s = splitUsd(value);
    setAmount(s.amount === 0 ? "" : s.amount);
    setUnit(s.unit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emit(nextAmount: number | "", nextUnit: UsdUnit) {
    const n = nextAmount === "" ? 0 : Number(nextAmount);
    onChange(combineUsd(n, nextUnit));
  }

  const unitLabel: Record<UsdUnit, string> = {
    usd: "$",
    cent: "¢",
    mcent: "m¢",
  };
  const helper: Record<UsdUnit, string> = {
    usd: lang === "ar" ? "دولار" : lang === "ku" ? "دۆلار" : "USD",
    cent: lang === "ar" ? "سنت" : lang === "ku" ? "سەنت" : "cent",
    mcent: lang === "ar" ? "ملّي‑سنت" : lang === "ku" ? "ملی-سەنت" : "milli-cent",
  };

  return (
    <div className={`flex items-stretch overflow-hidden rounded-md border border-border bg-background ${className || ""}`}>
      <input
        type="number"
        step="0.001"
        min={0}
        value={amount}
        placeholder={placeholder || "0"}
        onChange={(e) => {
          const v = e.target.value === "" ? "" : Number(e.target.value);
          setAmount(v);
          emit(v, unit);
        }}
        className="w-full min-w-0 bg-transparent px-2 py-1 text-xs outline-none"
      />
      <select
        value={unit}
        onChange={(e) => {
          const u = e.target.value as UsdUnit;
          setUnit(u);
          emit(amount, u);
        }}
        title={helper[unit]}
        className="border-s border-border bg-card/60 px-1.5 text-[11px] font-semibold outline-none"
      >
        <option value="usd">{unitLabel.usd}</option>
        <option value="cent">{unitLabel.cent}</option>
        <option value="mcent">{unitLabel.mcent}</option>
      </select>
    </div>
  );
}
