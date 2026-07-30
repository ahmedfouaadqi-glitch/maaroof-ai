import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { ENGINES } from "@/components/engine-logos";
import { getEngineEntitlement, type EngineEntitlementView } from "@/lib/ai-engines.functions";
import type { EngineKey } from "@/lib/ai-engines";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  /** Optional extra cap on top of the plan allowance (e.g. per-tool cost cap). */
  maxOverride?: number;
  className?: string;
};

/**
 * Shared picker for the nine AI answer engines. Reads the caller's plan
 * entitlement (MARK 1 = 3, MARK 2 = 6, MARK 3 = 9) so every tool exposes the
 * same list, the same locks and the same model transparency.
 */
export default function EngineSelector({ value, onChange, maxOverride, className }: Props) {
  const [ent, setEnt] = useState<EngineEntitlementView | null>(null);

  useEffect(() => {
    let alive = true;
    getEngineEntitlement()
      .then((r) => { if (alive) setEnt(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const allowed = new Set<string>(ent?.allowed ?? []);
  const limit = Math.min(ent?.limit ?? 3, maxOverride ?? 99);

  useEffect(() => {
    if (!ent) return;
    const trimmed = value.filter((v) => allowed.has(v)).slice(0, limit);
    if (trimmed.length !== value.length) onChange(trimmed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ent]);

  const toggle = (key: EngineKey) => {
    if (!allowed.has(key)) return;
    onChange(value.includes(key) ? value.filter((x) => x !== key) : [...value, key].slice(0, limit));
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5">
        {ENGINES.map((e) => {
          const on = value.includes(e.key);
          const locked = !!ent && !allowed.has(e.key);
          const full = !on && value.length >= limit;
          const model = ent?.models?.[e.key]?.model;
          return (
            <button
              key={e.key}
              type="button"
              onClick={() => toggle(e.key)}
              disabled={locked || full}
              title={locked ? "Available on a higher plan" : model ? `${e.name} · ${model}${e.proxy ? " (proxy)" : ""}` : e.name}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
                on ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"
              }`}
            >
              <e.Logo size={13} />
              {e.name}
              {locked && <Lock className="size-3" />}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {value.length}/{limit} engines
        {ent?.plan ? ` · ${ent.plan}` : ""}
        {ent && ent.locked.length ? ` · ${ent.locked.length} locked` : ""}
      </p>
    </div>
  );
}
