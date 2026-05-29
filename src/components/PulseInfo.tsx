import { Info } from "lucide-react";
import type { ReactNode } from "react";

export function PulseHint({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground leading-relaxed">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/70" />
      <span>{children}</span>
    </p>
  );
}

export function PulseInfoCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Info className="h-4 w-4" />
        <span>{title}</span>
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}
